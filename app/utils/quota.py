from app.utils.notifier import send_slack_alert, send_email
from fastapi import HTTPException
from datetime import datetime
from bson import ObjectId
from app.db import db
from app.utils.logger import logger
from app.config import settings

DEFAULT_LIMITS = settings.DEFAULT_LIMITS # Tier-based limits

async def enforce_quota_and_update(user_id: str, tokens_used: int = 0, send_warning: bool = True): # Added send_warning
    if tokens_used < 0:
        logger.error(f"Attempted to process negative tokens_used ({tokens_used}) for user {user_id}.")
        raise HTTPException(status_code=400, detail="Tokens used cannot be negative.")

    # 1. Fetch User Profile
    user_profile = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user_profile:
        # This should ideally not happen for an authenticated user if token validation is robust
        logger.error(f"CRITICAL: User profile not found for user_id: {user_id} during quota enforcement.")
        raise HTTPException(status_code=500, detail="User profile not found. Please contact support.")

    organization_id = user_profile.get("organization_id")
    org_doc = None
    is_org_member = bool(organization_id)

    # 2. Organization Quota Check (Priority Check, if user belongs to an org)
    if is_org_member:
        org_doc = await db.organizations.find_one({"_id": organization_id})
        if not org_doc:
            logger.error(f"CRITICAL: Organization document not found for organization_id: {organization_id} linked to user {user_id}.")
            raise HTTPException(status_code=500, detail="User's organization data not found. Data inconsistency.")

        org_usage_quota = org_doc.get("usage_quota", {})
        org_total_limit = org_usage_quota.get("total_limit", 0)
        org_current_used = org_usage_quota.get("used", 0)

        if org_current_used + tokens_used > org_total_limit:
            logger.warning(f"Organization {organization_id} quota limit reached. User {user_id} denied usage of {tokens_used} tokens.")
            raise HTTPException(status_code=403, detail="Organization's total monthly quota limit reached.")

    # 3. Determine Effective User Quota and Usage Source
    is_org_managed_user_quota = False
    effective_user_token_limit = -1 # -1 can mean unlimited or fallback to a very high number if not set by tier
    current_user_tokens_spent = 0
    user_quota_field = user_profile.get("quota")

    if is_org_member and user_quota_field and isinstance(user_quota_field.get("monthly_limit"), (int, float)) and user_quota_field["monthly_limit"] >= 0:
        effective_user_token_limit = user_quota_field["monthly_limit"]
        current_user_tokens_spent = user_quota_field.get("used", 0)
        is_org_managed_user_quota = True
        logger.info(f"User {user_id} is using organization-defined quota. Limit: {effective_user_token_limit}, Used: {current_user_tokens_spent}")
    else:
        # Fallback to tier-based system using db.usage (or create it)
        tier = user_profile.get("tier", "free")
        tier_limits = DEFAULT_LIMITS.get(tier, DEFAULT_LIMITS["free"]) # Default to free tier if specific tier not found

        usage_doc = await db.usage.find_one({"user_id": user_id})
        if not usage_doc:
            logger.info(f"No usage document found for user {user_id}. Creating one with tier '{tier}' limits.")
            usage_doc = {
                "user_id": user_id,
                "tier": tier,
                "token_usage_monthly": 0,
                "message_count_monthly": 0,
                "limits": tier_limits, # Set limits from tier
                "last_reset": datetime.utcnow() # Consider if reset logic needs to be more sophisticated
            }
            await db.usage.insert_one(usage_doc)

        effective_user_token_limit = usage_doc["limits"].get("tokens", 0)
        current_user_tokens_spent = usage_doc.get("token_usage_monthly", 0)
        logger.info(f"User {user_id} is using tier-based quota ('{tier}'). Limit: {effective_user_token_limit}, Used: {current_user_tokens_spent}")


    # 4. Enforce User Token Quota
    if effective_user_token_limit != -1 and (current_user_tokens_spent + tokens_used > effective_user_token_limit):
        logger.warning(f"User {user_id} monthly token quota exceeded. Attempted: {tokens_used}, Spent: {current_user_tokens_spent}, Limit: {effective_user_token_limit}")
        raise HTTPException(status_code=429, detail="Your monthly token quota has been exceeded.")

    # 5. Message Quota Check (Always from db.usage for now, as per problem statement)
    # Fetch/create usage_doc if it wasn't fetched in step 3 (i.e., if is_org_managed_user_quota was true)
    # This means even org users with specific token quotas might still be subject to a general message limit from their tier.
    usage_doc_for_messages = await db.usage.find_one({"user_id": user_id})
    if not usage_doc_for_messages:
        # This implies a new user, or an org user who never had a usage_doc. Create one.
        tier = user_profile.get("tier", "free") # Re-evaluate tier for safety
        tier_limits_for_msg = DEFAULT_LIMITS.get(tier, DEFAULT_LIMITS["free"])
        logger.info(f"Creating usage document for user {user_id} (for message tracking) with tier '{tier}' limits.")
        usage_doc_for_messages = {
            "user_id": user_id, "tier": tier, "token_usage_monthly": 0,
            "message_count_monthly": 0, "limits": tier_limits_for_msg,
            "last_reset": datetime.utcnow()
        }
        await db.usage.insert_one(usage_doc_for_messages)

    current_messages_sent = usage_doc_for_messages.get("message_count_monthly", 0)
    message_limit = usage_doc_for_messages.get("limits", {}).get("messages", 0)

    if message_limit > 0 and (current_messages_sent + 1 > message_limit): # +1 for the current message
        logger.warning(f"User {user_id} monthly message quota exceeded. Sent: {current_messages_sent}, Limit: {message_limit}")
        raise HTTPException(status_code=429, detail="Your monthly message limit has been exceeded.")

    # 6. If all checks passed - Perform Updates
    # User's Token Quota Update
    if is_org_managed_user_quota:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$inc": {"quota.used": tokens_used}})
        logger.info(f"Updated user DB quota for {user_id}. Added tokens: {tokens_used}")
    else: # Tier-based token usage
        await db.usage.update_one({"user_id": user_id}, {"$inc": {"token_usage_monthly": tokens_used}})
        logger.info(f"Updated usage DB (tokens) for {user_id}. Added tokens: {tokens_used}")

    # Organization's Quota Update (if applicable)
    if is_org_member and org_doc: # org_doc would have been fetched if is_org_member
        await db.organizations.update_one({"_id": organization_id}, {"$inc": {"usage_quota.used": tokens_used}})
        logger.info(f"Updated organization DB quota for org {organization_id}. Added tokens: {tokens_used}")
        # Update org_current_used for potential org warning notification
        org_current_used += tokens_used


    # Message Count Update (always in db.usage for now)
    await db.usage.update_one({"user_id": user_id}, {"$inc": {"message_count_monthly": 1}})
    logger.info(f"Updated usage DB (messages) for {user_id}. Incremented message count.")
    # Update current_messages_sent for potential warning notification
    current_messages_sent +=1


    # 7. Notifications (adapt based on which quota is active)
    if send_warning:
        # User Token Quota Warning
        if effective_user_token_limit > 0 and (current_user_tokens_spent + tokens_used > 0.8 * effective_user_token_limit): # Using 80% threshold
            logger.warning(f"⚠️ User {user_id} is nearing their token quota ({((current_user_tokens_spent + tokens_used)/effective_user_token_limit)*100:.0f}%).")
            # Simplified email sending for brevity, adapt actual HTML template usage
            try:
                user_email_address = user_profile.get("email")
                if user_email_address:
                    percent_tokens = ((current_user_tokens_spent + tokens_used) / effective_user_token_limit) * 100
                    # Actual HTML templating should be more robust
                    html_content = f"You have used {percent_tokens:.0f}% of your monthly token quota."
                    send_email(
                        to_email=user_email_address,
                        subject=f"{settings.QUOTA_WARNING_SUBJECT} - Token Quota Warning",
                        html=html_content
                    )
                    send_slack_alert(f"⚠️ User {user_email_address} is at {percent_tokens:.0f}% of their token quota.")
            except Exception as e:
                logger.error(f"Failed to send token quota warning email/slack for user {user_id}: {e}")

        # Message Quota Warning (from db.usage)
        if message_limit > 0 and (current_messages_sent > 0.8 * message_limit): # Using 80% threshold
             logger.warning(f"⚠️ User {user_id} is nearing their message quota ({ (current_messages_sent/message_limit)*100:.0f}%).")
             # Add email/slack notification if needed for messages

        # Organization Quota Warning
        if is_org_member and org_doc and org_total_limit > 0 and (org_current_used > 0.8 * org_total_limit): # Using 80% threshold
            logger.warning(f"⚠️ Organization {organization_id} is nearing its total token quota ({ (org_current_used/org_total_limit)*100:.0f}%).")
            # Notify org head and/or platform admins
            org_head_email = None # Logic to find org head's email if needed
            # For now, just a Slack alert
            send_slack_alert(f"⚠️ Organization {org_doc.get('name', str(organization_id))} is at { (org_current_used/org_total_limit)*100:.0f}% of its total token quota.")
