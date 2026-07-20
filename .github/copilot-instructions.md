# Copilot Instructions for Faven

## Git workflow (mandatory)

Follow the full protocol in [GIT_PROTOCOL.md](../GIT_PROTOCOL.md). Key points:

- After completing any change, **automatically** stage, commit, and push — do not wait to be asked:
  ```powershell
  git add -A; git commit -m "<type>(<scope>): <summary>"; git push
  ```
- Commit messages use Conventional Commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`); scopes: `api`, `app`, `db`, `auth`, `reviews`, `restaurants`, `leaderboard`, `infra`.
- Commit identity is per-repo (`samuelvalla-9`) — never change global git config, never commit as any other account.
- Never commit secrets (`.env`, tokens, keys); verify `git check-ignore api/.env` passes before staging.
- Never force-push to `main`.

## Documentation upkeep (mandatory)

Keep markdown docs in sync in the same session as any code change:

- **`IMPLEMENTATION_PLAN.md`** — tick completed sprint items, update sprint status markers and the **Last updated** date, note key files/commands added.
- **`GIT_PROTOCOL.md`** / this file — update when workflow or protocols change.
- Commit doc updates as `docs(infra): ...` (or bundle with the feature commit when trivial).
