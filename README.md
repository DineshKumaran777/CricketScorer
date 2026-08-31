# CricketScorer API

Backend REST API for the CricketScorer app (ScoreCricket). Built with **Node.js + TypeScript**, **Express**, **Drizzle ORM**, and **Neon (PostgreSQL)**.

## Tech Stack

- Node.js + Express (TypeScript)
- Drizzle ORM + Neon serverless PostgreSQL
- JWT authentication (bcrypt password hashing)
- Google OAuth (sign-in with Google)
- Zod validation, helmet, cors, rate limiting

## API Base Path

- Versioned routes: `/api/v1/...`
- Legacy routes: `/api/...`
- Health check: `GET /api/health`

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your-secret-here
GOOGLE_CLIENT_ID=your-google-client-id
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

## Local Development

```bash
npm install
npm run dev          # ts-node watch mode on src/index.ts
```

## Build & Run

```bash
npm run build        # compile TypeScript to dist/
npm start            # run node dist/index.js
```

## Database Migrations

```bash
npm run generate     # generate a new migration from schema.ts
npm run db:migrate   # apply pending migrations to the database
npm run migrate      # drizzle-kit migrate
```

## Deploying to Render

> **Easy path:** This repo includes a [`render.yaml`](./render.yaml) blueprint. In Render, pick **New > Blueprint**, connect this repo, and it will auto-create the web service with all environment variables wired up. Fill the blank secret values once in the dashboard.

This repo is structured so a Render **Web Service** can build it directly from the root.

1. Create a **Neon** (or any PostgreSQL) database and copy its connection string.
2. On Render, create a new **Web Service** connected to this repository.
3. Configure the service:

   | Setting | Value |
   |---|---|
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |
   | **Root Directory** | `/` |

4. Add the environment variables (see below). At minimum set `DATABASE_URL` and `JWT_SECRET`.
5. After the service starts, run the migrations once from the Render shell:

   ```bash
   npm run db:migrate
   ```

6. Health check path: `/api/health`

### Render Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Neon/Postgres connection string |
| `JWT_SECRET` | Yes | Long random string for signing JWTs |
| `GOOGLE_CLIENT_ID` | Optional | For Google OAuth (not currently used by the API) |
| `CORS_ORIGIN` | Optional | Frontend origin; defaults to `http://localhost:3000` |
| `PORT` | Optional | Render injects its own `PORT`; defaults to `3000` |
| `NODE_ENV` | Optional | Set to `production` |

> **Security:** Never commit real `.env` values. Only `.env.example` is committed.
