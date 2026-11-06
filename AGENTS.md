<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Audit completion uses a SECURITY INVOKER database transaction to save answers, NCs and final status together under existing RLS; concurrent retries lock the draft and return its completed ID to prevent duplicate actions.
- Audit creation persists device-local drafts in IndexedDB scoped by authenticated user and selected unit, including pending photo Files, so browser interruption does not lose form data.
- Audit photo preparation and cancellable uploads run in browser-only helpers; shared validation and single-flight locking stay independently testable.
- Process audits use independent tables and a SECURITY INVOKER completion RPC with existing permission helpers; scores are calculated in the database to prevent inconsistent client totals, and no 5S objects are modified.
- The process question catalog uses its own protected route and query keys with the existing role hook and design components; unit-specific question fallback is applied per area so one area's overrides do not hide another area's global questions.
- Base read and audit-photos policies reuse the existing Fase 2B authorization helpers rather than redundant restrictive read layers; public write policies remain unchanged to preserve the explicitly approved scope.
- Process dashboard ranking uses a browser-safe pure helper over the existing unit-filtered audit query so aggregation rules are testable without changing 5S data or queries.
- Completed process audits are edited only via a dedicated SECURITY INVOKER RPC and guarded by RESTRICTIVE update/delete policies on the old row (admin/gestor or the registered auditor by e-mail), so draft completion by any authorized auditor stays unchanged.
- Process planning goals live in public.metas_processo (one row per unit, single current value, no history); all weekly/monthly/per-area aggregation is done in the browser-safe pure helper src/lib/process-planning.ts over the unit-filtered completed-audit query, with no new database functions.
