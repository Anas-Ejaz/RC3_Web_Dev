FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FASTEMBED_CACHE_PATH=/app/.fastembed_cache

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as a non-root user.
RUN useradd -m appuser && mkdir -p /app/.fastembed_cache && chown -R appuser /app
USER appuser

EXPOSE 8000

# Render/Railway inject $PORT; fall back to 8000 locally. Migrations run on every boot (idempotent).
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]