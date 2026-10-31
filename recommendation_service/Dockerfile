# ==============================================================================
# Base Stage
# ==============================================================================
FROM python:3.10-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH="/app/src:/app"

WORKDIR /app

# Create a non-privileged user
RUN useradd -m -u 1000 appuser

# Copy requirements and install dependencies
COPY requirements.txt .

# Ensure requirements.txt is decoded properly (supports UTF-16LE BOM or UTF-8)
RUN python -c "raw = open('requirements.txt', 'rb').read(); text = raw.decode('utf-16') if (b'\xff\xfe' in raw[:2] or b'\xfe\xff' in raw[:2]) else raw.decode('utf-8'); open('reqs.txt', 'w', encoding='utf-8').write(text)" \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r reqs.txt \
    && rm reqs.txt

# ==============================================================================
# Development Stage (Supports Uvicorn auto-reload)
# ==============================================================================
FROM base AS development

COPY . .
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').getcode() == 200 else 1)"

CMD ["uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]

# ==============================================================================
# Production Stage (Hardened runtime without auto-reload)
# ==============================================================================
FROM base AS production

COPY . .
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').getcode() == 200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
