# Zera Solutions

Phase 1 foundation for a modular SME business management platform.

## Start PostgreSQL

From the project root:

```bash
docker compose up -d postgres
docker compose ps
```

The default backend `.env` expects:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/zera_solutions?schema=public"
```

## Run Database Migration

```bash
cd backend
npx prisma migrate dev --name init
```

## Run Backend

```bash
npm run dev
```

The API runs at `http://127.0.0.1:5050`.

## Run Frontend

```bash
cd ../frontend
npm run dev
```

The frontend runs at `http://localhost:5173`.
