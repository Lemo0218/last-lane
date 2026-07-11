# Last Lane Design

## Product goal

Build a mobile-first endless zombie shooter that turns the familiar mobile-ad minigame into the complete game. A run lasts roughly three to five minutes for an average player, difficulty rises continuously, and a public online leaderboard makes repeated runs meaningful.

## Core loop

The player drags a squad left and right while the squad fires automatically toward incoming zombies. Each encounter asks the player to choose a route through troop, fire-rate, damage, or recovery gates. Zombies arrive in readable formations, with elite enemies and a boss cadence. The run ends when the squad is eliminated. Score comes from distance, kills, elites, bosses, close calls, and an increasing survival multiplier.

Controls must work with touch, mouse, and keyboard. A short first-run overlay teaches drag movement, automatic fire, and gate choices without stopping play for long.

## Fair difficulty

Difficulty may become punishing but must not create an impossible state by construction.

- Generate a traversable route first, then decorate it with threats and rewards.
- A segment contract receives the exact entry state: squad count and upgrades, player x-position and velocity, playfield width, collision radii, and the two preceding committed segments. Movement is bounded by the real simulation's maximum lateral speed; the solver adds a 250 ms reaction delay and may only emit the same quantized left, neutral, and right inputs available to a player.
- A deterministic reachability solver searches the complete segment horizon and must produce a witness input path that finishes with at least one soldier. The generator replays that witness through the production fixed-timestep simulation before accepting the segment.
- Every accepted segment guarantees one continuous path reachable from the actual entry x-position. Fairness never means merely that an isolated lane has enough damage capacity.
- Prevent overlapping blockers from closing the full playfield.
- Telegraph elite and boss attacks and reserve an escape corridor.
- Validate the composed recovery-choice, boss entrance, and boss fight as one horizon. At least one offered pre-boss choice must produce a witness path that survives the boss from the actual incoming state.
- Increase pressure through narrower timing windows, faster enemies, mixed formations, and harder trade-offs rather than unavoidable damage.
- If validation fails, regenerate from a bounded fallback library. Every fallback declares machine-checkable entry preconditions and ships with solver witnesses replayed by tests.

## Scoring and progression

The first release exposes a standard endless mode and records verified runs. A three-to-five-minute run is a balancing target for the median new player, not a forced endpoint. Difficulty is driven by elapsed time and cleared segments. Every 30 seconds introduces a modest tier increase; bosses appear at predictable milestones with varied attack patterns. A daily challenge is deferred.

The HUD shows score, elapsed time, squad count, combo multiplier, and current difficulty. The end screen shows score breakdown, personal best, rank, nickname entry, replay, and leaderboard.

## Ranking integrity

Ranked play starts by requesting a server-issued run ticket containing a random server seed, one-time nonce, issue/expiry times, and simulation ruleset version, authenticated with a server-only HMAC. The client cannot choose ranked seeds. Tickets expire after ten minutes and each nonce creates at most one immutable result, making retries idempotent and replays harmless.

The client submits only its ticket, nickname, and a quantized input transcript. Movement is encoded as changes among left, neutral, and right on fixed ticks; score, kills, encounters, and outcomes are derived by the verifier. A run is capped at ten minutes, 2,400 input changes, and a 128 KiB request. The verifier uses integer/fixed-point numeric rules, rejects unknown rulesets, and aborts beyond a measured function time budget.

Offline play remains available but is explicitly unranked because it cannot obtain a fresh ticket. Ranked issuance and submission use layered IP throttling, strict payload limits, ticket expiry, single-use nonces, and Vercel firewall protections. A browser identifier is used only for local convenience, never as a security boundary.

Each accepted nonce produces one leaderboard row. The board shows the best verified run per normalized nickname, while retaining immutable run records for audit. A player may enter a different nickname on a later run; names do not represent accounts. Ties sort by score descending, survival time descending, then earliest verified submission. Nicknames are normalized, length-limited, filtered for a compact blocklist, and can be administratively hidden. Only coarse submission time is retained; raw IP addresses are not stored by the application.

## Architecture

- React, TypeScript, and Vite provide the application shell.
- A custom HTML Canvas renderer and fixed-timestep simulation provide consistent mobile gameplay.
- Pure domain modules own deterministic RNG, spawning, fairness validation, combat, scoring, and transcript replay.
- React owns menus, HUD overlays, nickname flow, results, accessibility controls, and leaderboard.
- Vercel Functions expose leaderboard reads and verified score submission.
- Vercel Blob stores each verified result as an immutable nonce-keyed object. Listing and sorting are bounded to the retained recent/high-score result set; this avoids a paid database dependency for the initial personal release while preserving concurrent, append-only writes.
- Zod parses all network and storage boundaries.

The game remains playable offline, but offline results are local and unranked. If submission of an already ticketed ranked run fails, the bounded transcript is queued locally and retried idempotently until its ticket expires.

## Visual direction

Use a polished top-down military arcade style: dark asphalt and ruined-city surfaces, high-contrast cyan player units, toxic red/orange enemies, warm gold gates and rewards, and restrained bloom. Units are rendered as lightweight vector-like Canvas shapes with readable silhouettes, particles, muzzle flashes, shadows, and hit feedback. This avoids dependency on unlicensed art and keeps performance predictable. UI typography is bold and condensed for scores, with clean Korean labels elsewhere.

## Mobile experience and accessibility

Portrait is primary, with a centered playfield on larger screens. Touch targets are at least 44 pixels. The game respects safe areas and reduced-motion preferences, supports keyboard movement, includes pause and sound controls, and never relies on color alone for gate meaning. Audio starts only after user interaction.

## Testing and release gates

- Unit tests cover deterministic simulation, scoring, difficulty curves, and fairness validation.
- Property tests generate varied legal entry states and segments, require a solver witness, and replay every witness through the production simulation. Boss tests cover the composed recovery-plus-boss horizon.
- Cross-runtime golden transcripts prove identical client and server results for each supported ruleset.
- API tests cover parsing, tampered/expired/replayed tickets, idempotent retries, payload and event caps, verification time limits, rate limits, nickname normalization, concurrent immutable writes, and deterministic tie ordering.
- End-to-end tests drive a complete run through the browser and verify result submission behavior.
- Manual QA plays the production build through touch-equivalent pointer controls on a mobile viewport.
- Performance QA checks frame time and memory with the maximum visible entity count, as well as resize, background/resume, reduced motion, PWA installation, and offline asset loading.
- The worst accepted ten-minute transcript is benchmarked within the deployed Vercel Function budget.
- Production release requires clean type checks, passing tests, a successful build, and a live Vercel URL that loads and completes a run.

## Scope boundaries

The first production release includes one polished environment, standard endless mode, anonymous nickname-based online ranking, sound effects, local best score, pause/resume, and installable PWA behavior. Accounts, purchases, clans, chat, multiple maps, and cosmetic inventory are intentionally excluded.
