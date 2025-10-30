from __future__ import annotations

import os
from typing import List, Dict


class OpenAIServiceError(RuntimeError):
    pass


def _get_model_name() -> str:
    return os.environ.get("OPENAI_MODEL", "gpt-3.5-turbo")


def generate_reply(history: List[Dict[str, str]], prompt: str, timeout_s: int = 10) -> str:
    """
    OpenAI wrapper as fallback for Gemini.
    - history: list of {"role": "user"|"ai", "text": "..."}
    - prompt: the latest user input
    Returns plain text reply or raises OpenAIServiceError on failure.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise OpenAIServiceError("OpenAI API key is missing; set OPENAI_API_KEY in .env")

    try:
        import openai
    except Exception as e:  # pragma: no cover - import error path
        raise OpenAIServiceError(f"OpenAI client not available: {e}")

    client = openai.OpenAI(api_key=api_key)
    model_name = _get_model_name()
    
    try:
        # Build messages in OpenAI format
        messages = []
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("text", "")
            # OpenAI expects role: "user" or "assistant"
            messages.append({
                "role": "user" if role == "user" else "assistant",
                "content": content,
            })
        # Append current prompt as user
        messages.append({"role": "user", "content": prompt})

        # Synchronous call
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            timeout=timeout_s
        )
        
        text = response.choices[0].message.content or ""
        text = text.strip()
        if not text:
            raise OpenAIServiceError("Empty response from OpenAI")
        return text
    except Exception as e:
        raise OpenAIServiceError(f"OpenAI request failed: {e}")

