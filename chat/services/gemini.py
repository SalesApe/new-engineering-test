from __future__ import annotations

import os
from typing import List, Dict


class GeminiServiceError(RuntimeError):
    pass


def _get_model_name() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")


def generate_reply(history: List[Dict[str, str]], prompt: str, timeout_s: int = 10) -> str:
    """
    Minimal wrapper around google-generativeai.
    - history: list of {"role": "user"|"ai", "text": "..."}
    - prompt: the latest user input
    Returns plain text reply or raises GeminiServiceError on failure.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise GeminiServiceError("Gemini API key is missing or not set in .env")

    try:
        import google.generativeai as genai
    except Exception as e:  # pragma: no cover - import error path
        raise GeminiServiceError(f"Gemini client not available: {e}")

    try:
        genai.configure(api_key=api_key)
        model_name = _get_model_name()
        model = genai.GenerativeModel(model_name)
        # Build messages in Gemini format
        messages = []
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("text", "")
            # Gemini expects role: "user" or "model"
            messages.append({
                "role": "user" if role == "user" else "model",
                "parts": [content],
            })
        # Append current prompt as user
        messages.append({"role": "user", "parts": [prompt]})

        # Synchronous call
        resp = model.generate_content(messages, request_options={"timeout": timeout_s})
        text = getattr(resp, "text", None) or ""
        text = text.strip()
        if not text:
            raise GeminiServiceError("Empty response from Gemini")
        return text
    except Exception as e:
        raise GeminiServiceError(f"Gemini request failed: {e}")

