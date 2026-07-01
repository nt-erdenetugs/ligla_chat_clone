FROM python:3.14.6-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /code

RUN apt-get update && apt-get -y install locales libre2-dev build-essential pybind11-dev && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

RUN echo "ja_JP.UTF-8 UTF-8" >> /etc/locale.gen && \
    dpkg-reconfigure -f noninteractive locales

ENV PYTHONUNBUFFERED=1
ENV TZ=Asia/Tokyo
ENV LANG=ja_JP.UTF-8
ENV LANGUAGE=ja_JP.UTF-8
ENV LC_ALL=ja_JP.UTF-8

RUN echo "${TZ}" > /etc/timezone \
    && rm /etc/localtime \
    && ln -s /usr/share/zoneinfo/Asia/Tokyo /etc/localtime \
    && dpkg-reconfigure -f noninteractive tzdata

COPY backend-core/pyproject.toml .
RUN uv pip install --system --group dev -r pyproject.toml

COPY backend-core/app ./app
COPY backend-core/alembic ./alembic
COPY backend-core/alembic.ini .

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--reload"]
