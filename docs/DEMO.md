# 5-minute demonstration plan

1. Open the dashboard and show the API connection indicator.
2. Generate the Faculty dataset: 5,000 students, 300 exams, 100 rooms and 200 invigilators. Keep edge cases disabled for the baseline run.
3. Show the generated entity counts and dashboard metrics. Explain that the metrics come from the database.
4. Generate a schedule for the available exam window. Explain the constraint-first ordering and the balanced/compact/spread strategies.
5. Open the schedule and show room, time and invigilator assignments.
6. Open Unassigned / Conflicts and explain reason codes such as NO_ROOM_CAPACITY and NO_INVIGILATOR.
7. Open Validation and show the independent hard-constraint checks.
8. Enable labelled edge cases, regenerate the dataset, rerun the schedule and show the labels through GET /api/v1/edge-cases. Explain that the solver never reads this table.
9. Open Audit Log and export CSV, JSON or a complete SQLite SQL dump. The SQL dump includes schema, indexes and stored data and can be restored with SQLite.
10. Close with the limitation: one room per exam; separate-room accommodations are explicitly marked unsupported rather than silently violated.

Useful URLs after local startup:
- Frontend: URL printed by Vite (normally http://localhost:8080)
- API docs: http://localhost:8000/docs
- API health: http://localhost:8000/api/v1/health
