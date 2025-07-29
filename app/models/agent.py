
from datetime import datetime

class Agent:
    def __init__(self, data):
        self.id = str(data.get('_id'))
        self.name = data.get('name')
        # Ensure org_id from DB is mapped to organization_id and converted to string
        self.organization_id = str(data.get('org_id')) if data.get('org_id') else None

        # Ensure created_by from DB is converted to string
        self.created_by = str(data.get('created_by')) if data.get('created_by') else None

        self.instructions = data.get('instructions', "You are a helpful assistant.") # Replaces default_prompt

        # file_ids are expected to be a list of OpenAI File IDs
        self.file_ids = data.get('file_ids', [])

        self.openai_assistant_id = data.get('openai_assistant_id')
        self.vector_store_id = data.get('vector_store_id', None) # Can be None if no files were attached

        # Handle created_at, which might be a datetime object or a string
        created_at_data = data.get('created_at')
        if isinstance(created_at_data, datetime):
            self.created_at = created_at_data
        elif isinstance(created_at_data, str):
            try:
                self.created_at = datetime.fromisoformat(created_at_data.replace("Z", "+00:00")) # Handle ISO format
            except ValueError:
                self.created_at = None # Or some other default/error handling
        else:
            self.created_at = None
