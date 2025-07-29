import requests
import smtplib
from email.message import EmailMessage
from app.config import settings

def send_slack_alert(message: str):
    if not settings.SLACK_WEBHOOK_URL:
        return
    requests.post(settings.SLACK_WEBHOOK_URL, json={"text": message})

def send_email(to_email: str, subject: str, html: str):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.MAIL_FROM
    msg["To"] = to_email
    msg.set_content("This email requires HTML support.")
    msg.add_alternative(html, subtype="html")

    with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT) as smtp:
        smtp.starttls()
        smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(msg)
