FROM python:3.14.3-slim

WORKDIR /app

ENV UV_HTTP_TIMEOUT=300

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock* ./

RUN uv sync --frozen --no-dev

COPY . .

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENV=LOCAL

EXPOSE 9090

CMD ["sh", "-c", "uv run functions-framework --target=gcs_event_trigger --signature-type=http --port=${PORT:-9090} --host=0.0.0.0 --debug"]
