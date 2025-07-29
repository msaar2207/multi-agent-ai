import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call
from bson import ObjectId
from fastapi import UploadFile, HTTPException
from typing import List, Tuple, Dict, Any

# Assuming the app structure for imports:
from app.routes.assistant import org_upload_file_to_openai # Target for first test
from app.services.questionnaire import process_questionnaire_rag # Target for second test
from app.schemas.assistant import AssistantUpdate # If needed
from app.utils.auth import get_current_user # To mock dependency

# Dummy IDs for testing
TEST_ORG_ID = str(ObjectId())
TEST_USER_ID = str(ObjectId())
TEST_ASSISTANT_ID = str(ObjectId())
TEST_VECTOR_STORE_ID = "vs_test_vector_store_id"
MOCK_OPENAI_FILE_ID = "file_mock_openai_id_123"

@pytest.fixture
def mock_user_org():
    """Fixture to provide a mock user and organization ID."""
    return {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "role": "organization_head", # Role that allows upload
        "email": "testuser@example.com"
    }

@pytest.fixture
def mock_assistant_with_vector_store(mock_user_org):
    """Fixture to provide a mock assistant document with a vector store ID."""
    return {
        "_id": ObjectId(TEST_ASSISTANT_ID),
        "org_id": ObjectId(mock_user_org["org_id"]),
        "name": "Test Assistant",
        "openai_assistant_id": "oa_test_assistant_id",
        "vector_store_id": TEST_VECTOR_STORE_ID,
        "file_ids": [], # Starts with no files
        "created_by": ObjectId(mock_user_org["user_id"]),
    }

@pytest.mark.asyncio
async def test_successful_document_upload_and_vector_store_update(mock_user_org, mock_assistant_with_vector_store):
    """
    Test successful document upload, OpenAI file creation, DB document insertion,
    and subsequent update of the assistant's vector store and file_ids list.
    """
    mock_file = MagicMock(spec=UploadFile)
    mock_file.filename = "test_document.pdf"
    mock_file.content_type = "application/pdf"
    mock_file_content = b"This is a test PDF content."
    mock_file.read = AsyncMock(return_value=mock_file_content)
    # mock_file.seek = AsyncMock() # If seek is used

    # Mock get_current_user dependency
    async def mock_get_current_user():
        return (mock_user_org["user_id"], mock_user_org["role"], mock_user_org["email"])

    with patch("app.routes.assistant.db", new_callable=MagicMock) as mock_db, \
         patch("app.routes.assistant.openai_client", new_callable=MagicMock) as mock_openai_client, \
         patch("app.routes.assistant.get_current_user", side_effect=mock_get_current_user) as mock_user_dependency, \
         patch("app.routes.assistant.asyncio.to_thread", new_callable=AsyncMock) as mock_to_thread:

        # Setup mock return values for OpenAI client calls
        # openai_client.files.create
        mock_openai_file_create_response = MagicMock()
        mock_openai_file_create_response.id = MOCK_OPENAI_FILE_ID

        # Configure the mock_to_thread to handle different calls
        # The first call to to_thread in the function is openai_client.files.create
        # The subsequent calls will be for openai_client.beta.vector_stores.files.create

        # Default mock for any to_thread call (can be overridden by side_effect list)
        mock_async_openai_call_result = AsyncMock()

        # Specific mock for openai_client.files.create
        async def files_create_side_effect(*args, **kwargs):
            # Simulate the behavior of openai_client.files.create
            # args[0] would be the function passed to to_thread, e.g., openai_client.files.create
            # args[1:] and kwargs would be its arguments
            if args[0] == mock_openai_client.files.create:
                return mock_openai_file_create_response
            elif args[0] == mock_openai_client.beta.vector_stores.files.create:
                 # For vector_stores.files.create, return a generic success mock or specific if needed
                mock_vs_file_create_response = MagicMock()
                mock_vs_file_create_response.id = "vsf_mock_id" # Vector store file ID
                return mock_vs_file_create_response
            return AsyncMock() # Default for other to_thread calls if any

        mock_to_thread.side_effect = files_create_side_effect

        # Mock DB calls
        mock_db["users"].find_one = AsyncMock(return_value={
            "_id": ObjectId(mock_user_org["user_id"]),
            "organization_id": ObjectId(mock_user_org["org_id"]),
            "role": mock_user_org["role"]
        })
        mock_db["documents"].insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))

        # Mock assistants find to return a cursor-like object
        mock_assistants_cursor = MagicMock()
        mock_assistants_cursor.to_list = AsyncMock(return_value=[mock_assistant_with_vector_store]) # Old way
        # New way: make it an async iterator
        async def async_iterator_side_effect(*args, **kwargs):
            yield mock_assistant_with_vector_store

        mock_db["assistants"].find = MagicMock(return_value=AsyncMock()) # outer mock for find
        mock_db["assistants"].find.return_value.__aiter__ = async_iterator_side_effect # make it an async iterable


        mock_db["assistants"].update_one = AsyncMock()

        # Call the function under test
        results = await org_upload_file_to_openai(
            org_id=mock_user_org["org_id"],
            files=[mock_file],
            current_user=await mock_get_current_user() # Simulate Depends
        )

        # Assertions
        assert len(results) == 1
        assert results[0]["status"] == "success"
        assert results[0]["file_info"]["openai_file_id"] == MOCK_OPENAI_FILE_ID

        # Assert that to_thread was called for openai_client.files.create
        # The first argument to to_thread is the function to run in a thread
        assert any(call_args[0][0] == mock_openai_client.files.create for call_args in mock_to_thread.call_args_list)

        mock_db["documents"].insert_one.assert_called_once()
        # Example: Check some part of the inserted document
        inserted_doc_call = mock_db["documents"].insert_one.call_args[0][0]
        assert inserted_doc_call["openai_file_id"] == MOCK_OPENAI_FILE_ID
        assert inserted_doc_call["organization_id"] == mock_user_org["org_id"]

        mock_db["assistants"].find.assert_called_once_with({"org_id": ObjectId(mock_user_org["org_id"])})

        # Assert that to_thread was called for openai_client.beta.vector_stores.files.create
        assert any(
            call_args[0][0] == mock_openai_client.beta.vector_stores.files.create and
            call_args[1]['vector_store_id'] == TEST_VECTOR_STORE_ID and
            call_args[1]['file_id'] == MOCK_OPENAI_FILE_ID
            for call_args in mock_to_thread.call_args_list
        )

        mock_db["assistants"].update_one.assert_called_once_with(
            {"_id": ObjectId(TEST_ASSISTANT_ID)},
            {"$addToSet": {"file_ids": MOCK_OPENAI_FILE_ID}}
        )

