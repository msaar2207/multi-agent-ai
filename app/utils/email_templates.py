import os
from datetime import datetime
from app.utils.notifier import send_email  # assumes you already use this

TEMPLATE_DIR = "templates/email"

def render_template(template_name: str, context: dict) -> str:
    path = os.path.join(TEMPLATE_DIR, template_name)
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    # Inject default variables
    context.setdefault("YEAR", str(datetime.utcnow().year))

    # Replace {{KEY}} placeholders
    for key, val in context.items():
        html = html.replace(f"{{{{{key}}}}}", str(val))

    return html
