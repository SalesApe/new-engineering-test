from __future__ import annotations

from typing import List, Dict
import logging

from . import gemini, openai, anthropic_claude


logger = logging.getLogger(__name__)


class AIServiceError(RuntimeError):
    pass


def generate_reply(history: List[Dict[str, str]], prompt: str, timeout_s: int = 10) -> str:
    """
    Unified AI service that tries multiple providers in order:
    1. Gemini (Google)
    2. OpenAI (GPT)
    3. Claude (Anthropic)
    
    - history: list of {"role": "user"|"ai", "text": "..."}
    - prompt: the latest user input
    Returns plain text reply or raises AIServiceError on failure.
    """
    errors = []
    
    # Try Gemini first
    try:
        logger.info("Attempting to generate reply using Gemini")
        return gemini.generate_reply(history=history, prompt=prompt, timeout_s=timeout_s)
    except gemini.GeminiServiceError as e:
        logger.warning(f"Gemini failed: {e}. Attempting OpenAI fallback.")
        errors.append(f"Gemini: {str(e)}")
        
        # Fall back to OpenAI
        try:
            logger.info("Attempting to generate reply using OpenAI")
            return openai.generate_reply(history=history, prompt=prompt, timeout_s=timeout_s)
        except openai.OpenAIServiceError as openai_e:
            logger.warning(f"OpenAI failed: {openai_e}. Attempting Claude fallback.")
            errors.append(f"OpenAI: {str(openai_e)}")
            
            # Final fallback to Claude
            try:
                logger.info("Attempting to generate reply using Anthropic Claude")
                return anthropic_claude.generate_reply(history=history, prompt=prompt, timeout_s=timeout_s)
            except anthropic_claude.ClaudeServiceError as claude_e:
                logger.error(f"All AI services failed. Claude: {claude_e}")
                errors.append(f"Claude: {str(claude_e)}")
                raise AIServiceError(
                    f"All AI services failed. {' | '.join(errors)}"
                )

