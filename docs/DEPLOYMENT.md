# ExamFlow deployment

## Backend — Render

The FastAPI service uses SQLite and must have persistent storage. The repository includes a Render Blueprint at `render.yaml` that provisions a Python web service and a 1 GB persistent disk mounted at `/var/data`. The Starter service/disk may incur charges; review Render's current pricing before creating it.

1. Connect the GitHub repository `bunnybhuvan/ExamFlow` to Render and create a Blueprint deployment from `render.yaml`.
2. Set `EXAMFLOW_CORS_ORIGINS` to the exact comma-separated frontend origins that will call the API. Include the published Lovable app origin and any preview origin you actually use. Do not use `*` for production.
3. Wait for the service to deploy. Verify `https://<render-service-host>/api/v1/health` and `/api/v1/health/database`.
4. Keep the persistent disk mounted at `/var/data`; the service stores its SQLite file at `/var/data/examflow.db`.

## Frontend — Lovable

Set `VITE_API_BASE_URL` to `https://<render-service-host>/api/v1` in the Lovable project's environment settings, then rebuild/publish the frontend. Vite embeds this value at build time. Do not leave it pointing at `localhost` for a hosted app: `localhost` in a visitor's browser is the visitor's own device.

## Release verification

- Generate the faculty-scale dataset (5,000 students, 300 exams, 100 rooms, 200 invigilators).
- Generate a schedule and confirm the validation report has zero hard-constraint violations.
- Reload the app and verify data persists across backend restarts.
- Check browser network requests for successful API responses and no CORS errors.
- Keep demo mode visibly labelled; do not present demo fixtures as live backend data.

The repository CI validates backend tests, frontend tests, lint, formatting of frontend source/config, TypeScript, and the production build. A successful CI run is not a substitute for the live deployment checks above.
