import os
from app.routes.assistant import OPENAI_HEADERS
import httpx
from typing import List
from PyPDF2 import PdfReader
from docx import Document
from fastapi import UploadFile

from app.config import settings

OPENAI_API = "https://api.openai.com/v1"
HEADERS = {
    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
    "OpenAI-Beta": "assistants=v2"
}

timeout = httpx.Timeout(100.0, connect=10.0, read=30.0)
class OpenAIAdminService:

    @staticmethod
    async def upload_files(files: List[bytes], filenames: List[str]) -> List[str]:
        file_ids = []
        async with httpx.AsyncClient(timeout=timeout) as client:
            for content, name in zip(files, filenames):
                if not content.strip():
                    print(f"⚠️ Skipping empty chunk: {name}")
                    continue

                try:
                    print(f"📤 Uploading: {name} ({len(content)} bytes)")
                    resp = await client.post(
                        "https://api.openai.com/v1/files",
                        headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                        data={"purpose": "assistants"},
                        files={"file": (name, content)}
                    )
                    resp.raise_for_status()
                    file_id = resp.json()["id"]
                    file_ids.append(file_id)
                    print(f"✅ Uploaded {name} → {file_id}")
                except httpx.HTTPStatusError as e:
                    print(f"❌ Upload failed for {name}: {e.response.status_code} - {e.response.text}")
                except httpx.RequestError as e:
                    print(f"❌ Network error during upload of {name}: {str(e)}")

        return file_ids

    
    @staticmethod
    def extract_text_from_docx(file_path: str) -> str:
        doc = Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs]).strip()

    @staticmethod
    async def create_vector_store() -> str:
        """Create a new empty vector store."""
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{OPENAI_API}/vector_stores",
                headers=HEADERS,
                json={}
            )
            resp.raise_for_status()
            return resp.json()["id"]

    @staticmethod
    async def attach_files_to_vector_store(vector_store_id: str, file_ids: List[str]):
        """Attach previously uploaded files to the vector store, with per-file logging and timeout handling."""
        async with httpx.AsyncClient(timeout=timeout) as client:
            for file_id in file_ids:
                try:
                    resp = await client.post(
                        f"{OPENAI_API}/vector_stores/{vector_store_id}/files",
                        headers=HEADERS,
                        json={"file_id": file_id}
                    )
                    resp.raise_for_status()
                    print(f"✅ Attached file {file_id} to vector store {vector_store_id}")
                except httpx.RequestError as e:
                    print(f"❌ Timeout or network error while attaching file {file_id}: {str(e)}")
                except httpx.HTTPStatusError as e:
                    print(f"❌ Failed to attach file {file_id}: {e.response.status_code} - {e.response.text}")

    @staticmethod
    async def create_assistant_with_vector_store(
        name: str,
        model_name: str,
        instructions: str,
        file_ids: List[str]
    ) -> dict:
        """Create an Assistant using a vector store populated with uploaded files."""
        vector_store_id = await OpenAIAdminService.create_vector_store()
        await OpenAIAdminService.attach_files_to_vector_store(vector_store_id, file_ids)

        async with httpx.AsyncClient(timeout=timeout) as client:
            payload = {
                "name": name,
                "instructions": instructions,
                "model": model_name or settings.OPENAI_DEFAULT_MODEL,
                "tools": [{"type": "file_search"}],
                "tool_resources": {
                    "file_search": {
                        "vector_store_ids": [vector_store_id]
                    }
                }
            }
            resp = await client.post(
                f"{OPENAI_API}/assistants",
                headers={**HEADERS, "Content-Type": "application/json"},
                json=payload
            )
            resp.raise_for_status()
            return {
                "assistant_id": resp.json()["id"],
                "vector_store_id": vector_store_id
            }
            
    # --- Text chunking ---
    @staticmethod
    def chunk_text(text: str, max_tokens: int = 4000) -> List[str]:
        return [text[i:i+max_tokens] for i in range(0, len(text), max_tokens)]

    # --- PDF loader ---
    @staticmethod
    def extract_text_from_pdf(file_path: str) -> str:
        reader = PdfReader(file_path)
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return text.strip()

    @staticmethod
    async def delete_vector_store(vector_store_id: str):
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"https://api.openai.com/v1/vector_stores/{vector_store_id}",
                headers=OPENAI_HEADERS
            )
            resp.raise_for_status()
            return resp.json()
        

    @staticmethod
    async def chunk_and_append_to_vector_store(
        files: List[UploadFile], vector_store_id: str
    ) -> List[str]:
        all_file_ids = []

        for file in files:
            filename = file.filename
            extension = os.path.splitext(filename)[1].lower()
            temp_path = f"/tmp/{filename}"
            content = await file.read()

            with open(temp_path, "wb") as f_out:
                f_out.write(content)

            if extension == ".pdf":
                raw_text = OpenAIAdminService.extract_text_from_pdf(temp_path)
            elif extension in [".doc", ".docx"]:
                raw_text = OpenAIAdminService.extract_text_from_docx(temp_path)
            elif extension in [".txt", ".md"]:
                raw_text = content.decode("utf-8")
            else:
                raise ValueError(f"Unsupported file type: {extension}")

            os.remove(temp_path)

            chunks = OpenAIAdminService.chunk_text(raw_text)
            filenames = [f"{filename}_chunk_{i}.txt" for i in range(len(chunks))]
            chunk_bytes = [c.encode("utf-8") for c in chunks]

            file_ids = await OpenAIAdminService.upload_files(chunk_bytes, filenames)
            all_file_ids.extend(file_ids)

        # Attach to existing vector store
        await OpenAIAdminService.attach_files_to_vector_store(vector_store_id, all_file_ids)
        return all_file_ids
       
