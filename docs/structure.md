# Backend Folder Structure

This project follows a modular, feature-based architecture for scalability and clarity.

## Directory Overview

- `src/` - Main source code.
  - `config/` - Configuration logic.
    - `env.ts` - Environment variable sanitization and export. Ensure all secrets are added here.
  - `db/` - Database connection and management.
    - `mongo.ts` - MongoDB singleton manager.
  - `features/` - Domain-specific features. Each feature should have its own folder.
    - `example/` - Example feature implementation.
      - `example.controller.ts` - Request handling logic.
      - `example.routes.ts` - Route definitions for this feature.
      - `example.models.ts` - Data schemas/models.
  - `index.ts` - Express application setup and server initialization logic.
  - `server.ts` - Entry point that boots the server.

## Important Conventions

1. **Environment Variables**: Never use `process.env` directly in the business logic. Always import the sanitized `env` object from `@/config/env.js`.
2. **ES Modules**: This project uses `type: "module"`. All local imports must include the `.js` extension (e.g., `import { x } from "./y.js"`).
3. **Feature-Based Routing**: Register new features in `index.ts` using `app.use("/api/v1/feature-name", featureRouter)`.
4. **Error Handling**: Use the improved logging in `index.ts`. All critical startup errors should call `process.exit(1)`.
