from fastapi import APIRouter, Depends, HTTPException, Request
from bson import ObjectId
from datetime import datetime
from app.db import db
from app.schemas.user import UserCreate, UserLogin, UserOut
from app.utils.auth import get_current_user, hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/signup", response_model=UserOut)
async def signup(user: UserCreate):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = hash_password(user.password)
    result = await db.users.insert_one({"email": user.email, "password": hashed, "role": "user"})
    return UserOut(id=str(result.inserted_id), email=user.email, role="user")

@router.post("/login")
async def login(user: UserLogin):
    db_user = await db.users.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if db_user.get("role") == "admin":
        # If the user is an admin, allow login without further checks
        token = create_access_token(str(db_user["_id"]), db_user["role"], db_user["email"])
        return {"access_token": token}
    
    # Check organization status if user has an organization_id
    organization_id_val = db_user.get("organization_id")
    if organization_id_val:
        org_id_to_query = None
        if isinstance(organization_id_val, ObjectId):
            org_id_to_query = organization_id_val
        elif isinstance(organization_id_val, str):
            try:
                org_id_to_query = ObjectId(organization_id_val)
            except Exception:
                # TODO: Consider logging this error: logger.error(f"User {db_user['_id']} has invalid organization_id string format: {organization_id_val}")
                raise HTTPException(status_code=500, detail="Error verifying organization status [ID format].")
        else:
            # TODO: Consider logging this error: logger.error(f"User {db_user['_id']} has organization_id of unexpected type: {type(organization_id_val)}")
            raise HTTPException(status_code=500, detail="Error verifying organization status [ID type].")

        if not org_id_to_query:
             # This case should ideally be caught by the specific type checks above,
             # but as a safeguard if organization_id_val was present but resulted in no org_id_to_query (e.g. empty string processed)
             # logger.warning(f"User {db_user['_id']} has an organization_id value that resolved to None or empty: {organization_id_val}")
             raise HTTPException(status_code=500, detail="Error verifying organization status [ID resolution].")

        organization = await db.organizations.find_one({"_id": org_id_to_query})
        if not organization:
            # This means the user is linked to an organization that doesn't exist.
            # Log this inconsistency.
            # logger.warning(f"User {db_user['_id']} is linked to non-existent organization {organization_id_str}.")
            # Depending on policy, either allow login or deny. Denying is safer.
            raise HTTPException(status_code=403, detail="Organization not found. Please contact support.")

        if organization.get("is_active") is False: # Explicitly check for False
            raise HTTPException(status_code=403, detail="Your organization has been deactivated. Please contact support.")

    token = create_access_token(str(db_user["_id"]), db_user["role"], db_user["email"])
    return {"access_token": token}


@router.get("/me")
async def get_me(user=Depends(get_current_user)):
    user_id, role, email = user
    return { "user_id": str(user_id), "email": email, "role": role}

@router.get("/user_details")
async def get_details(user=Depends(get_current_user)):
    user_id, _, _ = user
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)}, {"password": 0})  # include _id for serialization

    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    # Convert all ObjectId fields to strings
    for key in user_doc:
        if isinstance(user_doc[key], ObjectId):
            user_doc[key] = str(user_doc[key])

    return user_doc

@router.post("/setup")
async def complete_invite(request: Request):
    body = await request.json()
    token = body.get("token")
    password = body.get("password")

    if not token or not password:
        raise HTTPException(status_code=400, detail="Missing token or password")

    user = await db.users.find_one({"invite_token": token, "status": "invited"})

    if not user:
        raise HTTPException(status_code=404, detail="Invite not found or already used")

    if user["invite_expiry"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invite token expired")

    hashed = hash_password(password)

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password": hashed,
                "status": "active"
            },
            "$unset": {
                "invite_token": "",
                "invite_expiry": ""
            }
        }
    )

    return {"message": "Account activated"}

