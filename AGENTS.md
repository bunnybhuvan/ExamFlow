<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.

<!-- LOVABLE:END -->

## Project rules

- Keep component exports separate from shared contexts, hooks, schemas, and variant helpers so Fast Refresh boundaries remain valid without lint exceptions.
- All backend access goes through `src/lib/api.ts`; pages read data only via hooks in `src/lib/data-source.tsx` — keeps API/demo switching in one place.
- Query keys are prefixed with the data mode (`api` | `demo`) so demo fixture data never mixes with backend data.
- Backend is FastAPI + SQLite (external); do not add Supabase/Lovable Cloud or auth.
- tsconfig keeps `strict` but disables `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess` to keep component props ergonomic.
- Validate API responses against browser-safe schemas before caching them; malformed backend data must produce a visible error rather than an empty success or render exception.
- Keep export generation in data-source hooks and CSV escaping in a pure helper; mode selection and spreadsheet safety must not diverge between pages.
- Validate scheduling inputs with the shared pure validator and reload stored defaults when opening the generation dialog; settings must match the next request without hydration differences.