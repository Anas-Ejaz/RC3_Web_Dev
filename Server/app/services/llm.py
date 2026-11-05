"""Groq chat wrapper: JSON mode, Pydantic validation, one retry on invalid output, mapped error codes.

Never logs prompts, completions or keys (they can contain resume text).
"""
import json
import logging
from typing import TypeVar

from groq import APIConnectionError, APIStatusError, APITimeoutError, Groq, RateLimitError
from pydantic import BaseModel, ValidationError

from app.core.config import settings
from app.core.errors import AppError

logger = logging.getLogger("app.llm")
T = TypeVar("T", bound=BaseModel)


def _client() -> Groq:
    if not settings.groq_api_key:
        raise AppError(503, "LLM_NOT_CONFIGURED", "AI service is not configured (missing GROQ_API_KEY)")
    return Groq(api_key=settings.groq_api_key, timeout=settings.groq_timeout_seconds, max_retries=0)


def _complete(client: Groq, model: str, messages: list[dict], temperature: float) -> str:
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            response_format={"type": "json_object"},
        )
    except APITimeoutError as exc:  # must come before APIConnectionError (its parent)
        raise AppError(504, "LLM_TIMEOUT", "The AI service timed out. Please retry.") from exc
    except RateLimitError as exc:
        raise AppError(429, "LLM_RATE_LIMITED", "The AI service is rate limited. Please retry shortly.") from exc
    except APIConnectionError as exc:
        raise AppError(503, "LLM_UNAVAILABLE", "The AI service is unreachable. Please retry.") from exc
    except APIStatusError as exc:
        logger.error("Groq API status error: %s", exc.status_code)
        if exc.status_code == 400:
            return ""  # Groq rejects malformed JSON generations with 400; treat as invalid output (retried once)
        if exc.status_code in (401, 403):
            raise AppError(503, "LLM_AUTH_FAILED", "The AI service rejected the API key.") from exc
        raise AppError(502, "LLM_ERROR", "The AI service returned an error. Check GROQ_MODEL_* in .env.") from exc
    return resp.choices[0].message.content or ""


def generate_json(*, model: str, system: str, user: str, schema: type[T], temperature: float = 0.0) -> T:
    """Call Groq in JSON mode and return a validated `schema` instance (one retry on invalid JSON)."""
    client = _client()
    messages: list[dict] = [
        {"role": "system", "content": system + "\nRespond with a single valid JSON object and nothing else."},
        {"role": "user", "content": user},
    ]
    for attempt in range(2):
        content = _complete(client, model, messages, temperature)
        try:
            return schema.model_validate(json.loads(content))
        except (json.JSONDecodeError, ValidationError) as exc:
            logger.warning("LLM output failed validation (attempt %d): %s", attempt + 1, type(exc).__name__)
            messages = messages + [
                {"role": "assistant", "content": content},
                {"role": "user", "content": "That reply did not match the required JSON schema. Return only corrected JSON."},
            ]
    raise AppError(502, "LLM_INVALID_OUTPUT", "The AI returned an invalid response. Please retry.")