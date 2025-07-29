class Chat:
    def __init__(self, data):
        self.id = str(data.get('_id'))
        self.title = data['title']
        self.user_id = str(data['user_id'])
        self.messages = data.get('messages', [])