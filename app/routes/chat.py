from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from app.db import db
from app.schemas.chat import ChatCreate, ChatMessage, ChatResponse
from app.utils.auth import get_current_user


router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("/create", response_model=ChatResponse)
async def create_chat(chat: ChatCreate, user=Depends(get_current_user)):
    user_id, _ , email= user
    title = chat.title or "New Chat"
    doc = {
        "user_id": ObjectId(user_id),
        "title": title,
        "messages": [],
        "createdAt": datetime.utcnow()
    }
    result = await db.chats.insert_one(doc)
    return ChatResponse(id=str(result.inserted_id), title=title, messages=[])

@router.get("/history", response_model=List[ChatResponse])
async def get_user_chats(user=Depends(get_current_user)):
    user_id, _, email = user
    cursor = db.chats.find({"user_id": ObjectId(user_id)})
    chats = []
    async for doc in cursor:
        chats.append(ChatResponse(
            id=str(doc['_id']),
            title=doc['title'],
            messages=doc.get('messages', [])
        ))
    return chats

@router.patch("/{chat_id}")
async def rename_chat(chat_id: str, data: dict, user=Depends(get_current_user)):
    user_id, _ , email= user
    await db.chats.update_one(
        {"_id": ObjectId(chat_id), "user_id": ObjectId(user_id)},
        {"$set": {"title": data["title"]}}
    )
    return {"status": "updated"}

@router.post("/{chat_id}/message", response_model=ChatResponse)
async def post_message(chat_id: str, msg: ChatMessage, user=Depends(get_current_user)):
    user_id, _ , email= user
    chat = await db.chats.find_one({"_id": ObjectId(chat_id), "user_id": ObjectId(user_id)})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    await db.chats.update_one(
        {"_id": ObjectId(chat_id)},
        {"$push": {"messages": msg.dict()}}
    )
    chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
    return ChatResponse(
        id=str(chat['_id']),
        title=chat['title'],
        messages=chat.get('messages', [])
    )
    
@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(chat_id: str, user=Depends(get_current_user)):
    user_id, _ , email= user
    result = await db.chats.delete_one({"_id": ObjectId(chat_id), "user_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chat not found")    
    
@router.get("/find_ayat")
async def find_ayat(ref: str = Query(...), user=Depends(get_current_user)):
    print(f"Finding Ayat for reference: {ref}")
    doc = await db.verses.find_one({"reference": ref})
    if not doc:
        raise HTTPException(status_code=404, detail="Verse not found")

    return {
        "reference": ref,
        "arabic": doc.get("verse", ""),
        "translation": doc.get("translation_en", "")
    }    