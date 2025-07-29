from email.message import EmailMessage
import smtplib
import datetime

from app.utils.notifier import send_email

def send_invite_email(to_email, invite_link):
    year = datetime.datetime.utcnow().year
    html = open("templates/invite_email.html", "r").read()
    html = html.replace("{{INVITE_LINK}}", invite_link).replace("{{CURRENT_YEAR}}", str(year))

    msg = EmailMessage()
    msg["Subject"] = "You're Invited to Join QuranAI"
    msg["From"] = "noreply@yourdomain.com"
    msg["To"] = to_email
    msg.set_content(f"You're invited to QuranAI. Click here: {invite_link}")
    msg.add_alternative(html, subtype="html")

    with smtplib.SMTP("smtp.gmail.com", 587) as smtp:
        smtp.starttls()
        smtp.login("developer@dccme.ai", "yfen ping pjfh emkp")
        smtp.send_message(msg)
        

def send_cancel_email(to_email, org_name, dashboard_url):
    year = datetime.utcnow().year
    today = datetime.utcnow().strftime("%Y-%m-%d")

    with open("templates/subscription_cancelled.html") as f:
        html = f.read()

    html = html.replace("{{ORG_NAME}}", org_name)
    html = html.replace("{{CANCEL_DATE}}", today)
    html = html.replace("{{DASHBOARD_URL}}", dashboard_url)
    html = html.replace("{{YEAR}}", str(year))

    send_email(to_email, "❌ QuranAI Subscription Cancelled", html)