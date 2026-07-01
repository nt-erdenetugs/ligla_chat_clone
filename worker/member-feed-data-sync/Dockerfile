FROM python:3.14.3-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /code

ENV PYTHONUNBUFFERED=1
ENV UV_PROJECT_ENVIRONMENT=/usr/local
ENV UV_HTTP_TIMEOUT=300

COPY pyproject.toml .
RUN uv sync --no-dev --no-cache

COPY app/ ./app/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python3 -c "import http.client; conn = http.client.HTTPConnection('localhost', 8080); conn.request('GET', '/health'); r = conn.getresponse(); exit(0 if r.status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--reload"]
