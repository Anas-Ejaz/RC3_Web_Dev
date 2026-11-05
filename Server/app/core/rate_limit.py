"""In-memory sliding-window rate limiter for login attempts.

Good enough for a single-process hackathon deployment. For multiple workers/instances,
swap the storage for Redis; the interface (check / record_failure / reset) stays the same.
"""
import threading
import time
from collections import deque

from app.core.config import settings
from app.core.errors import AppError


class RateLimiter:
    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] > self.window:
            hits.popleft()
        return hits

    def check(self, key: str) -> None:
        """Raise 429 if this key already used up its failed attempts in the window."""
        now = time.monotonic()
        with self._lock:
            hits = self._prune(key, now)
            if len(hits) >= self.max_attempts:
                retry = int(self.window - (now - hits[0])) + 1
                raise AppError(
                    429,
                    "RATE_LIMITED",
                    "Too many failed login attempts. Please try again later.",
                    extra={"retry_after_seconds": retry},
                )

    def record_failure(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._prune(key, now).append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def clear_all(self) -> None:
        with self._lock:
            self._hits.clear()


# Per account+IP limit, plus a looser per-IP limit to slow down credential stuffing across emails.
account_limiter = RateLimiter(settings.login_max_attempts, settings.login_window_seconds)
ip_limiter = RateLimiter(settings.login_max_attempts * 4, settings.login_window_seconds)


def reset_all_limiters() -> None:
    account_limiter.clear_all()
    ip_limiter.clear_all()