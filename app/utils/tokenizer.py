from transformers import GPT2TokenizerFast

# Use GPT-2 tokenizer as a proxy for estimating tokens for GPT-3.5/4
tokenizer = GPT2TokenizerFast.from_pretrained("gpt2")

def count_tokens(text: str) -> int:
    return len(tokenizer.encode(text))

def trim_messages_to_token_limit(messages: list, limit: int = 3000):
    total_tokens = 0
    trimmed = []

    for msg in reversed(messages):  # Start from latest
        tokens = len(tokenizer.encode(msg["content"]))
        if total_tokens + tokens > limit:
            break
        trimmed.insert(0, msg)  # Maintain chronological order
        total_tokens += tokens

    return trimmed
