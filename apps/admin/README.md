# @your-project/admin

Auth-first Next.js admin baseline.

## Included

- Login / Signup pages
- Better Auth integration
- tRPC client setup
- Minimal authenticated home page
- Internationalization (i18n) ready

## Development

```bash
pnpm --filter @your-project/admin dev
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`: PostgreSQL connection string
- `BETTER_AUTH_SECRET`: Random secret for session signing
- `BETTER_AUTH_URL`: Your app's URL (e.g., http://localhost:3000)
- `ADMIN_PHONE`: Phone number that should auto-become admin

## Deployment

See root README for Docker build instructions.
