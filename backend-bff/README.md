## Backend for Frontend (BFF)

This is the **Backend-for-Frontend (BFF)** service of the Ligla Chat system, built with **NestJS**, **GraphQL**, and **Drizzle ORM**. It sits between the frontend (React) and backend-core (FastAPI), shaping data for the UI and exposing the operator-facing API.

## Table of Contents

- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Running the App](#running-the-app)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [About Drizzle](#about-drizzle)
- [About GraphQL](#about-graphql)
  - [Frontend Sync](#frontend-sync)
- [Development Notes](#development-notes)

## Project Structure

```plaintext
backend-bff
   ├── drizzle/                    # Introspected Drizzle schema, split public/tenant outputs, shared tables
   ├── drizzle-introspect/         # Standalone package and entrypoint for the schema introspection job image
   ├── scripts/                    # Introspection post-processing utilities
   ├── seeds/                      # Seed scripts for local development
   ├── src/                        # NestJS application source code
   ├── test/                       # Unit and E2E tests
   ├── .gcloudignore               # GCP deploy ignore rules
   ├── .gitignore                  # Git ignore rules
   ├── .prettierrc                 # Prettier configuration
   ├── app.prd.yaml                # GCP App Engine configuration (production)
   ├── app.stg.yaml                # GCP App Engine configuration (staging)
   ├── Dockerfile                  # Default Docker image definition
   ├── Dockerfile.drizzle-introspect # Docker image for Drizzle introspection tasks
   ├── Dockerfile.prd              # Production Docker image definition
   ├── Dockerfile.stg              # Staging Docker image definition
   ├── drizzle.config.ts           # Drizzle Kit configuration for database introspection
   ├── eslint.config.mjs           # ESLint configuration
   ├── nest-cli.json               # NestJS CLI configuration
   ├── package.json                # Project metadata, dependencies, and scripts
   ├── tsconfig.build.json         # TypeScript build configuration
   ├── tsconfig.json               # Base TypeScript configuration
   └── README.md                   # Project overview (this file)
```

## Getting Started

### Prerequisites

- [Install `node 20+ LTS`](https://nodejs.org/en)
- [Install `Docker` and `docker-compose`](https://docs.docker.com/get-docker/)
- Install `make`. See instructions for [Windows](https://stackoverflow.com/questions/32127524/how-to-install-and-use-make-in-windows), [Linux](https://askubuntu.com/questions/161104/how-do-i-install-make), and [Mac](https://stackoverflow.com/questions/10265742/how-to-install-make-and-gcc-on-a-mac)

### Running the App

[Follow the setup section in the main README.](../README.md#setup)

### Available Scripts

```bash
# Pull the latest database schema with Drizzle and run post-processing
$ npm run drizzle:introspect

# Pull the raw database schema only
$ npm run drizzle:pull

# Rebuild processed Drizzle files from the raw introspection output
$ npm run drizzle:post-introspect

# Seed the local database with sample data
$ npm run seed:sample

# Run the compiled application at localhost:3000
$ npm run start

# Start the development server with HMR
$ npm run start:dev

# Lint and autofix with ESLint
$ npm run lint

# Format source and test files with Prettier
$ npm run format

# Run Jest unit tests
$ npm run test:unit

# Run Jest E2E tests
$ npm run test:e2e
```

## Testing

Backend-BFF tests are executed with Jest and Docker-based test infrastructure defined in the root `Makefile` and `docker-compose.test.yml`.

From the **repository root**:

```sh
# 1) Start test infrastructure (Postgres + storage emulator)
make test-setup

# 2) Run all unit tests (no DB required)
make test-unit

# 3) Run all E2E tests
make test-e2e
```

To run only the **Chat Assign Rule**-related E2E tests:

```sh
# All chat-assignment-rule E2E specs
make test-e2e-chat-assignment-rule
```

When you are done:

```sh
# Stop test infrastructure
make test-teardown
```

## About Drizzle

The BFF uses **Drizzle ORM** in a **database-first** workflow. The actual database schema and migration logic live in `backend-core`, so you should not create or run migrations from this service.

- `npm run drizzle:introspect` runs `drizzle-kit pull` and then executes `scripts/post-introspect.ts`
- Raw introspection output is written to `backend-bff/drizzle/raw/`
- Post-processed schema files are written under `backend-bff/drizzle/`
- Generated schema files should be refreshed via introspection rather than edited manually

After schema changes in `backend-core`, run these commands from the repository root:

```sh
# Generate migration (auto-detects public vs tenant changes)
make autogenerate-migration m="description of change"

# Apply migration to public + tenant schemas
make migrate
make tenant-upgrade-all REV=head

# Refresh Drizzle schema files in backend-bff
make generate

# Refresh generated frontend GraphQL types if the API schema changed
make generate-types
```

- [Drizzle Kit introspection docs](https://orm.drizzle.team/docs/get-started/postgresql-existing)

## About GraphQL

- The BFF uses NestJS **code-first GraphQL**
- Types and resolvers are defined in TypeScript, and the GraphQL schema is generated from that code

### Frontend Sync

- Frontend GraphQL types are generated with graphql-codegen in the frontend app
- Run this manually after GraphQL schema updates

```sh
# Make sure to run make commands from the root directory
make generate-types
```

## Development Notes

Chat real-time communication is implemented using [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).
