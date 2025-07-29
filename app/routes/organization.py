from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from app.db import db
from typing import Optional, List # Ensure List and Optional are imported
from app.models.user import User
# from app.models.agent import Agent # Agent model no longer used in this file
from app.models.organization import Organization
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationResponse,
    UserQuotaInfo,
    OrgQuotaInfo,
    OrgQuotaDetailsResponse,
    UserQuotaUpdatePayload, # New import
    OrganizationUsageResponse # Import the new response model
)
# from app.schemas.agent import AgentCreate, AgentResponse # Agent schemas no longer used
from app.schemas.user import UserQuota, UserResponse # UserQuota might be removed if UserQuotaUpdatePayload replaces its use case
from app.utils.auth import get_current_user, hash_password, require_role, verify_token
from app.config import settings
import stripe
from collections import defaultdict
from app.utils.logger import logger
router = APIRouter(prefix="/org", tags=["Organization"])

# Utils
def get_collection(name: str):
    return db[name]

@router.post("/create", response_model=OrganizationResponse)
async def create_organization(payload: OrganizationCreate, user: str = Depends(get_current_user)):
    # Ensure this is the platform admin
    user = await db.users.find_one({"_id": ObjectId(user[0])})
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create organizations.")

    org = {
        "name": payload.name,
        "head_user_id": payload.head_user_id,
        "usage_quota": {
            "total_limit": settings.FREE_TOKENS,
            "used": 0,
            "reset_date": None
        },
        "agents": []
    }

    result = await db.organizations.insert_one(org)

    # Link org to head user
    await db.users.update_one(
        {"_id": payload.head_user_id},
        {
            "$set": {
                "organization_id": result.inserted_id,
                "role": "organization_head"
            }
        }
    )

    org["_id"] = result.inserted_id
    return Organization(org)

@router.get("/orgs")
async def get_all_orgs(user_id: str = Depends(verify_token)):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user["role"] != "admin":
        raise HTTPException(status_code=403)

    orgs = await db.organizations.find().to_list(length=100)
    response = []

    for org in orgs:
        user_count = await db.users.count_documents({"organization_id": org["_id"]})
        response.append({
            "_id": str(org["_id"]),  # ✅ Required by frontend to link to /admin/orgs/[id]
            "name": org["name"],
            "created_at": str(org.get("_id").generation_time.date()),
            "users": user_count,
            "tokens_used": org.get("usage_quota", {}).get("used", 0),
            "plan": org.get("plan", "free"),
            "total_quota": org.get("usage_quota", {}).get("total_limit", 0)
        })

    return response

# Route /users GET must be defined before /{org_id} GET
@router.get("/users", response_model=list[UserResponse])
async def get_organization_users(org_id: str, user: str = Depends(get_current_user)):
    await require_role(user[0], ["organization_head"])
    users_from_db = await get_collection("users").find({"organization_id": ObjectId(org_id)}).to_list(length=100) # Changed variable name to avoid conflict
    return [User(u) for u in users_from_db] # Use User model for consistent response


@router.get("/quota-requests", response_model=List[dict])
async def get_org_quota_requests_list_placeholder(
    # org_id_param: Optional[str] = Query(None, alias="org_id"), # Example if taking org_id as query
    current_user_tuple = Depends(get_current_user) # Basic auth
):
    user_id_from_token, user_role, _ = current_user_tuple

    # This is a placeholder to fix routing. Actual implementation is TBD.
    # Ensure proper authorization for this route.
    logger.info(f"User {user_id_from_token} (role: {user_role}) accessed placeholder /org/quota-requests.")
    # Example basic auth:
    if not user_id_from_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # TODO: Implement actual logic based on requirements (e.g., admin sees all, org_head sees own)
    # For now, returning a simple placeholder response.
    return [{"info": "Placeholder for /org/quota-requests", "user_role": user_role}]


