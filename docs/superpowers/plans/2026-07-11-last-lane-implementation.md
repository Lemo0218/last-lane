# Last Lane Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a mobile-first Canvas zombie survival game with fair deterministic waves, three-to-five-minute median runs, verified online rankings, and a live Vercel deployment.

**Architecture:** A Vite React shell hosts a fixed-timestep TypeScript simulation and Canvas renderer. Pure domain modules produce deterministic waves, replay transcripts, and calculate scores; Vercel Functions reuse those modules to issue signed tickets, verify runs, and persist append-only leaderboard projections in Vercel Blob.

**Tech Stack:** React 19, TypeScript 5, Vite 7, Vitest, fast-check, Zod, Vercel Functions, Vercel Blob, Playwright, Canvas 2D, Web Audio, vite-plugin-pwa.

---

## File map

- `src/game/types.ts`: branded units and simulation contracts.
- `src/game/config.ts`: versioned numeric ruleset.
- `src/game/rng.ts`: deterministic integer RNG.
- `src/game/simulation.ts`: fixed-timestep state transition.
- `src/game/waves.ts`: fair segment candidates and fallback patterns.
- `src/game/solver.ts`: bounded reachability solver and witness output.
- `src/game/scoring.ts`: derived score calculation.
- `src/game/transcript.ts`: quantized input recording and replay.
- `src/game/GameCanvas.tsx`: input lifecycle and Canvas host.
- `src/game/renderer.ts`: draw-only Canvas renderer.
- `src/game/audio.ts`: gesture-unlocked synthesized effects.
- `src/ui/*`: start, HUD, pause, result, nickname, leaderboard.
- `src/api/contracts.ts`: Zod request/response boundaries shared by client/functions.
- `src/ranking/retry-queue.ts`: bounded ticket-aware client submission retry queue.
- `src/ranking/client.ts`: typed ticket, submission, and leaderboard HTTP client.
- `src/ranking/ranked-run.ts`: ranked session controller connecting ticket, transcript, submission, retry, and rank refresh.
- `src/server/rate-limit.ts`: IP-keyed issuance/submission throttling without persistence.
- `src/server/nicknames.ts`: normalization, length limits, and compact blocklist.
- `api/run-ticket.ts`: signed ranked ticket issuance.
- `api/submit-score.ts`: authoritative replay and Blob publication.
- `api/leaderboard.ts`: bounded lexicographic top-100 read.
- `api/reconcile.ts`: bounded pending projection repair.
- `tests/*`: unit/property/API/E2E coverage.

### Task 1: Scaffold and quality gates

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig*.json`, `vitest.config.ts`, `playwright.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `.gitignore`, `vercel.json`.

- [ ] Write `tests/smoke/app.test.tsx` expecting the start screen title and accessible play button.
- [ ] Run `npm test -- app.test.tsx`; confirm failure because the app does not exist.
- [ ] Scaffold strict Vite React with Biome/TypeScript/Vitest/Testing Library and the minimal start screen.
- [ ] Run typecheck, lint, and smoke test; expect all to pass.
- [ ] Commit `chore: scaffold Last Lane web app`.

### Task 2: Deterministic simulation and scoring

**Files:** Create `src/game/types.ts`, `config.ts`, `rng.ts`, `simulation.ts`, `scoring.ts`; tests in `tests/game/`.

- [ ] Write failing Given/When/Then tests for seeded RNG equality, fixed-step movement bounds, automatic fire, zombie damage, gate effects, boss cadence, combo decay, zero squad, maximum entities, pause, and run completion. Score tests independently assert distance, basic kills, elites, bosses, close calls, increasing survival multiplier, and the final integer breakdown.
- [ ] Run focused Vitest files and confirm behavioral failures.
- [ ] Implement branded tick/position/score types, exhaustive events, integer arithmetic, and pure `stepSimulation`.
- [ ] Run tests and typecheck; commit `feat: add deterministic combat simulation`.

### Task 3: Fair wave generation

