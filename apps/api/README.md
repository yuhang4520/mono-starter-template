# @your-project/api

Auth-first Fastify + tRPC backend service.

## Included

- Health endpoint: `GET /health`
- tRPC router: `auth` namespace (login, refresh, getMe)
- JWT access/refresh token flow
- Better Auth integration (Drizzle adapter)
- Pino logging

## Development

```bash
pnpm --filter @your-project/api dev
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`: PostgreSQL connection string
- `AUTH_SECRET`: Random secret for JWT signing
- `AUTH_URL`: API URL (e.g., http://localhost:4000)
- `PORT`: Server port (default: 4000)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/trpc/auth.loginByPhoneNumber` | POST | Login with phone + password |
| `/api/trpc/auth.refresh` | POST | Refresh access token |
| `/api/trpc/auth.getMe` | GET | Get current user info |

## Deployment

See root README for Docker build instructions.
