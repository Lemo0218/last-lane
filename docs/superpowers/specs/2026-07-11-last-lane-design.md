# Last Lane Design

## Product goal

Build a mobile-first endless zombie shooter that turns the familiar mobile-ad minigame into the complete game. A run lasts roughly three to five minutes for an average player, difficulty rises continuously, and a public online leaderboard makes repeated runs meaningful.

## Core loop

The player drags a squad left and right while the squad fires automatically toward incoming zombies. Each encounter asks the player to choose a route through troop, fire-rate, damage, or recovery gates. Zombies arrive in readable formations, with elite enemies and a boss cadence. The run ends when the squad is eliminated. Score comes from distance, kills, elites, bosses, close calls, and an increasing survival multiplier.

Controls must work with touch, mouse, and keyboard. A short first-run overlay teaches drag movement, automatic fire, and gate choices without stopping play for long.

## Fair difficulty

Difficulty may become punishing but must not create an impossible state by construction.

- Generate a traversable route first, then decorate it with threats and rewards.
- Use deterministic seeded waves and validate each generated segment against the player's conservative effective squad power.
- Guarantee at least one lane whose projected damage cost is survivable when the segment appears.
- Prevent overlapping blockers from closing the full playfield.
- Telegraph elite and boss attacks and reserve an escape corridor.
- Offer a recovery or troop-building opportunity before scheduled bosses.
- Increase pressure through narrower timing windows, faster enemies, mixed formations, and harder trade-offs rather than unavoidable damage.
- If validation fails, regenerate from a bounded fallback library of known-solvable patterns.

## Scoring and progression

Runs use a daily deterministic challenge seed plus a standard endless mode. The first release exposes the standard run and records the player's best score. Difficulty is driven by elapsed time and cleared segments. Every 30 seconds introduces a modest tier increase; bosses appear at predictable milestones with varied attack patterns.

The HUD shows score, elapsed time, squad count, combo multiplier, and current difficulty. The end screen shows score breakdown, personal best, rank, nickname entry, replay, and leaderboard.

## Ranking integrity

The client submits a compact run transcript: seed, timestamped lane inputs, gate choices, encounter outcomes, and final score. The server replays the deterministic simulation and accepts only scores matching the authoritative result within strict limits. Submissions are rate-limited and tied to an anonymous device identifier plus nickname. The public leaderboard stores nickname, verified score, survival time, and creation date. Offensive or empty nicknames are rejected at the boundary.

## Architecture

- React, TypeScript, and Vite provide the application shell.
- A custom HTML Canvas renderer and fixed-timestep simulation provide consistent mobile gameplay.
- Pure domain modules own deterministic RNG, spawning, fairness validation, combat, scoring, and transcript replay.
- React owns menus, HUD overlays, nickname flow, results, accessibility controls, and leaderboard.
- Vercel Functions expose leaderboard reads and verified score submission.
- Neon Postgres stores leaderboard entries through a server-only connection.
- Zod parses all network and storage boundaries.

The game remains playable offline. If ranking services are unavailable, the result is stored locally and the UI offers a retry when connectivity returns.

## Visual direction

Use a polished top-down military arcade style: dark asphalt and ruined-city surfaces, high-contrast cyan player units, toxic red/orange enemies, warm gold gates and rewards, and restrained bloom. Units are rendered as lightweight vector-like Canvas shapes with readable silhouettes, particles, muzzle flashes, shadows, and hit feedback. This avoids dependency on unlicensed art and keeps performance predictable. UI typography is bold and condensed for scores, with clean Korean labels elsewhere.

## Mobile experience and accessibility

Portrait is primary, with a centered playfield on larger screens. Touch targets are at least 44 pixels. The game respects safe areas and reduced-motion preferences, supports keyboard movement, includes pause and sound controls, and never relies on color alone for gate meaning. Audio starts only after user interaction.

## Testing and release gates

- Unit tests cover deterministic simulation, scoring, difficulty curves, and fairness validation.
- API tests cover score verification, parsing, rate limits, and leaderboard ordering.
- End-to-end tests drive a complete run through the browser and verify result submission behavior.
- Manual QA plays the production build through touch-equivalent pointer controls on a mobile viewport.
- Production release requires clean type checks, passing tests, a successful build, and a live Vercel URL that loads and completes a run.

## Scope boundaries

The first production release includes one polished environment, standard endless mode, anonymous nickname-based online ranking, sound effects, local best score, pause/resume, and installable PWA behavior. Accounts, purchases, clans, chat, multiple maps, and cosmetic inventory are intentionally excluded.
