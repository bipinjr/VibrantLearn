"""Every Groq call goes through here (CLAUDE.md "Working with Groq"): server-only key, timeouts,
one retry on a short 429, token counts for internal.usage_events, and plain error codes.
Errors are logged as status + Groq's code only, never the key or the prompt.
"""

import json
import logging
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal, Protocol

import httpx

from app.core.config import get_settings

log = logging.getLogger("api")
URL = "https://api.groq.com/openai/v1/chat/completions"
Reasoning = Literal["low", "medium", "high"]


@dataclass(frozen=True)
class Message:
    role: Literal["system", "user", "assistant"]
    content: str


@dataclass(frozen=True)
class Result:
    text: str
    model: str
    tokens_in: int
    tokens_out: int
    latency_ms: int


class LlmError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(code)
        self.status, self.code, self.message = status, code, message


class Llm(Protocol):
    def chat(
        self,
        messages: list[Message],
        *,
        model: str,
        max_tokens: int,
        temperature: float,
        json_mode: bool = False,
        reasoning: Reasoning = "low",
        timeout_s: float = 20.0,
    ) -> Result: ...


class Groq:
    def __init__(self, api_key: str) -> None:
        self.key = api_key
        self.http = httpx.Client(headers={"Authorization": f"Bearer {api_key}"})

    def chat(
        self,
        messages: list[Message],
        *,
        model: str,
        max_tokens: int,
        temperature: float,
        json_mode: bool = False,
        reasoning: Reasoning = "low",
        timeout_s: float = 20.0,
    ) -> Result:
        if not self.key:
            raise LlmError(503, "not_configured", "AI isn't switched on.")
        body: dict[str, object] = {
            "model": model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
        }
        if model.startswith("openai/gpt-oss"):
            body["reasoning_effort"] = reasoning  # keep the hidden reasoning short and cheap
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        start = time.perf_counter()
        try:
            r = self.http.post(URL, json=body, timeout=timeout_s)
            wait = r.headers.get("retry-after", "")
            if r.status_code == 429 and wait.isdigit() and 0 < int(wait) <= 15:
                time.sleep(int(wait))
                r = self.http.post(URL, json=body, timeout=timeout_s)
        except httpx.TimeoutException as e:
            raise LlmError(504, "llm_timeout", "The AI took too long to answer. Try again.") from e
        except httpx.HTTPError as e:
            raise LlmError(
                502, "llm_error", "The AI couldn't answer that just now. Try again."
            ) from e
        if r.status_code >= 400:
            try:
                err = r.json().get("error", {})
                code = err.get("code") or err.get("type")
            except (ValueError, AttributeError):
                code = None
            log.warning(json.dumps({"event": "groq_error", "status": r.status_code, "code": code}))
            if r.status_code == 429:
                raise LlmError(429, "llm_busy", "The AI is busy right now. Try again in a minute.")
            raise LlmError(502, "llm_error", "The AI couldn't answer that just now. Try again.")
        data = r.json()
        text = (data.get("choices") or [{}])[0].get("message", {}).get("content")
        if not isinstance(text, str) or not text.strip():
            raise LlmError(502, "llm_empty", "The AI returned an empty answer. Try another way.")
        usage = data.get("usage") or {}
        return Result(
            text=text.strip(),
            model=model,
            tokens_in=int(usage.get("prompt_tokens") or 0),
            tokens_out=int(usage.get("completion_tokens") or 0),
            latency_ms=round((time.perf_counter() - start) * 1000),
        )


@lru_cache
def get_llm() -> Llm:
    return Groq(get_settings().groq_api_key.get_secret_value())
