from __future__ import annotations

import os
from typing import List, Dict


class ClaudeServiceError(RuntimeError):
    pass


def _get_model_name() -> str:
    return os.environ.get("ANTHROPIC_MODEL", "claude-3-haiku-20240307")


def generate_reply(history: List[Dict[str, str]], prompt: str, timeout_s: int = 10) -> str:
    """
    Anthropic Claude wrapper as third fallback option.
    - history: list of {"role": "user"|"ai", "text": "..."}
    - prompt: the latest user input
    Returns plain text reply or raises ClaudeServiceError on failure.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ClaudeServiceError("Anthropic API key is missing; set ANTHROPIC_API_KEY in .env")

    try:
        import anthropic
    except Exception as e:  # pragma: no cover - import error path
        raise ClaudeServiceError(f"Anthropic client not available: {e}")

    try:
        client = anthropic.Anthropic(api_key=api_key)
        model_name = _get_model_name()
        
        # Build messages in Anthropic format
        messages = []
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("text", "")
            # Anthropic expects role: "user" or "assistant"
            messages.append({
                "role": "user" if role == "user" else "assistant",
                "content": content,
            })
        # Append current prompt as user
        messages.append({"role": "user", "content": prompt})

        # Synchronous call
        response = client.messages.create(
            model=model_name,
            max_tokens=1024,
            messages=messages,
            timeout=timeout_s
        )
        
        text = response.content[0].text if response.content else ""
        text = text.strip()
        if not text:
            raise ClaudeServiceError("Empty response from Claude")
        return text
    except Exception as e:
        raise ClaudeServiceError(f"Claude request failed: {e}")

