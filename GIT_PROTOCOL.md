# Git Protocol for AI Agents

This document defines the mandatory workflow any AI agent (Copilot, Claude, etc.) must follow when making changes in this repository.

## Identity & Remote (already configured — do NOT change)

| Setting | Value |
|---|---|
| Repo user.name | `samuelvalla-9` |
| Repo user.email | `samuelvalla-9@users.noreply.github.com` |
| Remote `origin` | `https://samuelvalla-9@github.com/samuelvalla-9/Faven.git` |
| Branch | `main` (tracks `origin/main`) |
| Auth | PAT cached in Windows Credential Manager (Git Credential Manager) |

Rules:
- **Never** use `--global` git config. Identity is per-repo only — the machine's global identity belongs to an org (Cognizant EMU) account and must not appear in commits.
- **Never** embed tokens in the remote URL, commit them to files, or print them in output.
- **Never** commit as the org account. Before the first commit in a session, verify identity:
  ```powershell
  git config user.email   # must be samuelvalla-9@users.noreply.github.com
  ```

## Automated Commit & Push Workflow

After completing any code change (feature, fix, refactor, config), the agent MUST automatically commit and push without being asked, following these steps:

### 1. Review changes
```powershell
git status --short
git diff --stat
```

### 2. Safety checks (mandatory before staging)
- Confirm no secrets are staged: `.env` files, tokens, keys, credentials.
  ```powershell
  git check-ignore api/.env   # must output the path (i.e., ignored)
  ```
- Never force-add ignored files (`git add -f` is forbidden).
- If a new secret-like file appears (e.g. `*.pem`, `*credentials*`), add it to `.gitignore` first.

### 3. Stage
```powershell
git add -A
```
Or stage selectively if unrelated changes exist in the working tree.

### 4. Commit — message convention
Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short imperative summary>
```

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `perf`.
Scopes for this repo: `api`, `app`, `db`, `auth`, `reviews`, `restaurants`, `leaderboard`, `infra`.

Examples:
```powershell
git commit -m "feat(api): add pagination to restaurant listing"
git commit -m "fix(app): correct token refresh on 401 responses"
git commit -m "chore(db): update seed data for demo restaurants"
```

Guidelines:
- Summary ≤ 72 characters, imperative mood ("add", not "added").
- One logical change per commit. Split unrelated changes into separate commits.
- Add a body (`-m` twice) only when the "why" isn't obvious.

### 5. Push (always, immediately after committing)
```powershell
git push
```

### 6. Verify
```powershell
git status | Select-Object -First 3   # expect: "Your branch is up to date with 'origin/main'"
```

## One-liner template

For a typical change session:
```powershell
git add -A; git commit -m "<type>(<scope>): <summary>"; git push
```

## Documentation upkeep (mandatory)

Markdown docs are part of every change — keep them in sync in the SAME session as the code change:

1. **`IMPLEMENTATION_PLAN.md`** — after completing (or partially completing) any sprint item:
   - tick the checkbox `[ ]` → `[x]` and annotate what was actually built (file paths, key decisions),
   - update sprint status markers (`⬅ NEXT` / `⬅ IN PROGRESS` / `✅ COMPLETE`),
   - update the **Last updated** date in the header,
   - record new dev commands/gotchas in **Dev quick reference** and new key files in **Key files**.
2. **`GIT_PROTOCOL.md` / `.github/copilot-instructions.md`** — update when the workflow itself changes (new protocols, tooling rules).
3. Doc updates are committed with `docs(infra): ...` (or bundled with the feature commit when trivial), then pushed like any other change.
4. Never document secrets, tokens, or credentials in markdown files.

## Failure handling

| Symptom | Action |
|---|---|
| `403` / "Write access not granted" | PAT expired or lacks Contents:write. Ask the user for a new fine-grained PAT (repo `Faven`, Contents: Read/write), then re-cache: pipe `protocol/host/username/password` to `git credential approve`. |
| Push rejected (non-fast-forward) | `git pull --rebase` then `git push`. Never force-push to `main`. |
| Prompted for credentials | Credential cache lost — ask the user for the PAT; do not guess. |
| Wrong author on a commit | `git commit --amend --reset-author` (only if not yet pushed). |

## Hard rules summary

1. ✅ Commit and push automatically after every completed change — no need to ask.
2. ✅ Conventional Commit messages, generated from the actual diff.
3. ✅ Keep markdown docs (`IMPLEMENTATION_PLAN.md`, protocol files) updated in the same session as the change.
4. ❌ No force pushes to `main`.
5. ❌ No secrets in commits, messages, or remote URLs.
6. ❌ No global git config changes.
7. ❌ No history rewrites of pushed commits without explicit user approval.
