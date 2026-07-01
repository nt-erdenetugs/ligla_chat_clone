# Frontend

This project contains the full client-side codebase, organized with reusable components, assets, and configuration files to build and run the user interface using Vite + ReactJS^18.

## Table of Contents

- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Running the App](#run-the-application)
- [Available Scripts](#available-scripts)
- [About GraphQL](#about-graphQL)
  - [Frontend Sync](#frontend-sync)
- [Seed users](#seed-users)

## Project Structure

```plaintext

frontend
   ├── public/                  # Static files and assets
   ├── src/                     # Source code directory for the application logic
   ├── .eslintrc.js             # Configuration file for ESLint
   ├── .gitignore               # File specifying files to exclude from version control (Git)
   ├── .nvmrc                   # File indicating the desired Node.js version for the project.
   ├── .prettierrc              # Configuration file for Prettier, a code formatter.
   ├── app.yaml                 # GCP App Engine configuration
   ├── app.prd.yaml             # GCP App Engine configuration (production)
   ├── Dockerfile               # Docker config
   ├── Dockerfile.stg           # Docker config for staging
   ├── package.json             # File containing project metadata, dependencies, and scripts.
   └── README.md                # Project overview (this file)
   └── tsconfig.eslint.json     # TypeScript configuration specifically for ESLint
   └── tsconfig.json            # Main TypeScript configuration file for the project
   └── vite.config.mts          # Vite configuration


```

## Getting Started

### Prerequisites

- [Install `node 20+ LTS`](https://nodejs.org/en),
- [Install `Docker`, `docker-compose`](https://docs.docker.com/get-docker/)
- Install `make` command. [Windows](https://stackoverflow.com/questions/32127524/how-to-install-and-use-make-in-windows), [Linux](https://askubuntu.com/questions/161104/how-do-i-install-make) and [Mac](https://stackoverflow.com/questions/10265742/how-to-install-make-and-gcc-on-a-mac)

### Running the App

[Follow the setup section in the main README.](../README.md#setup)

### Available Scripts

```bash
# Run to generate GraphQL types from schema with graphql-codegen
$ npm run generate

# Running the application at localhost:3000
$ npm run start

# Lint and autofix with eslint
$ npm run lint

# Format with prettier
$ npm run format
```

## About GraphQL

- There are ways to write GraphQL in NestJS, Code First or Schema First, but the current way to write Code First is used.
- The reason is that we define types and resolvers in TypeScript, and the schema is generated from code.

### Frontend Sync

- To sync GraphQL types with the frontend, we use graphql-codegen from the frontend.
- This step must be run manually after GraphQL schema updates. It should be automated in the future.

Runs the graphql-codegen inside the frontend (based on frontend/codegen.yml file).

```sh
# Make sure to run make commands from the root directory
make generate-types
```

## Seed users

These test users are available after seeding the database:

- Hypervisor
  - email: <hypervisor@liglachat.com>
  - password: ligla_Chat@2024

- Admin operator
  - email: <admin-operator@liglachat.com>
  - password: ligla_Chat@2024

All seed data can be found in the [seed files](../backend-bff/seeds/sample.seed.ts).

## Apollo Client Hooks

- Never use `onError`, `onCompleted` callbacks in `useQuery`, `useInfiniteQuery`, `useLazyQuery` hooks

## function displayName

When declaring a new function component you can add a displayName property to the component to make it simpler to identify the component in the React DevTools.

When to declare displayName?

When the function is wrapped by React.memo, the component will be named as the function that is passed to the memo function in the React DevTools.

Incorrect way:

```tsx
export const MyComponent = React.memo(() => {
  return <div>Component Content</div>;
MyComponent.displayName = 'MyComponent';
```

Correct way:

```tsx
export const MyComponent = React.memo(function MyComponent() {
  return <div>Component Content</div>;
});

// or

export const MyComponent = React.memo(() => {
  return <div>Component Content</div>;
});
MyComponent.displayName = 'MyComponent';
```
