# GEM AI Assistant

A full-stack AI-powered assistant that answers questions grounded using Retrieval-Augmented Generation (RAG). Built with FastAPI, MongoDB, OpenAI Assistants API, and a modern Next.js + Tailwind UI.

---

## 🌟 Features

- 🧠 **Centric RAG**: Answers are generated using context from uploaded documents
- 📁 **File Upload**: Upload PDFs, DOCX, TXT – files are chunked and embedded automatically.
- 🔍 **Semantic Search**: Finds the most relevant verses or documents using OpenAI vector stores.
- 📜 **Streaming Chat UI**: ChatGPT-style interface with live typing, footnotes, and reference blocks.
- 👤 **User Auth & Roles**: JWT-secured login and admin panel for managing assistants.
- 🌙 **Dark Mode & Mobile Friendly**: Clean, responsive layout with theme toggle.

---

## 🧰 Tech Stack

| Layer         | Tools                                 |
|---------------|----------------------------------------|
| Frontend      | Next.js, React, TailwindCSS, React Markdown |
| Backend       | FastAPI, Python, OpenAI Assistants API |
| Vector Search | OpenAI File + Vector Store APIs        |
| Database      | MongoDB with Motor (async)             |
| Auth          | JWT (with FastAPI security middleware) |

---

## 🚀 Getting Started

### 1. Clone the Repo

```bash
git clone https://github.com/your-username/quran-rag-ai.git
cd quran-rag-ai

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt 
python -m uvicorn app.main:app --host 0.0.0.0 --reload --port 8001
