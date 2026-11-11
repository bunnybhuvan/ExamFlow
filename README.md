# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## ExamFlow frontend — running against FastAPI

ExamFlow is the frontend for an exam scheduling platform backed by FastAPI + SQLite. No sign-in is required for this local MVP.

```bash
bun install            # or npm install
cp .env.example .env   # optional: VITE_API_BASE_URL (default http://localhost:8000/api/v1)
bun run dev            # http://localhost:8080
```

Start the FastAPI backend first (e.g. `uvicorn app.main:app --reload --port 8000`) and allow CORS from `http://localhost:8080`.

**Endpoints used** (`src/lib/api.ts`): `GET /health`, `GET /health/database`, `POST /datasets/generate`, `GET /students`, `GET /exams`, `GET /rooms`, `GET /invigilators`, `POST /schedules/generate`, `GET /schedules`, `GET /schedules/unassigned`, `GET /reports/validation`, `GET /reports/metrics`, `GET /audit`, `GET /exports/{csv|json}`. List endpoints may return a bare array or `{ items | data | results }`. Exam create/edit/delete call `POST /exams`, `PUT /exams/{id}`, `DELETE /exams/{id}` and show the backend's real error if they don't exist.

**Demo Mode.** If `GET /health` fails, a Demo Mode banner appears and every page reads a deterministic local fixture (`src/lib/demo.ts`, seed `20261111`). Demo and API data are never mixed: queries are keyed by mode, and exports in Demo Mode are named `examflow-DEMO-*`. Click *Retry connection* once the backend is up.

**Structure:** `src/routes/*` (one file per page), `src/components/app/*` (shell, tables, dialogs), `src/lib/types.ts` (domain models), `src/lib/data-source.tsx` (query hooks), `src/lib/api.ts` (typed client).

Tests: `bunx vitest run`.