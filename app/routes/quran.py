from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from camel_tools.utils.dediac import dediac_ar
from camel_tools.utils.normalize import normalize_unicode, normalize_alef_maksura_ar, normalize_teh_marbuta_ar
from bson import ObjectId

from app.db import db
from app.utils.auth import get_current_user
import re

class Ayah(BaseModel):
    surah: int
    verse: int

class LemmaEntry(BaseModel):
    lemma: str
    lemma_ar: str
    ayahs: List[Ayah]


router = APIRouter(prefix="/quran", tags=["quran"])


INVISIBLE_CHARS = ''.join(chr(c) for c in range(0x200B, 0x200F + 1))  # includes ZWNJ, etc.
INVISIBLE_RE = re.compile(f"[{re.escape(INVISIBLE_CHARS)}]")

def strip_diacritics(text: str) -> str:
    text = normalize_unicode(text)
    text = normalize_alef_maksura_ar(text)
    text = normalize_teh_marbuta_ar(text)
    text = dediac_ar(text)
    text = INVISIBLE_RE.sub("", text)  # remove ZWNJ or Tatweel
    return text

class TreeNode(BaseModel):
    id: str
    name: str
    children: Optional[List[Any]] = None

@router.get("/quran_root_tree", response_model=List[TreeNode])
async def get_quran_root_tree(
    language: str = Query("arabic", enum=["arabic", "english"]),
    search: Optional[str] = None
):
    """
    Return tree: root → lemma → form → [verses] from quran_root_words collection.
    """
    doc = await db.quran_root_words.find_one({})
    if not doc or language not in doc:
        return []

    data = doc[language]
    search_norm = strip_diacritics(search.strip().lower()) if search else None

    tree: List[TreeNode] = []
    for root, lemmas in data.items():
        root_norm = strip_diacritics(root.lower())
        if search_norm and not root_norm.startswith(search_norm):
            continue

        lemma_children = []
        for lemma, forms in lemmas.items():
            lemma_norm = strip_diacritics(lemma.lower())
            if search_norm and search_norm not in lemma_norm:
                continue

            form_children = []
            for form, verses in forms.items():
                form_norm = strip_diacritics(form.lower())
                if search_norm and search_norm not in form_norm:
                    continue

                form_children.append(TreeNode(
                    id=f"{root}|{lemma}|{form}",
                    name=form,
                    children=[TreeNode(id=v, name=v) for v in verses]
                ))

            if form_children:
                lemma_children.append(TreeNode(
                    id=f"{root}|{lemma}",
                    name=lemma,
                    children=form_children
                ))

        if lemma_children:
            tree.append(TreeNode(
                id=root,
                name=root,
                children=lemma_children
            ))
    return tree
#Create a endpoint that will fetch the verses from verses_collection by reference
@router.get("/find_ayat", response_model=dict)
async def get_verses_by_reference(reference: str = Query(..., description="e.g. 2:255"),
                                  current_user=Depends(get_current_user)) -> Any:
    """
    Fetch a full ayah by its reference (e.g., "2:255").
    Returns verse text, translation, root words, etc.
    """
    if not reference:
        raise HTTPException(status_code=400, detail="Reference is required.")

    try:
        surah, verse = map(int, reference.strip().split(":"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid reference format. Use surah:ayah like 2:255.")
    print(f"Fetching verse for reference: {reference}")
    doc = await db.verses.find_one({"reference": reference})
    if not doc:
        raise HTTPException(status_code=404, detail="Verse not found.")

    return {
        "verse": doc.get("verse"),
        "reference": doc.get("reference"),
        "translation_en": doc.get("translation_en"),
        "translation_ar": doc.get("translation_ar"),
        "root_words": doc.get("root_words", []),
        "keywords_en": doc.get("keywords_en", ""),
        "keywords_ar": doc.get("keywords_ar", ""),
        "summary_en": doc.get("summary_en", ""),
        "summary_ar": doc.get("summary_ar", "")
    }
    
@router.get("/topics", response_model=List[dict])
async def get_quran_topics(query: Optional[str] = None):
    """
    Return list of Quran topics and subtopics, optionally filtered by query (Arabic or English).
    """
    raw_topics = await db.topics.find().to_list(None)
    topics = [{k: v for k, v in t.items() if k != "_id"} for t in raw_topics]  # remove _id

    if query:
        query = strip_diacritics(query.strip().lower())
        filtered = []
        for topic in topics:
            topic_en = topic.get("topic_en", "").lower()
            topic_ar = strip_diacritics(topic.get("topic_ar", ""))
            if query in topic_en or query in topic_ar:
                filtered.append(topic)
            else:
                matched_subs = []
                for sub in topic.get("subtopics", []):
                    if (
                        query in sub.get("sub_topic_en", "").lower()
                        or query in strip_diacritics(sub.get("sub_topic_ar", ""))
                    ):
                        matched_subs.append(sub)
                if matched_subs:
                    topic["subtopics"] = matched_subs
                    filtered.append(topic)
        return filtered

    return topics 


@router.get("/topics/{id}")
async def get_topic_detail(id: str):
    
    topic = await db.topics.find_one({"topic_en": id})
    if not topic:
        topic = await db.topics.find_one({"topic_ar": id})

    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Convert ObjectId to string for JSON
    topic["_id"] = str(topic["_id"])
    return topic