@router.post("/{org_id}/add-user")
async def add_user_to_org(org_id: str, payload: dict, token_user_id: str = Depends(verify_token)): # Renamed user_id to token_user_id for clarity
    requesting_user = await db.users.find_one({"_id": ObjectId(token_user_id)})

    if not requesting_user:
        raise HTTPException(status_code=403, detail="Requesting user not found.")

    user_role = requesting_user.get("role")
    # Ensure organization_id from user doc is converted to string for comparison
    user_org_id = str(requesting_user.get("organization_id")) if requesting_user.get("organization_id") else None

    is_authorized = False
    if user_role == "admin":
        is_authorized = True
    elif user_role == "organization_head":
        # Ensure user_org_id is not None and matches the target org_id
        if user_org_id and user_org_id == org_id:
            is_authorized = True
    
    if not is_authorized:
        raise HTTPException(status_code=403, detail="User not authorized to add users to this organization.")

    email = payload.get("email")
    password = payload.get("password")
    name = payload.get("name", "New User")
    
    if not email and not password:
        raise HTTPException(status_code=400, detail="Email and password is required")
    
    hashed = hash_password(password)
    
    existing = await db.users.find_one({"email": email, "organization_id": org_id})
    
    if existing:
        raise HTTPException(status_code=404, detail="User alread a member of organization")
    if not existing:
        existing = await db.users.insert_one({
            "email": email, "password": hashed, 
            "name": name, "created_at": datetime.utcnow(),
            "is_active": True, "is_verified": True,
            "organization_id": ObjectId(org_id), "role": "member", 
            "quota": {"monthly_limit": settings.FREE_TOKENS, "used": 0, "reset_date": None}
            })
    else:
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": {"organization_id": ObjectId(org_id), "role": "member"}}
        )
    return {"message": "User added to organization"}

@router.patch("/{org_id}/update-role")
async def update_user_role(org_id: str, payload: dict, user_id: str = Depends(verify_token)):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user["role"] != "admin":
        raise HTTPException(status_code=403)

    target_user_id = payload.get("userId")
    new_role = payload.get("role")

    if new_role not in ["member", "admin", "organization_head"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    await db.users.update_one(
        {"_id": ObjectId(target_user_id)},
        {"$set": {"role": new_role}}
    )
    return {"message": f"Role updated to {new_role}"}

@router.patch("/{org_id}/toggle-active")
async def toggle_user_status(org_id: str, payload: dict, user_id: str = Depends(verify_token)):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user["role"] != "admin":
        raise HTTPException(status_code=403)

    target_user_id = payload.get("userId")
    is_active = payload.get("is_active")
    await db.users.update_one(
        {"_id": ObjectId(target_user_id)},
        {"$set": {"is_active": is_active}}
    )
    return {"message": "User status updated"}

@router.delete("/{org_id}/delete-user/{user_id}")
async def delete_user_from_org(org_id: str, user_id: str, admin_id: str = Depends(verify_token)):
    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if admin["role"] != "admin":
        raise HTTPException(status_code=403)

    await db.users.delete_one({"_id": ObjectId(user_id), "organization_id": org_id})
    return {"message": "User deleted from organization"}

@router.patch("/assign-agent")
async def assign_agent_to_user(user_id: str, agent_id: str, user: str = Depends(get_current_user)):
    await require_role(user[0], ["organization_head"])
    result = await get_collection("users").update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"agent_id": agent_id}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found or unchanged")
    return {"message": "Agent assigned successfully"}

@router.patch("/update-quota")
async def update_user_quota(user_id: str, quota: UserQuota, user: str = Depends(get_current_user)):
    result = await get_collection("users").update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"quota": quota.dict()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found or unchanged")
    return {"message": "Quota updated successfully"}

@router.get("/users", response_model=list[UserResponse])
async def get_organization_users(org_id: str, user: str = Depends(get_current_user)):
    await require_role(user[0], ["organization_head", "admin"])
    users = await get_collection("users").find({"organization_id": org_id}).to_list(length=100)
    return [User(u) for u in users]

@router.post("/quota-request")
async def request_more_quota(user_id: str, reason: str, user: str = Depends(get_current_user)):
    # Log request to a dedicated collection
    request_doc = {
        "user_id": user_id,
        "reason": reason,
        "status": "pending"
    }
    await get_collection("quota_requests").insert_one(request_doc)
    return {"message": "Quota request submitted"}


