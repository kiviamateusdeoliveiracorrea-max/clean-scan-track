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
