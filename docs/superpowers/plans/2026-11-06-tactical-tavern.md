# Tactical Tavern Implementation Plan

> Execute continuously with superpowers:subagent-driven-development. User approved the design and implementation; routine choices do not require another approval.

**Goal:** Deliver a playable exploration, party combat, settlement and story continuation loop while removing obsolete code.
**Architecture:** Pure TypeScript combat rules, per-script retrieval and validated director proposals, one persisted campaign state, React tactical UI. Existing Next.js, models and assets remain the foundation.
**Tech Stack:** Next.js 16.3, React 19, TypeScript, Node built-in test runner, existing dependencies only.
**Spec:** `docs/superpowers/specs/2026-11-06-tactical-tavern-design.md`.

## Global Constraints

- Four controlled party members, existing four classes, supported level 1–5 features, SRD 5.2.1.
- Default battlefield 12 × 8, 5 feet per square, diagonal step 5 feet.
- Authoritative numerical resolution in code; model supplies validated story/event proposals.
- Preserve old saves before migration; do not overwrite saves before hydration.
- No Git metadata exists here. Work in place, use the existing source ZIP backup, and retain the progress ledger instead of Git-only helper scripts.
- No new runtime dependencies or generic plugin/state frameworks.

## Review Focus

- A reaction interrupted by save/reload must resume exactly once.
- Repeated action/event IDs must not reroll or award twice.
- Zero HP, healing, concentration and an entire unconscious party must not deadlock turns.
- Script switches, same-name NPCs and future chapters must not mix knowledge.
- A stale model reply or invalid structured output must not overwrite a newer campaign.

## Task 1: Shared contracts and combat engine

Files: `lib/combat/types.ts`, `lib/combat/catalog.ts`, `lib/combat/engine.ts`, `tests/combat.test.ts`.

Interfaces: `createPartyMember(Character): Combatant`; `createBattle(Combatant[], EncounterSpec, rng?): BattleState`; `applyAction(BattleState, BattleAction, rng?): { battle: BattleState; error?: string }`; `advanceEnemyTurn(BattleState, rng?): BattleState`; `restParty(Combatant[], 'short'|'long', rng?): Combatant[]`; `getCurrentActor(BattleState): Combatant | undefined`; `getReachableCells(BattleState, actorId): Point[]`; `getAvailableSpells(Combatant): CombatSpell[]`.

- [x] Add Node test loader using installed TypeScript, and write behavioral tests first.
- [x] Implement legal actions, movement, path/line of sight/cover, attack/save distinctions and advantage, resources, supported spells, concentration, reactions, death saves, enemy turns, rest and idempotency.
- [x] Prove action rejection is non-mutating; cover pending reaction save/reload and zero-HP turn progression.
- [x] Run combat tests and TypeScript; document supported rules and exact limitations.

## Task 2: Per-script retrieval and model director

Files: `lib/adventure.ts`, `lib/retrieval.ts`, `app/api/chat/route.ts`, `tests/adventure.test.ts`.

Interfaces: `DirectorContext` carries Script, chapterId, visitedChapterIds, StoryMemory, partySummary, action, optional resolvedAction and turnNumber. `DirectorResult` carries narration, choices, optional validated event, and retrieval source IDs. `AdventureEvent` discriminates encounter, danger, discovery, reward, environment. Encounter uses whitelisted `EnemyKind` and bounded counts. `retrieveContext(context): RetrievedContext`; `parseDirectorResponse(text, context): DirectorResult`; `buildDirectorPrompt(context): string`.

- [x] Write tests for per-script isolation, future-secret exclusion, context budget, malformed event rejection and repeatable IDs.
- [x] Implement current/visited chapter plus explicit world knowledge retrieval with bounded text relevance ranking.
- [x] Preserve legacy chat clients; director mode returns both `content` and `director` with strict validation, request validation and an honest offline fallback.
- [x] Validate sources, references, proposed changes and encounter budgets; no raw model HP updates.
- [x] Run retrieval/director tests and scoped lint.

## Task 3: Campaign state and integration

Files: `lib/campaign.ts`, `lib/gameState.ts`, `lib/types.ts`, `app/game/page.tsx`, `app/page.tsx`, `app/scripts/page.tsx`, `tests/campaign.test.ts`.

Interfaces: `CampaignState extends TavernState` adds version, party, battle, visitedChapterIds, appliedEventIds, turnNumber and elapsedMinutes. `migrateCampaign(raw, character?): CampaignState`; `startScript(campaign, script): CampaignState`; `settleBattle(campaign): CampaignState`; `applyAdventureEvent(campaign, event): CampaignState`.

- [x] Test migration, hydration preservation, party edits, chapter branches, event replay and exactly-once rewards first.
- [x] Use one canonical party state; migrate old character, messages, script and memory without loss.
- [x] Replace monolithic game page handlers with explicit exploration/battle/settlement rendering and snapshot-checked director requests.
- [x] Add out-of-combat party formation, rests and resumable battles; preserve settings, history, journal and existing workshop entry points.
- [x] Fix pre-hydration save writes in the hall and script workshop.

## Task 4: Tactical battle UI

Files: `components/BattleStage.tsx`, `components/PartyPanel.tsx`, `app/globals.css`.

Consumes Task 1 contracts. Props: battle and `onAction(BattleAction)`, no local rule mutation.

- [x] Render initiative, turn resources, grid, movement range, occupied cells, targets, terrain, party/enemy HP and readable rules log.
- [x] Provide attacks, movement, supported spells/slots, items, defensive actions, reactions and end-turn controls with clear costs/errors.
- [x] Preview selected action/target and area, confirm actions, block double submits and highlight enemy turn.
- [x] Preserve existing dark/gold fantasy identity; responsive/keyboard/touch/reduced-motion support.
- [x] Verify real browser party setup, encounter, reaction, combat completion and reload.

## Task 5: Remove dead paths and complete verification

Files: obsolete DiceRoller, portrait matting/prewarm and unused SVG, superseded outcome/parse handlers; `README.md`, `docs/rules-support.md`.

- [x] Remove only proven dead callers and obsolete duplication; preserve live avatar SVG fallbacks and asset-processing scripts.
- [x] Write project-specific startup, gameplay, test, model setup and supported-rule documentation.
- [x] Run full Node suite, TypeScript, scoped/full lint, production build and browser flow.
- [x] Request fresh full-change review, fix important findings, rerun affected proof and report any limits honestly.

## Execution Record

Progress, adaptations and verification evidence live in `.superpowers/sdd/tactical-tavern/progress.md`. Tasks 1 and 2 are independent after shared contracts; the root agent integrates Tasks 3–5 while specialist agents implement and verify 1–2. No commit/push/publish is requested or possible without Git metadata.