@pytest.mark.asyncio
async def test_questionnaire_processing_with_new_document(mock_user_org, mock_assistant_with_vector_store):
    """
    Test processing a questionnaire using process_questionnaire_rag with a document
    that should be found in the (mocked) vector store.
    """
    mock_file_bytes = b"This is the content of the uploaded questionnaire."
    mock_filename = "questionnaire.pdf"

    # Update mock assistant to have the file ID (as if it was uploaded)
    assistant_with_file = {**mock_assistant_with_vector_store, "file_ids": [MOCK_OPENAI_FILE_ID]}

    # Mock file_map for process_questionnaire_rag
    # This map usually links OpenAI file IDs to local paths or other identifiers.
    # For this test, we just need it to contain our mock file ID.
    mock_file_map = {MOCK_OPENAI_FILE_ID: "dummy_path_or_identifier_for_test_document.pdf"}

    # Mocks for app.services.questionnaire
    with patch("app.services.questionnaire._extract_text", return_value="Extracted text from PDF.") as mock_extract_text, \
         patch("app.services.questionnaire._extract_questions", return_value=["What is test?"]) as mock_extract_questions, \
         patch("app.services.questionnaire._query_vector_store", new_callable=AsyncMock) as mock_query_vector_store, \
         patch("app.services.questionnaire._generate_answer", new_callable=AsyncMock) as mock_generate_answer, \
         patch("app.services.questionnaire.openai_client", new_callable=MagicMock) as mock_q_openai_client: # Mock client in questionnaire service

        # Setup _query_vector_store mock
        # It should return (found_paragraph, filename_of_source, source_paragraph_text)
        mock_query_vector_store.return_value = ("Found relevant paragraph.", "test_document.pdf", "Source paragraph text.")

        # Setup _generate_answer mock
        mock_generate_answer.return_value = "This is the generated answer."

        # Call the function under test
        # process_questionnaire_rag(file_bytes, filename, vector_store_id, file_map, client, max_tokens=8192)
        results = await process_questionnaire_rag(
            file_bytes=mock_file_bytes,
            filename=mock_filename,
            vector_store_id=assistant_with_file["vector_store_id"],
            file_map=mock_file_map, # Pass the mock_file_map
            client=mock_q_openai_client # Pass the mocked openai client for the service
        )

        # Assertions
        mock_extract_text.assert_called_once_with(mock_file_bytes, mock_filename)
        mock_extract_questions.assert_called_once_with("Extracted text from PDF.")

        mock_query_vector_store.assert_called_once()
        # Check specific args of _query_vector_store call
        call_args_query_vs = mock_query_vector_store.call_args[0]
        assert call_args_query_vs[1] == assistant_with_file["vector_store_id"] # Check vector_store_id
        assert "What is test?" in call_args_query_vs[0] # Check if question is in the query

        mock_generate_answer.assert_called_once()
         # Check specific args of _generate_answer call
        call_args_generate_answer = mock_generate_answer.call_args[0]
        assert "What is test?" in call_args_generate_answer[0] # question
        assert "Found relevant paragraph." in call_args_generate_answer[1] # context

        assert len(results) == 1
        assert results[0]["question"] == "What is test?"
        assert results[0]["answer"] == "This is the generated answer."
        assert results[0]["source_filename"] == "test_document.pdf"
        assert results[0]["source_paragraph"] == "Source paragraph text."
        assert "No matching information found" not in results[0]["answer"]

# Placeholder for other tests if needed
# For example, test cases for when a file is already in the vector store,
# or when an assistant doesn't have a vector_store_id.
# Or when _query_vector_store finds no paragraph.

# To run these tests (from the project root, assuming pytest is installed):
# Ensure PYTHONPATH is set up if needed, e.g., export PYTHONPATH=.
# pytest tests/routes/test_assistant_document_workflow.py
