# AI usage and prompt record

This project used AI-assisted development. The record below distinguishes generated work from human review and does not claim that AI-generated code was manually authored.

## Tools used
| Tool | Use |
|---|---|
| ChatGPT (GPT-6) | Requirements decomposition, architecture, data model, deterministic scheduler design, backend/API implementation, test-case design, repository integration and documentation |
| Lovable | React/TypeScript dashboard generation and a targeted dataset-generation UI update |
| GitHub | Repository hosting and version control; commits were created through the connected GitHub integration |
| Gemini | Not used in the current implementation |

## Prompt record

### ChatGPT — architecture and implementation
Prompt intent: design and implement an end-to-end examination scheduling system using a React/TypeScript frontend and Python FastAPI/SQLite backend. Requirements included 5,000 students, 300 exams, 100 rooms and 200 invigilators; deterministic seeded data; constraint-first scheduling; explicit unassigned reasons; independent validation; audit history; and CSV/JSON exports.

Follow-up prompt intent: add controlled, labelled edge cases while keeping evaluation labels separate from operational data and ensuring the scheduler never reads ground-truth labels.

### Lovable — initial frontend generation
Prompt excerpt: “Build a polished, production-quality frontend for ExamFlow — Intelligent Examination Scheduling System.” The prompt specified the dashboard, schedule builder, exams, students, rooms, invigilators, conflicts, reports, exports, audit log, settings, API contract, responsive styling, animations and clear Demo Mode behavior. It explicitly prohibited a fake backend or Supabase replacement.

### Lovable — dataset integration update
Prompt intent: add an include_edge_cases switch to the dataset dialog, use the exact Faculty preset of 5,000 students / 300 exams / 100 rooms / 200 invigilators, keep Demo Mode explicit, and test that the request sends the option to the real FastAPI endpoint.

## Human review required
Before submission, the project owner should run the backend and frontend tests, inspect generated schedules and validation output, review the scheduler and explain the hard constraints, reason codes, edge-case isolation and limitations during the demonstration. AI assistance does not replace understanding or verification.
