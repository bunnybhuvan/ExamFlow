# Five-minute product demonstration

This walkthrough follows the end-to-end examination scheduling workflow.

1. Open the dashboard and confirm the API connection indicator.
2. Generate the baseline dataset: 5,000 students, 300 exams, 100 rooms and 200 invigilators. Keep edge cases disabled for the baseline run.
3. Review the generated entity counts and dashboard metrics. Explain that live metrics are derived from persisted records.
4. Generate a schedule for the available exam window. Explain the constraint-first ordering and the balanced, compact and spread strategies.
5. Open the schedule and inspect exam dates, room allocations and invigilator assignments.
6. Open Conflicts and Unassigned. Explain reason codes such as NO_ROOM_CAPACITY and NO_INVIGILATOR; an unassigned exam is reported rather than forced into an invalid slot.
7. Open Validation and show the independent hard-constraint checks.
8. Enable labelled edge cases, regenerate the dataset and rerun the schedule. Show the labels through GET /api/v1/edge-cases and explain that the solver does not read the ground-truth table.
9. Open the Audit Trail and export CSV, JSON or the SQL database dump. Use the dataset bundle and reproducibility report when demonstrating repeatable evaluation.
10. Demonstrate a separate-room accommodation: the accommodated student is placed in a dedicated room, the remaining cohort is placed in the main room, and each allocated room receives invigilation coverage. Finish by reviewing the validation result and audit events.

## Useful local URLs

- Frontend: URL printed by Vite (normally http://localhost:8080)
- API docs: http://localhost:8000/docs
- API health: http://localhost:8000/api/v1/health

## Demo integrity

Use the API connection indicator to distinguish live backend data from the deterministic frontend demo fixture. Do not present demo fixture values as live database records.
