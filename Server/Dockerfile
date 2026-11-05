FROM python:3.11-slim

ARG EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FASTEMBED_CACHE_PATH=/opt/fastembed_cache

WORKDIR /app

# libgomp1: required by onnxruntime (fastembed). PyMuPDF and psycopg[binary] ship wheels, no compiler needed.
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

# Pre-download the embedding model at build time so the first request is not slow.
# EMBEDDING_MODEL must be a 384-dim model (resume_chunks.embedding is vector(384)).
RUN mkdir -p ${FASTEMBED_CACHE_PATH} \
    && python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='${EMBEDDING_MODEL}')"

RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app ${FASTEMBED_CACHE_PATH}

COPY --chown=appuser:appuser alembic.ini ./
COPY --chown=appuser:appuser alembic ./alembic
COPY --chown=appuser:appuser app ./app
COPY --chown=appuser:appuser scripts ./scripts

USER appuser
EXPOSE 8000

# Migrate, then serve on $PORT (Render/Railway set it). One worker keeps memory low (the embedding model loads once).
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]