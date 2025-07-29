
class Organization:
    def __init__(self, data):
        self.id = str(data.get('_id'))
        self.name = data.get('name')
        self.head_user_id = str(data.get('head_user_id'))
        self.usage_quota = data.get('usage_quota', {
            "total_limit": 100000,
            "used": 0,
            "reset_date": None
        })
        self.agents = data.get('agents', [])
        self.is_active = data.get('is_active', True)