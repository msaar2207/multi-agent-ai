import re
from app.db import db
from app.utils.logger import logger

# Matches: (Al-Imran 3:190), (Surah Nisa 4:135-136), (Quran 31:10)
REFERENCE_REGEX = re.compile(r"\((?:[^\d]*\s)?(\d{1,3}):(\d{1,3})(?:[-–](\d{1,3}))?\)")

DEBUG = True

def ayah_sort_key(ref: str):
    surah, ayah = map(int, ref.split(":"))
    return (surah, ayah)

async def extract_footnotes(text: str):
    refs = set()

    for match in REFERENCE_REGEX.findall(text):
        surah_num = int(match[0])
        ayah_start = int(match[1])
        ayah_end = int(match[2]) if match[2] else ayah_start

        for i in range(ayah_start, ayah_end + 1):
            refs.add(f"{surah_num}:{i}")

    sorted_refs = sorted(refs, key=ayah_sort_key)

    if DEBUG:
        logger.debug(f"📌 Extracted references: {sorted_refs}")

    results = []
    for ref in sorted_refs:
        doc = await db.verses.find_one({"reference": ref})
        if doc:
            results.append({
                "reference": ref,
                "arabic": doc.get("verse", ""),
                "english": doc.get("translation_en", ""),
            })
        else:
            logger.warning(f"⚠️ No match found in DB for: {ref}")

    return results