**Files:** Create `src/game/waves.ts`, `solver.ts`, `fallbacks.ts`; tests `tests/game/solver.test.ts`, `solver.property.test.ts`, `solver.bench.ts`.

- [ ] Write failing examples where a visually open lane is unreachable from entry x, blockers close the field, no escape corridor exists, and a pre-boss reward still leads to death.
- [ ] Write fast-check properties over exact entry squad/upgrades/x/velocity, field width, radii, and two committed segments. Require 250 ms delayed left/neutral/right inputs, a least-damaged witness, one remaining soldier, and a replay-identical production outcome.
- [ ] Write failing composed recovery-choice + boss properties, fallback precondition/witness tests, and six/twelve-second benchmark tests with explicit 4 ms fallback acceptance.
- [ ] Implement 10 Hz discretized reachability with state deduplication, six/twelve-second horizons, escape-corridor/blocker invariants, least-damaged witness retention, 4 ms generation budget, and prevalidated fallbacks with machine-readable entry contracts.
- [ ] Run unit/property tests and worst-case benchmark; require fallback activation without frame stalls.
- [ ] Commit `feat: guarantee solvable zombie waves`.

### Task 4: Playable Canvas surface

**Files:** Create `src/game/GameCanvas.tsx`, `renderer.ts`, `input.ts`, `audio.ts`, `src/ui/Hud.tsx`, `PauseMenu.tsx`; modify `src/App.tsx`, `styles.css`.

- [ ] Write component tests for pointer drag, keyboard input, pause/resume, resize, reduced motion, visibility backgrounding, and sound unlock.
- [ ] Confirm tests fail before implementation.
- [ ] Implement requestAnimationFrame loop with accumulator, capped catch-up, DPR-aware resize, touch-action containment, and cleanup-safe listeners.
- [ ] Draw the road, squad, gates, bullets, varied zombies, elites, bosses, particles, and telegraphs using Canvas primitives; implement and component-test HUD score, elapsed time, squad count, combo multiplier, and difficulty tier.
- [ ] Add synthesized firing/hit/gate/boss sounds and mute control.
- [ ] Run tests and manually play with mouse plus mobile-emulated pointer; commit `feat: build mobile Canvas game`.

### Task 5: Menus, results, local progress, and PWA

**Files:** Create `src/ui/StartScreen.tsx`, `ResultScreen.tsx`, `Leaderboard.tsx`, `Tutorial.tsx`, `src/storage/local.ts`, `src/ranking/retry-queue.ts`, `src/ranking/client.ts`, `src/ranking/ranked-run.ts`, `public/manifest.webmanifest`, `public/icons/icon-192.svg`, `public/icons/icon-512.svg`; modify `vite.config.ts`, `src/App.tsx`, `src/styles.css`.

- [ ] Write failing tests for tutorial persistence, local best, play-again, offline label, installable metadata, and a bounded ticket-aware retry queue that stops at the submission deadline.
- [ ] Write failing controller/component tests for pre-run ticket request, fixed-tick left/neutral/right change recording in `src/game/transcript.ts`, `{ticket,nickname,transcript}` submission, failed submission queueing, leaderboard fetch, returned rank, and results showing score breakdown, personal best, nickname, replay, and leaderboard actions.
- [ ] Implement polished portrait-first UI, safe areas, 44 px controls, Korean copy, focus management, local best, complete result actions/fields, and reduced-motion styling.
- [ ] Implement typed ranked HTTP client and session controller, connect it to App/GameCanvas lifecycle, record only quantized input changes, submit completed ranked runs, queue transient failures, and refresh leaderboard/rank after acceptance.
- [ ] Configure PWA asset caching and an explicit unranked offline flow.
- [ ] Run component tests, Lighthouse-oriented build checks, and offline reload via Playwright.
- [ ] Commit `feat: add results progression and offline PWA`.

### Task 6: Ranked replay API and Blob leaderboard