@router.get("/{org_id}/usage", response_model=OrganizationUsageResponse)
async def get_organization_usage(org_id: str, current_user_tuple=Depends(get_current_user)):
    user_id_from_token, _, _ = current_user_tuple

    # 1. Authorization
    user_doc = await db.users.find_one({"_id": ObjectId(user_id_from_token)})
    if not user_doc:
        logger.error(f"User not found for token ID: {user_id_from_token} when trying to access org usage for {org_id}")
        raise HTTPException(status_code=404, detail="Requesting user not found.")

    user_role = user_doc.get("role")
    # Ensure organization_id from user doc is converted to string for comparison, if it exists
    user_org_id_db = str(user_doc.get("organization_id")) if user_doc.get("organization_id") else None

    authorized = False
    if user_role == "admin":
        authorized = True
    elif user_role == "organization_head" and user_org_id_db == org_id:
        authorized = True

    if not authorized:
        logger.warning(f"User {user_id_from_token} (Role: {user_role}, Org: {user_org_id_db}) unauthorized to access usage for org {org_id}.")
        raise HTTPException(status_code=403, detail="User not authorized to view this organization's usage.")

    # 2. Fetch Organization Data
    try:
        org_object_id = ObjectId(org_id)
    except Exception: # Catches BSONError if org_id is not a valid ObjectId string
        logger.error(f"Invalid org_id format: {org_id} when requested by user {user_id_from_token}")
        raise HTTPException(status_code=400, detail=f"Invalid organization ID format: {org_id}")

    organization_doc = await db.organizations.find_one({"_id": org_object_id})
    if not organization_doc:
        logger.warning(f"Organization with id {org_id} not found when requested by user {user_id_from_token}.")
        raise HTTPException(status_code=404, detail=f"Organization with id {org_id} not found.")

    # 3. Extract Usage Quota
    usage_quota_data = organization_doc.get("usage_quota", {}) # Default to empty dict if 'usage_quota' field doesn't exist
    total_limit = usage_quota_data.get("total_limit", 0) # Default to 0 if 'total_limit' doesn't exist
    used = usage_quota_data.get("used", 0) # Default to 0 if 'used' doesn't exist

    logger.info(f"Successfully retrieved usage for org {org_id} by user {user_id_from_token}. Usage: {used}/{total_limit}")
    return OrganizationUsageResponse(total_limit=total_limit, used=used)


@router.get("/{org_id}/quota-details", response_model=OrgQuotaDetailsResponse)
async def get_organization_quota_details(org_id: str, current_user_tuple=Depends(get_current_user)):
    user_id_from_token, _, _ = current_user_tuple

    # 1. Authorization
    user_doc = await db.users.find_one({"_id": ObjectId(user_id_from_token)})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")

    user_role = user_doc.get("role")
    user_org_id_db = str(user_doc.get("organization_id")) if user_doc.get("organization_id") else None

    authorized = False
    if user_role == "admin":
        # Admin can view any org's quota details
        authorized = True
    elif user_role == "organization_head" and user_org_id_db == org_id:
        # Org head can view their own org's quota details
        authorized = True

    if not authorized:
        raise HTTPException(status_code=403, detail="User not authorized to view these quota details.")

    # 2. Fetch Organization Data
    org_object_id = ObjectId(org_id)
    organization_doc = await db.organizations.find_one({"_id": org_object_id})
    if not organization_doc:
        raise HTTPException(status_code=404, detail=f"Organization with id {org_id} not found.")

    org_quota_data = organization_doc.get("usage_quota", {})
    org_info = OrgQuotaInfo(
        id=str(organization_doc["_id"]),
        name=organization_doc["name"],
        total_quota_limit=org_quota_data.get("total_limit", 0),
        total_quota_used=org_quota_data.get("used", 0)
    )

    # 3. Fetch Users Data for the Organization
    org_users_cursor = db.users.find({"organization_id": org_object_id})
    users_list_info = []
    async for user_db_doc in org_users_cursor:
        user_quota_data = user_db_doc.get("quota", {})
        users_list_info.append(UserQuotaInfo(
            id=str(user_db_doc["_id"]),
            name=user_db_doc.get("name", "N/A"),
            email=user_db_doc["email"],
            monthly_limit=user_quota_data.get("monthly_limit", 0),
            monthly_used=user_quota_data.get("used", 0)
        ))

    return OrgQuotaDetailsResponse(
        organization=org_info,
        users=users_list_info
    )

