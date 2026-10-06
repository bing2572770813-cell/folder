# Git Version Workflow

## Authoritative Versions

- `main` is the integrated version. Pull requests target `main`.
- Work on a named `codex/...` branch; push that branch and merge through a reviewed PR.
- A browser preview serves the checkout configured by its server process. Its port alone does not identify the Git version. Report the branch, commit, checkout, and URL together.
- Use `git worktree list`, `git branch -vv`, and `git status --short` before switching branches or changing previews.

## Dependencies And Build Artifacts

- Commit `work/package.json` and `work/package-lock.json`.
- Never commit `work/node_modules/` or `work/backend/dist/`. Ignore rules do not remove already tracked files; confirm with `git ls-files work/node_modules work/backend/dist`.
- Use `npm ci --prefix work` to install the locked dependency versions in a clean checkout.
- `outputs/index.html` and `outputs/game.html` are tracked standalone deliverables. Rebuild them with `npm --prefix work run build` after source changes; do not manually combine minified bundle conflicts.
- If generated HTML conflicts, first preserve both versions and any local source edits, resolve the source conflicts, and rebuild the HTML from the selected source version.

## Pull And Stash Recovery

1. Inspect `git status`, staged changes, untracked files, and `git stash list`.
2. Commit coherent source changes or explicitly preserve local work before pulling. Never include installation-only dependency changes.
3. Prefer `git pull --ff-only` on `main`. A failed fast-forward is a reason to inspect divergence, not to reset or force-push.
4. A pull can finish while restoring an autostash fails. Check `git ls-files -u` and merge/rebase state separately; do not run `git merge --abort` when no merge is active.
5. Keep a recovery stash until its changes have been inspected and retained or deliberately replaced. Avoid repeatedly applying the same stash.

## Local Drafts

- Keep existing design drafts and experimental files out of unrelated commits.
- Untracked files are not a conflict or a failed merge. Keep them visible unless the owner intentionally chooses a local-only archive or explicit ignore rule.
- Preserve obsolete branch tips before retirement; do not delete branches with unmerged commits merely to make the branch list shorter.

## Verification Before Integration

Run `npm --prefix work run backend:test`, `npm --prefix work test`, and `npm --prefix work run build`. Check the browser workflows affected by the change, `git diff --check`, and the staged file list. Push only the intended branch. After merging, verify the remote `main` commit and fast-forward the local checkout, then serve that same checkout for the primary preview.

The dependency-untracking change removes files only from the Git index. Existing installed packages remain on disk; historical commits and a pre-repair recovery bundle retain the old tracked content.