**Files:** Create `src/api/contracts.ts`, `src/server/ticket.ts`, `src/server/verifier.ts`, `src/server/blob-store.ts`, `src/server/rate-limit.ts`, `src/server/nicknames.ts`, `api/run-ticket.ts`, `api/submit-score.ts`, `api/leaderboard.ts`, `api/reconcile.ts`; tests `tests/api/ticket.test.ts`, `verify.test.ts`, `ranking-store.test.ts`, `rate-limit.test.ts`, `reconcile.test.ts`, `golden-replay.test.ts`, `verifier.bench.ts`.

- [ ] Write failing tests for HMAC tickets, submission deadlines, expired/replayed/tampered tickets, unknown rulesets, duration derived from ticks, derived score, 128 KiB/2,400-event/ten-minute caps, verification timeout, nickname normalization/length/blocklist, deterministic ties, coarse timestamps/no IP persistence, and layered IP throttles.
- [ ] Write failing golden replay and worst-case verifier benchmarks with a 2 s local ceiling and a deployed ceiling below the configured Vercel Function duration.
- [ ] Write failing store tests for `addRandomSuffix:false`, `allowOverwrite:false`, pending→score→run→delete ordering, digest/result match, identical/conflicting nonce concurrency, post-deadline repair, 24h `failed/` quarantine, lexicographic ordering, and injected post-pending failure with 101 published runs.
- [ ] Implement server-issued seed/nonce tickets, fixed-point transcript replay, timeout checks, strict input limits, normalization/blocklist, and IP throttling without application IP storage.
- [ ] Implement deterministic `pending/`, `scores/`, `runs/`, and `failed/` Blob objects, bounded top-100 listing, repair after expiry, and authenticated bounded cron reconciliation.
- [ ] Implement local in-memory store adapter for tests and unconfigured preview fallback; production ranking must fail visibly rather than fake persistence.
- [ ] Run cross-runtime golden transcripts, store concurrency tests, and worst-case verifier benchmark; require all thresholds to pass.
- [ ] Commit `feat: add verified online leaderboard`.

### Task 7: End-to-end behavior and tuning

**Files:** Create `tests/e2e/play.spec.ts`, `ranked.spec.ts`, `mobile.spec.ts`; tune `src/game/config.ts` and visual CSS only through test-backed changes.

- [ ] Write E2E scenarios for tutorial-to-run-to-result, ranked submission/top-board display, queued retry/expiry, pause/background/resume, offline run, and 390x844 touch-equivalent pointer controls.
- [ ] Run Playwright and confirm missing behaviors before finishing adapters.
- [ ] Add failing deterministic tuning assertions: conservative fixture reaches 150–210 seconds, expert witness exceeds 300 seconds, and every accepted segment remains solvable.
- [ ] Add a failing Playwright performance gate for maximum visible entities with p95 frame work below 16 ms on the local QA machine and bounded entity/effect pools.
- [ ] Tune difficulty and pool visual effects until tuning and performance gates pass without changing combat outcomes or weakening fairness assertions.
- [ ] Run full test, typecheck, lint, build, and E2E suites.
- [ ] Commit `test: verify complete mobile game flow`.

### Task 8: GitHub and Vercel production release

**Files:** Modify `README.md`, `vercel.json`; configure Vercel project environment and firewall outside Git; no secrets committed.

- [ ] Create the GitHub repository under the authenticated account, set commit email to `kmh8667@gmail.com`, push `main`, and verify the remote tree.
- [ ] Link a new Vercel project and create/connect a Vercel Blob store.
- [ ] Generate `RUN_TICKET_SECRET` and `CRON_SECRET`, configure production/preview environments, authenticated reconciliation cron, function duration, and deployed issuance/submission firewall/rate-limit rules.
- [ ] Deploy production, inspect build/function logs, call ticket/submit/leaderboard/reconcile endpoints, and run the worst accepted verifier payload within the deployed duration budget.
- [ ] Drive a complete real production run with touch-equivalent pointer controls on a mobile viewport and verify live result completion, score publication, and reload persistence.
- [ ] Run final local verification, check Git/Vercel status, and report live URL, GitHub URL, tests, and limitations.
