"""Single embedding entry point: embed(texts). The provider is chosen by EMBEDDING_PROVIDER."""
import threading

import numpy as np

from app.core.config import settings
from app.core.errors import AppError

_model = None
_lock = threading.Lock()
_cache: dict[str, list[float]] = {}
_CACHE_MAX = 5000


def _get_model():
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                from fastembed import TextEmbedding  # imported lazily: heavy, and downloads the model on first use

                _model = TextEmbedding(model_name=settings.embedding_model)
    return _model


def embed(texts: list[str]) -> list[list[float]]:
    """Return one vector per input text (same order). Repeated texts are served from a small cache."""
    if settings.embedding_provider.lower() != "fastembed":
        raise AppError(503, "EMBEDDING_PROVIDER_UNSUPPORTED", f"Unknown EMBEDDING_PROVIDER '{settings.embedding_provider}'")
    missing = [t for t in dict.fromkeys(texts) if t not in _cache]
    if missing:
        try:
            vectors = list(_get_model().embed(missing))
        except Exception as exc:  # noqa: BLE001 - download/ONNX problems must not crash a request
            raise AppError(503, "EMBEDDING_UNAVAILABLE", "The embedding model is unavailable. Please retry.") from exc
        if len(_cache) + len(missing) > _CACHE_MAX:
            _cache.clear()
        for text, vec in zip(missing, vectors):
            _cache[text] = [float(x) for x in vec]
    return [_cache[t] for t in texts]


def cosine(a: list[float], b: list[float]) -> float:
    va, vb = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    return float(va @ vb) / denom if denom else 0.0