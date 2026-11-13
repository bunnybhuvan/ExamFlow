# ExamFlow frontend audit — 13 November 2026

## Confirmed defects repaired

- Malformed JSON, list envelopes, and rows now surface API errors rather than empty success or render exceptions. All existing resource responses are checked at the API boundary; endpoint field mismatches are reported, not silently renamed.
- Partial failures on Conflicts, dashboard issue/coverage panels, notifications, student details, and assignment details no longer appear as “all clear” or complete results.
- Generation reloads saved scheduling defaults on each opening; date, time, integer seed, and buffer validation reject incomplete/non-finite input. Unsupported weekend and daily-limit controls are disabled and labelled rather than pretending they are sent to FastAPI.
- Delete confirmation remains open on failure, prevents duplicate submissions, and closes only on success. Edit forms cannot be dismissed during a save.
- Mutation invalidation targets the data mode captured when the request started, including after connection state changes.
- Student selection follows the URL; global search filters the full dataset before limiting displayed matches.
- Exports go through the data-source hook; demo files remain explicitly named and labelled. CSV quoting also neutralizes spreadsheet formulas; live export filenames are decoded and sanitized.
- Mobile header no longer clips the schedule action; tall dialogs scroll within the viewport.
- Added `/edge-cases` API access without inventing response fields or changing routes. All content routes retain unique metadata and include social card types.
- Lint excludes generated tool caches, avoiding scans of the 54 MB cache directory. No visual redesign or replacement backend was introduced.

## Earlier audit verification commands and results

- `bunx vitest run`: **41 passed, 6 files**, including 30 new tests for API contracts, response errors, CSV escaping, input validation, mode isolation, and mutation readback.
- `bun run lint`: **fails on 728 existing/introduced formatting-only findings**, plus 29 non-blocking warnings at the measured run. No mass formatting rewrite was performed to preserve a focused diff. This is not a clean-lint claim.
- `bunx eslint . --rule 'prettier/prettier: off'`: **0 executable-code errors**, 29 warnings at the measured run (component fast-refresh exports and hook dependencies). Final counts can change with subsequent edits.
- Automatic TypeScript/build harness: latest observed entries reported **`build OK`** after fixing the optional schedule-reasons inference issue. Manual typechecks and production builds were not run because the environment prohibits them; a separately deployed production runtime remains unverified.
- `python3 /tmp/browser/audit/check_pages.py`: all **11 content routes** rendered at **1280×1800** and **390×844**, no document horizontal overflow and no page exceptions. The unmatched route separately rendered 404. Calendar/table internal scrolling is intentional.
- `python3 /tmp/browser/audit/check_flows.py`: browser-only intercepted API fixtures exercised **create and readback, edit and readback, failed delete and retry, saved settings → exact schedule payload, labelled edge-case dataset payload, CSV/JSON downloads with nonempty files, student URL drawer, assignment drawer, partial validation failure/retry, and mobile dialog bounds**. All assertions passed; no page runtime exceptions.
- `curl -s --max-time 3 -o /tmp/api-health.txt -w 'Backend health HTTP %{http_code}\n' http://localhost:8000/api/v1/health`: HTTP **000**, exit **7**; no external backend running here.

## Limits and follow-up

- Browser API fixtures are **test-only interception**, not application mock endpoints or a replacement backend. API flows were not verified against a real FastAPI process, actual SQLite data, real CORS settings, or the backend's actual response schema. No backend tests were run or claimed.
- Demo is a fixed-scale deterministic fixture, not a real constraint solver; its generation dialog now states this limitation. Demo edits are local and a later demo generation replaces them. The `include_edge_cases` switch is transmitted in API mode; demo generation does not implement ground-truth labels.
- The formatting/lint follow-up is complete below. Run an independent TypeScript check and the project's normal production build in the exported repository before releasing.
- No Cloud, database, authentication, GitHub connection, or publishing was added or claimed.

## Frontend quality gate follow-up — 13 November 2026

### Changes

- Applied the repository's configured Prettier formatter. Its ignore list excludes repository metadata, generated route files, dependencies, tool caches, build output, lockfiles, private project metadata, and public assets.
- The fresh baseline differed from the earlier audit: `bunx eslint . --format json` measured **771 formatting errors and 28 warnings** (26 Fast Refresh export warnings and two hook-dependency warnings).
- Resolved all Fast Refresh warnings by separating shared contexts, hooks, validation/configuration helpers, and style variants from component exports; updated every consumer. Page data hooks remain centralized in `src/lib/data-source.tsx`, with unchanged mode-prefixed query keys and external FastAPI access through `src/lib/api.ts`.
- Stabilized the Schedule page's empty-data memo dependency without changing filtering or rendering behavior. No lint rules were disabled or weakened; no dependencies, backend services, or mock API endpoints were added.
- No test exposed a genuine behavior defect, so no new regression test was necessary. Existing API/demo isolation, mutation readback, contract, scheduling, and export tests continue to pass.

### Commands actually run and outcomes

- `bun run format`: **exit 0**, using the configured `prettier --write .`. The first lint pass afterward found ten formatting normalization leftovers in two files, with **zero warnings**.
- `bunx prettier --write src/lib/demo.ts src/test/api-contract.test.ts`: **exit 0**, resolved those leftovers.
- `bunx prettier --check .`: **exit 0**, all matched files use Prettier code style.
- `bun run lint`: **exit 0**, zero errors and zero warnings.
- `bunx eslint . --max-warnings 0`: **exit 0**, verifies the zero-warning gate without rule overrides.
- `bunx vitest run`: run twice after the refactor; both **exit 0, 41 tests passed across six files**. Final observed run at **13:47:31 UTC**, duration **2.00 seconds**.
- `python3 /tmp/browser/quality/check_quality.py`: **exit 0**. All 11 existing content routes rendered at **1280×1800**, with app-specific titles, social title metadata, no horizontal document overflow, and no page exceptions. Verified Faculty values and the edge-case toggle, labelled demo schedule generation/result, demo exam creation with table readback, and the mobile sidebar at **390×844**; inspected screenshots. No API interception was used in this follow-up.
- `curl -s --max-time 3 -o /tmp/examflow-health.txt -w 'Backend health HTTP %{http_code}\n' http://localhost:8000/api/v1/health`: HTTP **000**, **exit 7**; the real backend remains unavailable.
- Read `/tmp/observability/build-errors.log`: latest observed automatic harness entry at **13:46:47 UTC** reported **`build OK`** after the final source changes.

### Remaining environment limitations

- **Manual TypeScript check not run:** TypeScript is installed, but this sandbox explicitly prohibits manual project typechecks. The automatic harness's `build OK` is the available diagnostic, not a claim that an independent TypeScript command ran.
- **Manual production build not run:** `bun run build` exists but the sandbox explicitly prohibits manual project builds. No independent production artifact, published runtime, or deployed Worker was tested.
- Browser checks exercised the actual, explicitly labelled demo state because no real FastAPI process is running. Real API integration, SQLite data, backend tests, and CORS remain unverified; earlier intercepted API tests are historical evidence only.
- Browser scripts and command logs under `/tmp` are sandbox-local verification artifacts, not persistent repository test files. The full frontend Vitest suite remains in the repository.
