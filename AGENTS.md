# Repository workflow

- Repository remote: `https://github.com/bing2572770813-cell/folder.git` (`origin`).
- Commit every new feature during implementation; do not leave completed features uncommitted until a later push.
- Split commits into the smallest coherent, working implementation units. Prefer many focused commits over a single broad commit.
- Keep unrelated changes out of each commit and use messages describing the concrete change.
- Run checks appropriate to each change before committing.
- Push when the user requests it.
- Unless the user explicitly requests a separate documentation commit, include related documentation updates in the corresponding feature or fix commit; do not add a standalone documentation follow-up commit.

- All player-related state machines and player interaction logic must be implemented in `work/player.cjs`.
- A region means the set of map cells sharing the same `regionTag`, irrespective of spatial connectivity. Region names are unique identifiers.
