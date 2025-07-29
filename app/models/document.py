class Document:
    def __init__(self, data):
        self.id = str(data['_id'])
        self.filename = data['filename']
        self.openai_file_id = data['openai_file_id']
        self.uploaded_at = data['created_at']