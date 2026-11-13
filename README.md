# ExamFlow — Intelligent Examination Scheduling System

ExamFlow is a full-stack university examination scheduling system. It combines a responsive React/TypeScript operations dashboard with a Python FastAPI scheduling engine and SQLite database.

## What it does

- Manages students, course enrollments, exams, rooms and invigilators.
- Generates deterministic synthetic datasets using a fixed seed.
- Builds schedules with a constraint-first heuristic.
- Prevents student, room and invigilator time conflicts.
- Enforces room capacity, room closures, equipment, staff availability and accessibility requirements.
- Records every dataset and schedule run in an append-only audit event stream.
- Explains every unassigned exam with a stable reason code.
- Produces validation reports, metrics, CSV exports and JSON exports.
- Keeps evaluation edge-case labels separate from the scheduling input. The scheduler never reads the ground-truth label table.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, TanStack Start/Router, Tailwind, shadcn/ui |
| Data fetching | TanStack Query |
| Charts and motion | Recharts, Framer Motion-compatible UI transitions |
| Backend | Python 3.10+, FastAPI, Pydantic 2 |
| ORM / database | SQLAlchemy 2, SQLite |
| Tests | Pytest, FastAPI TestClient |

## Run locally

### Windows one-click start

Double-click `start_examflow.bat`. It creates the Python virtual environment if missing, installs dependencies when needed, starts FastAPI in a separate terminal, and runs the frontend. Install Python 3.10+ and Node.js 20+ first.

### 1. Backend

From the repository root:

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The backend creates `data/examflow.db` automatically. Open the interactive API docs at [http://localhost:8000/docs](http://localhost:8000/docs).

### 2. Frontend

In a second terminal:

```bash
npm install
cp .env.example .env
npm run dev
```

Open the local URL printed by Vite (the default is port 8080). The frontend API base defaults to `http://localhost:8000/api/v1`. Set `VITE_API_BASE_URL` in `.env` if the backend is hosted elsewhere.

### 3. Generate a dataset and schedule

Use the dashboard's **Generate dataset** action, or call the API:

```bash
curl -X POST http://localhost:8000/api/v1/datasets/generate \
  -H "Content-Type: application/json" \
  -d '{"seed":20261111,"students":5000,"exams":300,"rooms":100,"invigilators":200,"include_edge_cases":false}'
```

Then generate a schedule from the dashboard or use:

```bash
curl -X POST http://localhost:8000/api/v1/schedules/generate \
  -H "Content-Type: application/json" \
  -d '{"start_date":"2026-12-07","end_date":"2026-12-18","daily_start":"09:00","daily_end":"18:00","break_buffer_minutes":30,"seed":20261111,"strategy":"balanced"}'
```

For evaluation scenarios, set `include_edge_cases` to `true`. This creates separate labels for controlled cases such as shared student cohorts, insufficient capacity, closed rooms, inaccessible rooms and potential invigilator double-booking. The labels are not inputs to the solver.

## Scheduling approach

The engine is deterministic for a given dataset and request. It sorts exams by constraint difficulty (accessibility, equipment, enrollment and duration), then evaluates weekday time slots and suitable rooms. A candidate is accepted only when capacity, room availability, equipment, student rest/conflict checks, invigilator availability and workload limits pass. The engine assigns one room per exam; splitting a single exam across multiple rooms is intentionally outside this version's scope.

Unassigned exams retain explicit reason codes such as `NO_ROOM_CAPACITY`, `ROOM_CLOSED`, `EQUIPMENT_UNAVAILABLE`, `STUDENT_CONFLICT`, `NO_INVIGILATOR`, `ACCOMMODATION_CONFLICT`, `UNSUPPORTED_ACCOMMODATION` and `NO_VALID_TIME_SLOT`.

## API

All routes are prefixed with `/api/v1`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | API health |
| GET | `/health/database` | Database health |
| POST | `/datasets/generate` | Replace data with seeded synthetic data |
| GET | `/students` | Student directory and course enrollments |
| GET / POST | `/exams` | List or create exams |
| PUT / DELETE | `/exams/{id}` | Update or delete an exam |
| GET | `/rooms` | Room directory |
| GET | `/invigilators` | Invigilator directory |
| POST | `/schedules/generate` | Run the scheduling engine |
| GET | `/schedules` | Confirmed assignments |
| GET | `/schedules/unassigned` | Unassigned exams and reason codes |
| GET | `/reports/validation` | Hard-constraint validation |
| GET | `/reports/metrics` | Live scheduling metrics |
| GET | `/audit` | Audit event history |
| GET | `/exports/csv` | Schedule CSV |
| GET | `/exports/json` | Schedule and report JSON |
| GET | `/edge-cases` | Evaluation labels only |

## Tests

```bash
pytest
```

Frontend tests: `npm test`.

## Project documentation

- `docs/ALGORITHM.md` — hard constraints, strategies, reason codes and complexity.
- `docs/AI_USAGE.md` — transparent AI tool and prompt record.
- `docs/DEMO.md` — suggested five-minute challenge demonstration.

## Quality gates

GitHub Actions runs the backend Pytest suite and the frontend quality pipeline on every push to `main` and every pull request. The frontend pipeline installs the pinned Bun dependencies, runs ESLint with zero warnings, checks Prettier formatting, runs Vitest, runs the TypeScript compiler, and builds the production bundle.

See [AUDIT.md](./AUDIT.md) for the frontend audit, confirmed repairs, test evidence and remaining deployment limitations.

## Data and reproducibility

- Stable identifiers: `STU-000001`, `EXAM-2026-000001`, `ROOM-000001`, `INV-000001`, and `ASN-<exam>-<room>`.
- Dataset generation is seeded and replaces the current synthetic dataset in a single operation.
- Foreign keys are enabled in SQLite.
- The SQLite database, virtual environment, node modules and build artifacts are excluded from Git.
- No API keys or production credentials are required for local development.

## Scope notes

This is a demonstrable scheduling MVP, not a university SIS integration. It schedules each exam in one room and uses local SQLite for reproducible evaluation. Production deployment should use a persistent disk for SQLite or a managed relational database, authentication, authorization and institution-specific policies.
