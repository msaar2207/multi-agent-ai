from pydantic_settings import BaseSettings  # ✅ not from pydantic

class Settings(BaseSettings):
    MONGODB_URI: str
    JWT_SECRET: str
    OPENAI_API_KEY: str
    OPENAI_DEFAULT_MODEL: str = "gpt-4o"
    MAX_MONTHLY_TOKENS: int = 10000
    MAX_CHAT_TOKENS: int = 4096
    MAX_CHAT_HISTORY: int = 10
    JWT_EXPIRES_MINUTES: int = 60 * 24 * 2  # 2 days
    FRONT_END_URL: str = "http://gaztec.ddns.net:57330"
    # USAGE LIMITS
    FREE_TOKENS: int = 10000
    FREE_MESSAGES: int = 100
    BASIC_TOKENS: int = 50000
    BASIC_MESSAGES: int = 500
    PREMIUM_TOKENS: int = 200000
    PREMIUM_MESSAGES: int = 2000
    
    DEFAULT_LIMITS: dict = {
        "free": {"tokens": FREE_TOKENS, "messages": FREE_MESSAGES},
        "basic": {"tokens": BASIC_TOKENS, "messages": BASIC_MESSAGES},
        "premium": {"tokens": PREMIUM_MESSAGES, "messages": PREMIUM_MESSAGES}
    }
    
    #STRIPE
    STRIPE_SECRET_KEY: str
    STRIPE_WEBHOOK_SECRET: str
    PRO_PRICE_ID: str
    
    #SLACK
    SLACK_WEBHOOK_URL: str = "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
    SLACK_CHANNEL: str = "#increase-usage-quota"
    
    #SMTP
    MAIL_SERVER: str
    MAIL_PORT: int = 587
    SMTP_USERNAME: str
    SMTP_PASSWORD: str
    MAIL_FROM: str = "info@dccme.ai"
    # EMAIL SUBJECTS
    QUOTA_WARNING_SUBJECT: str = "🚨 Monthly Usage Quota Warning"
    
    class Config:
        env_file = ".env"

settings = Settings()