@router.patch("/{org_id}/users/{user_db_id}/quota", response_model=UserQuotaInfo)
async def update_single_user_quota(
    org_id: str,
    user_db_id: str,
    payload: UserQuotaUpdatePayload,
    current_user_tuple=Depends(get_current_user)
):
    user_id_from_token, _, _ = current_user_tuple

    # 1. Authorization
    actor_user_doc = await db.users.find_one({"_id": ObjectId(user_id_from_token)})
    if not actor_user_doc:
        raise HTTPException(status_code=404, detail="Requesting user not found.")

    user_role = actor_user_doc.get("role")
    actor_org_id_db = str(actor_user_doc.get("organization_id")) if actor_user_doc.get("organization_id") else None

    authorized = False
    if user_role == "admin":
        authorized = True
    elif user_role == "organization_head" and actor_org_id_db == org_id:
        authorized = True

    if not authorized:
        raise HTTPException(status_code=403, detail="User not authorized to update quotas for this organization.")

    # 2. Fetch Target User & Validate
    target_user_obj_id = ObjectId(user_db_id)
    target_user_doc = await db.users.find_one({"_id": target_user_obj_id})
    if not target_user_doc:
        raise HTTPException(status_code=404, detail=f"Target user with ID {user_db_id} not found.")

    if str(target_user_doc.get("organization_id")) != org_id:
        raise HTTPException(status_code=400, detail=f"Target user {user_db_id} does not belong to organization {org_id}.")

    # 3. Fetch Organization
    org_object_id = ObjectId(org_id)
    organization_doc = await db.organizations.find_one({"_id": org_object_id})
    if not organization_doc:
        # This should ideally not happen if previous checks are fine, but good for robustness
        raise HTTPException(status_code=404, detail=f"Organization with ID {org_id} not found.")

    # 4. Payload Validation (already handled by Pydantic model for monthly_limit >= 0)
    # No specific check needed here for payload.monthly_limit >= 0 due to Pydantic model

    # 5. Total Quota Validation
    organization_total_limit = organization_doc.get("usage_quota", {}).get("total_limit", 0)

    other_users_cursor = db.users.find({
        "organization_id": org_object_id,
        "_id": {"$ne": target_user_obj_id} # Exclude the target user
    })

    sum_other_users_limits = 0
    async for other_user in other_users_cursor:
        sum_other_users_limits += other_user.get("quota", {}).get("monthly_limit", 0)

    total_proposed_user_limits = sum_other_users_limits + payload.monthly_limit

    if total_proposed_user_limits > organization_total_limit:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Proposed total user quotas ({total_proposed_user_limits}) would exceed "
                f"the organization's total quota limit ({organization_total_limit}). "
                f"Current sum of other users' limits: {sum_other_users_limits}."
            )
        )

    # 6. Database Update
    # We need to ensure the 'quota' field exists. If not, create it.
    # Using $set for "quota.monthly_limit" will create 'quota' if it doesn't exist,
    # but it might be better to ensure the full quota structure if it's entirely missing.
    # For now, assuming 'quota' object might exist or `.` notation handles it.
    # A more robust update might look like:
    # current_quota = target_user_doc.get("quota", {})
    # current_quota["monthly_limit"] = payload.monthly_limit
    # await db.users.update_one({"_id": target_user_obj_id}, {"$set": {"quota": current_quota}})
    # However, the simpler "$set": {"quota.monthly_limit": ...} works if "quota" object already exists.
    # If quota can be null or not present, a more careful update is needed.
    # Let's ensure 'quota' exists and then update 'monthly_limit'

    update_result = await db.users.update_one(
        {"_id": target_user_obj_id},
        {"$set": {"quota.monthly_limit": payload.monthly_limit}}
        # Consider if quota.used should be reset or checked against new limit
    )

    if update_result.matched_count == 0: # Should not happen if user was fetched
        raise HTTPException(status_code=404, detail="Target user not found during update attempt.")

    # 7. Response
    updated_user_doc = await db.users.find_one({"_id": target_user_obj_id})
    updated_user_quota_data = updated_user_doc.get("quota", {})

    return UserQuotaInfo(
        id=str(updated_user_doc["_id"]),
        name=updated_user_doc.get("name", "N/A"),
        email=updated_user_doc["email"],
        monthly_limit=updated_user_quota_data.get("monthly_limit", 0),
        monthly_used=updated_user_quota_data.get("used", 0) # 'used' is not modified by this endpoint
    )

