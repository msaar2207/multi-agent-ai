from openai import OpenAI
from app.config import settings

client = OpenAI(api_key=settings.OPENAI_API_KEY)

def generate_chat_title(prompt: str) -> str:
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "Generate a short title summarizing this question."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=12,
    )
    return response.choices[0].message.content.strip().strip("\"")