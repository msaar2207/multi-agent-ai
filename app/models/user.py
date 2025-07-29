class User:

    def __init__(self, data):
            self.id = str(data.get('_id'))
            self.email = data['email']
            self.name = data.get('name', 'Unknown User')
            self.created_at = data.get('created_at', None)
            self.updated_at = data.get('updated_at', None)
            self.is_active = data.get('is_active', True)
            self.is_verified = data.get('is_verified', False)
            self.role = data.get('role', 'user')  # Can be 'organization_head' or 'organization_user'

            # New fields for organization and agent
            self.organization_id = str(data.get('organization_id')) if data.get('organization_id') else None
            self.agent_id = str(data.get('agent_id')) if data.get('agent_id') else None

            self.quota = data.get('quota', {
                "monthly_limit": 10000,
                "used": 0,
                "reset_date": None
            })