# Moved get_org_with_users to the end of GET routes with similar path structure
@router.get("/{org_id}")
async def get_org_with_users(org_id: str, user_id: str = Depends(verify_token)): # user_id from token is admin making request
    actor_user_doc = await db.users.find_one({"_id": ObjectId(user_id)}) # Renamed to actor_user_doc for clarity
    if not actor_user_doc or (actor_user_doc["role"] != "admin" and actor_user_doc["role"] != "organization_head"): # Ensure requesting user is admin
        raise HTTPException(status_code=403, detail="User not authorized for this action.")

    org_obj_id = ObjectId(org_id) # Renamed for clarity
    org = await db.organizations.find_one({"_id": org_obj_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Fetch users belonging to the organization
    org_users = await db.users.find({"organization_id": org_obj_id}).to_list(length=None) # Renamed for clarity, fetch all

    # The following enrichment logic can remain similar, ensuring variable names are consistent
    billing_history = []
    usage_logs = await db["usage"].find({
        "user_id": {"$in": [str(u["_id"]) for u in org_users]}, # Use org_users
        "timestamp": {"$gte": datetime.utcnow().replace(day=1)}
    }).to_list(None)

    usage_map = defaultdict(int)
    for log in usage_logs:
        usage_map[log["user_id"]] += log.get("tokens_used", 0)

    if "stripe_customer_id" in org:
        try:
            invoices = stripe.Invoice.list(customer=org["stripe_customer_id"], limit=10)
            for inv in invoices.auto_paging_iter():
                billing_history.append({
                    "date": datetime.fromtimestamp(inv["created"]).strftime("%Y-%m-%d"),
                    "amount": round(inv["amount_paid"] / 100, 2),
                    "status": inv["status"],
                    "plan": inv.get("lines", {}).get("data", [{}])[0].get("plan", {}).get("nickname", "Unknown")
                })
        except Exception as e:
            # Log stripe error, but don't fail the whole request
            print(f"Error fetching Stripe invoices: {e}")


    # Fetch assistant counts for users in this org
    # Assuming assistants collection has 'created_by' field linking to user ObjectId
    # And 'org_id' field linking to organization ObjectId
    assistant_counts = await db.assistants.aggregate([
        {"$match": {"org_id": str(org_obj_id)}}, # Match assistants by org_id
        {"$group": {"_id": "$created_by", "count": {"$sum": 1}}} # Group by user who created assistant
    ]).to_list(None)

    assistant_map = {item["_id"]: item["count"] for item in assistant_counts}

    processed_users = []
    for u_doc in org_users: # Iterate over org_users
        uid_str = str(u_doc["_id"])
        # Create a dictionary from the BSON document for modification
        user_data_dict = dict(u_doc)
        user_data_dict["monthly_usage"] = usage_map.get(uid_str, 0)
        user_data_dict["assistant_count"] = assistant_map.get(uid_str, 0) # Assuming created_by is string of user_id
        processed_users.append(User(user_data_dict)) # Use User model for consistent response

    return {
        "org": {
            "_id": str(org["_id"]), # Ensure org ID is string
            "name": org["name"],
            "plan": org.get("plan", "free"),
            "quota": org.get("usage_quota", {}),
            "billing_history": billing_history
        },
        "users": processed_users, # Return list of User model instances
    }
