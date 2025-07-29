import datetime
from app.utils.email_templates import render_template
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from app.utils.auth import get_current_user
from app.db import db
from app.config import settings
from bson import ObjectId
from app.utils.logger import logger
from app.utils.notifier import send_email

router = APIRouter(prefix="/billing", tags=["billing"])

stripe.api_key = settings.STRIPE_SECRET_KEY

# Replace with your actual price ID from Stripe dashboard
PRO_PRICE_ID = settings.PRO_PRICE_ID

@router.get("/history")
async def get_billing_history(user=Depends(get_current_user)):
    user_id, role, _ = user
    if role != "organization_head":
        raise HTTPException(status_code=403)

    user_doc = await db["users"].find_one({"_id": ObjectId(user_id)})
    org_id = user_doc.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization not found.")

    org = await db["organizations"].find_one({"_id": ObjectId(org_id)})
    stripe_customer_id = org.get("stripe_customer_id")
    if not stripe_customer_id:
        return []

    try:
        invoices = stripe.Invoice.list(customer=stripe_customer_id, limit=10)
        return [
            {
                "amount": inv["amount_paid"] / 100,
                "currency": inv["currency"].upper(),
                "date": datetime.utcfromtimestamp(inv["created"]).strftime("%Y-%m-%d"),
                "status": inv["status"],
                "url": inv["hosted_invoice_url"]
            }
            for inv in invoices.auto_paging_iter()
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")


@router.post("/cancel")
async def cancel_subscription(user=Depends(get_current_user)):

    user_id, role, _ = user
    if role != "organization_head":
        raise HTTPException(status_code=403, detail="Only organization heads can cancel plans.")

    user_doc = await db["users"].find_one({"_id": ObjectId(user_id)})
    org_id = user_doc.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization not found.")

    org = await db["organizations"].find_one({"_id": ObjectId(org_id)})
    stripe_sub_id = org.get("stripe_subscription_id")
    if not stripe_sub_id:
        raise HTTPException(status_code=400, detail="No active Stripe subscription.")

    try:
        stripe.Subscription.delete(stripe_sub_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")

    await db["organizations"].update_one(
        {"_id": ObjectId(org_id)},
        {
            "$set": {
                "plan": "free",
                "usage_quota.total_limit": settings.FREE_TOKENS
            },
            "$unset": {
                "stripe_subscription_id": "",
                "stripe_customer_id": ""
            }
        }
    )

    logger.info(f"🧾 Subscription cancelled and org {org_id} downgraded to Free.")
    return {"message": "Subscription cancelled"}


@router.post("/create-checkout-session")
async def create_checkout_session(user=Depends(get_current_user)):
    user_id, role, email = user

    # Only org heads can create subscriptions
    user_doc = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user_doc or role != "organization_head":
        raise HTTPException(status_code=403, detail="Only organization heads can subscribe.")

    org_id = user_doc.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization not found for this user.")

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{
                "price": PRO_PRICE_ID,
                "quantity": 1,
            }],
            customer_email=email,
            success_url=f"{settings.FRONT_END_URL}/checkout/success",
            cancel_url=f"{settings.FRONT_END_URL}/checkout/cancel",
            metadata={"organization_id": str(org_id)},
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request):

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    

    # Handle subscription creation
    if event["type"] == "customer.subscription.created":
        subscription = event["data"]["object"]
        metadata = subscription.get("metadata", {})
        org_id = metadata.get("organization_id")

        if org_id:
            await db["organizations"].update_one(
                {"_id": ObjectId(org_id)},
                {"$set": {
                    "stripe_subscription_id": subscription["id"],
                    "stripe_customer_id": subscription["customer"],
                    "plan": "pro",
                    "usage_quota.total_limit": settings.PREMIUM_TOKENS,
                }}
            )
            logger.info(f"✅ Upgraded organization {org_id} to Pro plan via Stripe.")
            head_user = await db["users"].find_one({"organization_id": ObjectId(org_id), "role": "organization_head"})
            
            if head_user:
                html = render_template("subscription_activated.html", {
                "ORG_NAME": "Quran Scholars",
                "ACTIVATED_DATE": "2025-05-26",
                "DASHBOARD_URL": "https://quranai.app/dashboard/billing"
            })
            send_email(head_user["email"], "✅ QuranAI Pro Plan Activated", html)
                
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        metadata = subscription.get("metadata", {})
        org_id = metadata.get("organization_id")

        if org_id:
            await db["organizations"].update_one(
                {"_id": ObjectId(org_id)},
                {"$set": {
                    "plan": "free",
                    "usage_quota.total_limit": 10000
                },
                "$unset": {
                    "stripe_subscription_id": "",
                    "stripe_customer_id": ""
                }}
            )
            logger.warning(f"⚠️ Organization {org_id} was downgraded to Free (subscription cancelled).")
            head_user = await db["users"].find_one({"organization_id": ObjectId(org_id), "role": "organization_head"})

            html = render_template("subscription_fallback_cancelled.html", {
            "ORG_NAME": "DCC Research",
            "CANCELLED_DATE": "2025-05-26",
            "DASHBOARD_URL": "https://quranai.app/dashboard/billing"
        })
        send_email(head_user["email"], "⚠️ Subscription Cancelled", html)
    return {"received": True}
