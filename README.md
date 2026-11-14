# ExamFlow

**Intelligent examination scheduling for university operations.**

ExamFlow is a full-stack examination operations platform that helps academic teams organise exams, allocate rooms, assign invigilators and inspect scheduling constraints from one workspace. It combines a React operations dashboard with a FastAPI scheduling service and a relational database.

[![Live application](https://img.shields.io/badge/Live%20app-Open%20ExamFlow-3157D5?style=for-the-badge)](https://examflow-theta.vercel.app)
[![API documentation](https://img.shields.io/badge/API%20docs-Swagger-159B78?style=for-the-badge)](https://examflow-api-f24k.onrender.com/docs)
[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square)](https://fastapi.tiangolo.com/)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019-149ECA?style=flat-square)](https://react.dev/)

---

## Product overview

Exam scheduling is a constraint-heavy operation. A timetable that looks valid can still create student clashes, overfill a room, place an exam in a closed facility or assign an unavailable invigilator. ExamFlow models these relationships explicitly and checks them before accepting a schedule.

The platform brings the workflow into one place:

- **Plan the academic session** — maintain students, courses, enrollments, exams, rooms and invigilator records.
- **Generate a timetable** — create candidate exam sessions across a configured date and time window.
- **Allocate rooms and staff** — evaluate capacity, equipment, accessibility, room closures, invigilator availability and workload.
- **Handle accommodations** — apply supported accommodations, including dedicated-room allocation where required.
- **Review exceptions** — inspect unassigned exams with reason codes instead of hiding scheduling failures.
- **Validate the result** — run independent checks for student, room and invigilator conflicts and other hard constraints.
- **Keep an audit trail** — retain schedule-run and state-change history for traceability.
- **Export the outcome** — download schedule data, reports and reproducibility information in supported formats.

## Live product

| Workspace | What to inspect |
|---|---|
| [Overview dashboard](https://examflow-theta.vercel.app/) | Session summary, scheduling coverage, operational metrics and issue indicators |
| [Schedule](https://examflow-theta.vercel.app/schedule) | Generated assignments, dates, rooms and invigilators |
| [Exams](https://examflow-theta.vercel.app/exams) | Exam catalogue and exam requirements |
| [Students](https://examflow-theta.vercel.app/students) | Student records and enrollment context |
| [Rooms](https://examflow-theta.vercel.app/rooms) | Room capacity, equipment and accessibility details |
| [Invigilators](https://examflow-theta.vercel.app/invigilators) | Invigilator directory and availability context |
| [Conflicts](https://examflow-theta.vercel.app/conflicts) | Scheduling exceptions and conflict review |
| [Validation](https://examflow-theta.vercel.app/validation) | Hard-constraint validation results |
| [Reports & exports](https://examflow-theta.vercel.app/reports) | Operational metrics and downloadable outputs |
| [Audit trail](https://examflow-theta.vercel.app/audit) | Recorded system and scheduling events |

> **Screenshots:** The repository currently has no verified, committed product screenshots. These links open the actual deployed product screens; no generated mockups are presented as real application captures. Add fresh browser captures to docs/screenshots/ after the final production UI has been visually checked.

## How the workflow works

1. **Prepare source data.** Create or generate students, courses, enrollments, exams, rooms, room capacities, equipment requirements, invigilators, availability and accommodations.
2. **Configure the exam window.** Choose the date range, daily operating hours, break buffer and scheduling strategy.
3. **Run the scheduler.** ExamFlow orders exams by constraint difficulty and evaluates valid time/room/staff combinations.
4. **Inspect assignments and exceptions.** Review confirmed assignments and every unassigned exam's reason code.
5. **Validate independently.** Run the validation report to check that the accepted schedule satisfies the hard constraints.
6. **Record and export.** Review the audit history and export the schedule, validation results and reproducibility bundle.

## Scheduling and constraint model

The scheduling engine uses a deterministic, constraint-first heuristic. It prioritises exams with tighter requirements, then evaluates candidate time slots and rooms. A candidate assignment is accepted only when the relevant constraints pass.

| Constraint | Scheduling behaviour |
|---|---|
| Student conflicts | Prevents a student from being assigned to overlapping exams |
| Room capacity | Requires sufficient usable capacity for the assigned cohort |
| Room closures | Excludes rooms during configured closure periods |
| Equipment | Matches exam requirements against room equipment |
| Accessibility | Checks room accessibility against applicable accommodations |
| Invigilator availability | Excludes unavailable or overlapping invigilator assignments |
| Invigilator workload | Applies configured workload limits |
| Separate-room accommodation | Supports a dedicated room for the accommodated student and a main room for the remaining cohort, with invigilation coverage per room |
| Unresolved constraints | Leaves the exam unassigned and records an explicit reason |

Typical reason codes include NO_ROOM_CAPACITY, ROOM_CLOSED, EQUIPMENT_UNAVAILABLE, STUDENT_CONFLICT, NO_INVIGILATOR, ACCOMMODATION_CONFLICT, UNSUPPORTED_ACCOMMODATION and NO_VALID_TIME_SLOT.

The validator checks student allocation and room, student and invigilator conflicts. An unassigned exam is an explicit outcome, not a silently accepted violation.

## Architecture

~~~mermaid
flowchart LR
    U[Academic operations user] --> FE[React 19 + TypeScript dashboard]
    FE -->|HTTPS / JSON| API[FastAPI REST API]
    API --> ORM[SQLAlchemy 2]
    ORM --> DB[(PostgreSQL on Neon)]
    API --> S[Constraint-first scheduling engine]
    S --> ORM
    API --> EX[CSV / JSON / SQL exports]
    FE -->|Live metrics and reports| API
~~~

| Layer | Technology |
|---|---|
| Web application | React 19, TypeScript, TanStack Start/Router |
| UI | Tailwind CSS, shadcn/ui, Radix UI, Lucide |
| Data fetching | TanStack Query |
| Charts | Recharts |
| API | Python, FastAPI, Pydantic 2 |
| Persistence | SQLAlchemy 2, PostgreSQL (hosted), SQLite (local default) |
| Automated tests | Pytest, FastAPI TestClient, Vitest |
| Hosting | Vercel (frontend), Render (API), Neon (PostgreSQL) |

### Deployment topology

- **Frontend:** [Vercel production app](https://examflow-theta.vercel.app)
- **Backend:** [Render API](https://examflow-api-f24k.onrender.com)
- **API reference:** [OpenAPI / Swagger UI](https://examflow-api-f24k.onrender.com/docs)
- **Database:** Neon PostgreSQL

The hosted stack uses free-tier services. Free instances can sleep, cold-start or enforce usage limits; this setup is intended for a challenge and portfolio demonstration, not as a service-level-guaranteed university production deployment.

## Data model

The relational model represents the scheduling domain with explicit relationships and constraints. Core records include:

- **Student**, **Course** and **Enrollment**
- **Exam** and **ExamCourse**
- **ExamRequirement**
- **Room** and **RoomCapacity**
- **Invigilator** and **Availability**
- **Accommodation**
- **ScheduleAssignment**
- **ScheduleRun** and **ScheduleEvent** for run and event history

Stable identifiers follow readable, predictable conventions such as STU-000001, EXAM-2026-000001, ROOM-000001, INV-000001 and assignment IDs derived from exam and room identifiers.

Dataset regeneration does not erase prior schedule-run and schedule-event history. Evaluation labels are stored separately from scheduling inputs so the solver does not use ground-truth labels to make assignment decisions.

## Demo data and reproducibility

A seeded synthetic dataset can be generated for repeatable demonstrations and evaluation. The documented baseline scale is:

- 5,000 students
- 300 exams
- 100 rooms
- 200 invigilators

The generator accepts a fixed seed and can include labelled edge cases such as overlapping student exams, insufficient room capacity, room closures, unavailable invigilators and accommodation scenarios. Edge-case labels are kept separate from solver inputs.

The application also has a clearly labelled deterministic demo-data mode for situations where the API cannot be reached. Demo fixtures must not be confused with live records.

Supported reproducibility outputs include per-table row counts and SHA-256 checksums, together with a dataset bundle containing table-level CSV/JSON data, a SQL snapshot, generator information, source provenance and a manifest.

## API reference

All application routes are prefixed with /api/v1. The interactive API reference is available at [examflow-api-f24k.onrender.com/docs](https://examflow-api-f24k.onrender.com/docs).

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /health | API health |
| GET | /health/database | Database health |
| POST | /datasets/generate | Generate seeded synthetic data |
| GET | /students | List students and enrollment context |
| GET / POST | /exams | List or create exams |
| PUT / DELETE | /exams/{id} | Update or delete an exam |
| GET | /rooms | List rooms |
| GET | /invigilators | List invigilators |
| POST | /schedules/generate | Generate a schedule |
| GET | /schedules | List confirmed assignments |
| GET | /schedules/unassigned | List unassigned exams and reason codes |
| GET | /reports/validation | Run hard-constraint validation |
| GET | /reports/metrics | Retrieve scheduling metrics |
| GET | /audit | Retrieve audit history |
| GET | /exports/csv | Export schedule CSV |
| GET | /exports/json | Export schedule and report JSON |
| GET | /exports/sql | Export a SQL database dump |
| GET | /exports/bundle | Download a ZIP dataset bundle |
| GET | /exports/reproducibility | Retrieve row counts and SHA-256 checksums |
| GET | /edge-cases | Retrieve evaluation labels (not solver inputs) |

## Run locally

### Prerequisites

- Python 3.10 or later
- Node.js 20 or later
- Bun (recommended; the repository includes bun.lock)

### Quick start on Windows

Double-click start_examflow.bat. The script prepares the Python environment, starts the API in a separate terminal and launches the frontend.

### Start the backend manually

From the repository root:

~~~bash
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
~~~

The local backend uses data/examflow.db (SQLite) by default. Set DATABASE_URL to use PostgreSQL. API docs: [http://localhost:8000/docs](http://localhost:8000/docs).

### Start the frontend

In a second terminal:

~~~bash
bun install
cp .env.example .env
bun run dev
~~~

On Windows, copy .env.example to .env manually if cp is unavailable. Open the local URL printed by Vite (normally [http://localhost:8080](http://localhost:8080)).

Set VITE_API_BASE_URL in .env to the backend API base URL. For local development, the default is http://localhost:8000/api/v1. The frontend variable is public build-time configuration; never put database credentials or private API secrets in it.

### Generate a dataset

You can use the dashboard's **Generate dataset** action or call the API:

~~~bash
curl -X POST http://localhost:8000/api/v1/datasets/generate \
  -H "Content-Type: application/json" \
  -d '{"seed":20261111,"students":5000,"exams":300,"rooms":100,"invigilators":200,"include_edge_cases":false}'
~~~

Then generate a schedule from the dashboard or call:

~~~bash
curl -X POST http://localhost:8000/api/v1/schedules/generate \
  -H "Content-Type: application/json" \
  -d '{"start_date":"2026-12-07","end_date":"2026-12-18","daily_start":"09:00","daily_end":"18:00","break_buffer_minutes":30,"seed":20261111,"strategy":"balanced"}'
~~~

For controlled evaluation scenarios, set include_edge_cases to true. Review the generated labels through GET /api/v1/edge-cases.

## Quality and verification

GitHub Actions runs backend tests, frontend checks, PostgreSQL backup/restore verification and production acceptance checks. The frontend pipeline includes linting, formatting checks, Vitest, TypeScript validation and a production build.

- [Latest CI run](https://github.com/bunnybhuvan/ExamFlow/actions)
- [Source repository](https://github.com/bunnybhuvan/ExamFlow)
- [Problem statement traceability](./docs/PROBLEM_STATEMENT_TRACEABILITY.md)
- [Scheduling algorithm](./docs/ALGORITHM.md)
- [Five-minute demo walkthrough](./docs/DEMO.md)
- [Deployment guide](./docs/DEPLOYMENT.md)
- [AI usage and development record](./docs/AI_USAGE.md)
- [Frontend audit and known limitations](./AUDIT.md)

Run backend tests with:

~~~bash
pytest
~~~

Run frontend tests with:

~~~bash
bun run test
~~~

## Security and operational scope

The hosted application uses authenticated, role-based access. Do not commit credentials, production tokens, database URLs or private environment files. Configure secrets in the hosting provider's environment settings.

ExamFlow is a challenge/portfolio demonstrator, not a drop-in Student Information System (SIS). It does not claim institution-specific policy approval, guaranteed uptime, regulatory certification or disaster-recovery service levels. Before real university adoption, administrators must review identity integration, data retention, privacy, accessibility, backup objectives, operational ownership and institutional scheduling policies.

## License

No open-source license has been declared in this repository. Contact the repository owner before redistributing or reusing the project beyond the permissions granted by GitHub.
