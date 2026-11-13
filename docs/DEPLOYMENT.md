# ExamFlow deployment — free-tier architecture

## Architecture and cost guardrails

- **Frontend:** publish the existing Lovable app on its available free tier.
- **API:** Render free web service from the repository Blueprint.
- **Database:** Neon PostgreSQL free plan, configured separately from the API.
- **Source and CI:** GitHub.

No paid Render service, persistent disk, or paid database is part of this setup. This architecture is for a challenge/portfolio demonstration, not a production university deployment: Render explicitly positions its free instances for testing and hobby projects. The API sleeps after 15 minutes without traffic, and waking it can take about a minute. Its filesystem is ephemeral, so **do not use SQLite for hosted data**. Configure PostgreSQL before using the hosted app. [Render free-plan limits](https://render.com/docs/free).

## 1. Create the free PostgreSQL database

1. Create a project on Neon and select its free plan.
2. Create or use the default database and copy its connection string.
3. Keep the connection string private. Do not commit it, put it in frontend variables, or send it in chat. Neon Free currently includes 100 compute-hours and 1 GB storage per project monthly; when compute or transfer limits are reached, compute is suspended rather than billed for Free-plan overages. [Neon Free-plan quotas](https://neon.com/docs/introduction/plans).

## 2. Deploy the API on Render

1. Connect `bunnybhuvan/ExamFlow` to Render.
2. Create a Blueprint deployment from `render.yaml` and select the free web-service plan.
3. When prompted for `DATABASE_URL`, paste the Neon connection string into Render's secret environment-variable field. Keep this value private.
4. Set `EXAMFLOW_CORS_ORIGINS` to the exact comma-separated frontend origins that will call the API. Include the published Lovable app origin and any preview origin you actually use. Do not use `*` for production.
5. Do not add a payment method for this free-only deployment. Render documents that over-limit bandwidth/build usage can be billed when a payment method is on file; without one, the service/builds are suspended instead. If a payment method is already attached to the workspace, set a zero/strict spend limit before proceeding. Deploy and verify `/api/v1/health` and `/api/v1/health/database` on the Render service URL.

The database health response should report `"database":"postgresql"`. If it reports SQLite, stop and correct `DATABASE_URL` before generating real data.

## 3. Connect the Lovable frontend

Set `VITE_API_BASE_URL` in the Lovable project's environment settings to `https://<render-service-host>/api/v1`, then rebuild and publish the frontend. Vite embeds this value at build time. Never leave a hosted frontend pointing at `localhost`: that address belongs to each visitor's own device.

## 4. Release verification

- Confirm the database health endpoint reports PostgreSQL.
- Generate a small test dataset, create a schedule, and verify CSV, JSON and SQL exports.
- Restart/redeploy the API and confirm the generated records still exist in Neon.
- Generate the faculty-scale dataset (5,000 students, 300 exams, 100 rooms, 200 invigilators).
- Generate a schedule and confirm the validation report has zero hard-constraint violations.
- Check browser network requests for successful API responses and no CORS errors.
- Keep demo mode visibly labelled; do not present demo fixtures as live backend data.

A passing GitHub Actions run does not prove that provider credentials, CORS, the live API and the published frontend work together. Complete these live checks before calling deployment verified.
