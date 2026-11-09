# Tactical combat rules and boundaries

The local TypeScript engine resolves combat. Story models cannot set damage, HP, dice, slots or rewards directly. The supported rules reference is the 2024 revision / SRD 5.2.1, with the explicit game adaptations below.

## Supported mechanics

- Combat is presented as a turn panel with target distances, cover and named movement routes. The engine still measures paths on a 12 × 8 map, 5 feet per cell and diagonal step, with difficult terrain, crawling, standing for half speed, walls, half cover and occupied cells.
- Initiative rolls with stable party/enemy insertion order for ties. Movement, action, bonus action and reaction are tracked independently. Reaction refresh occurs at the start of the creature's turn.
- Weapon and spell attacks versus AC; normal/long range, adjacent-hostile ranged disadvantage, advantage/disadvantage cancellation, natural 1 misses, natural 20 criticals and doubled damage dice. Saving throws use a separate DC comparison without automatic natural-1/20 outcomes.
- Dash, Disengage, Dodge, Hide and emergency stabilization. Supported conditions affect movement, attacks, saves or available actions. See the state and geometry adaptations below.
- One concentration effect per caster. Starting another ends the previous effect; damage checks Constitution against DC 10 or half damage, capped at 30. Becoming incapacitated or reaching zero HP ends concentration. Cleanup removes only effects linked to that caster and spell.
- Opportunity attacks interrupt before leaving reach. Shield and Uncanny Dodge interrupt hits. Pending prompts contain the original roll/damage and remaining movement, including opportunity → Shield/Uncanny Dodge chains, so JSON saves resume without rerolling completed attacks.
- Unconscious party members make death saves at turn start while combat can continue, including a linked Bless d4. Natural 1 gives two failures; natural 20 heals 1 HP. Three successes stabilize, three failures kill; damage at zero adds failures while preserving existing successes. Massive damage is handled. Healing removes unconsciousness, resets death saves and retains prone. Dead combatants cannot be healed. Healing never automatically replenishes other resources.

These mechanisms follow the [official rules glossary](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary) and [combat and death rules](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game).

## Curated level 1–5 classes

| Class | Supported class mechanics |
| --- | --- |
| Wizard | Full-caster slots; Fire Bolt scaling at level 5; once-per-long-rest Arcane Recovery after a short rest |
| Ranger | Spellcasting from level 1; Favored Enemy free Hunter's Mark uses; Extra Attack at level 5 |
| Paladin | Spellcasting and Lay on Hands from level 1; level-2 Divine Smite with one free casting per long rest; level-5 Extra Attack |
| Rogue | Finesse/ranged Sneak Attack once per turn, scaling 1d6/2d6/3d6; level-2 Cunning Action; level-5 Uncanny Dodge |

Only one spell slot can be expended per turn, including a reaction on that turn. Free feature castings do not consume a slot. Both turn flags reset when any creature starts a new turn. See [official classes](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes) and [spellcasting rules](https://www.dndbeyond.com/sources/dnd/br-2024/spells).

| Spell or feature | Implementation |
| --- | --- |
| Fire Bolt | Ranged spell attack, 1d10 fire; 2d10 at level 5 |
| Magic Missile | Automatic-hit force darts; more darts with higher slots; Shield blocks |
| Shield | Reaction, +5 AC through the start of the caster's next turn, including the triggering attack |
| Thunderwave | Constitution save, 15-foot cube, half on success; failed save pushes 10 feet without opportunity attacks; upcasts |
| Fireball | Available at level 5, area Dexterity saves, 8d6 fire, half on success; includes allies |
| Hunter's Mark | Bonus action, concentration, extra 1d6 force on attack-roll hits; free bonus-action transfer after the marked target drops; original duration retained |
| Cure Wounds | Touch healing, 2d8 plus casting modifier, another 2d8 per higher slot |
| Lay on Hands | Bonus action, shared pool of five HP per paladin level |
| Divine Smite | Bonus action immediately after a melee hit; radiant dice, upcasting, critical doubling, extra die against the skeleton template |
| Bless | Concentration; attack rolls and saves gain 1d4; upcasting increases targets |

Spell details were checked against the [official spell descriptions](https://www.dndbeyond.com/sources/dnd/br-2024/spell-descriptions), [Magic Missile](https://www.dndbeyond.com/spells/2619022-magic-missile), [Thunderwave](https://www.dndbeyond.com/spells/2619184-thunderwave), [Cure Wounds](https://www.dndbeyond.com/spells/2619079-cure-wounds) and [Hunter's Mark](https://www.dndbeyond.com/spells/2619166-hunters-mark).

## Explicit game adaptations and omissions

- Story checks have four outcomes based on the total's margin against the DC: great failure at −5 or below, failure from −4 to −1, success from 0 to +4, and great success at +5 or above. This campaign rule does not apply to combat attacks or saves. Required checks advance along an authored branch even on failure, with costs and rewards limited to the scene.
- This is a curated tactical subset, not a complete tabletop character builder. Class names in Chinese or English select the supported class. Existing character HP, ability scores and AC are retained; raising a stored level does not generate HP, ability increases, feats or equipment. Levels outside 1–5 are clamped during conversion.
- Supported catalog spells are prepared automatically. Inventory spell names, old display-only powers and free-form character notes do not grant mechanical powers. Subclasses, weapon masteries, fighting styles, feats, Steady Aim, Cunning Strike, Channel Divinity, mounts and the remaining spells and features are outside this release.
- Character builds with species traits enabled have a small set of tactical differences. Wood elves walk 35 feet. Dwarves gain 1 extra maximum HP per level and resist poison damage. Tieflings and dragonborn resist fire damage. The equipped weapon is chosen from fixed class templates, with a warhammer for a dwarf paladin with species traits enabled. Inventory descriptions do not change damage or AC. No ammunition counting, weapon switching, offhand attacks, improvised attacks, grapple/shove, unarmed opportunity attacks or object interactions are implemented.
- Movement conservatively forbids passing through every occupied living creature's square, including allies, and diagonal wall corners. Only full walls and +2 half cover exist. Grid-center ray tracing is a practical 2D approximation; there is no three-quarters cover, lighting, facing, verticality, flying or creature-size geometry. Distances and area radii use the same five-foot diagonal convention; a radius therefore appears square on this grid.
- Thunderwave supports the four cardinal orientations. Its selected point is the cube center, exactly two cells from the caster. Bless automatically selects the chosen ally and the nearest additional eligible allies. Magic Missile sends every dart to one chosen target, uses one shared dart roll and aggregates damage into one damage/concentration event. Full tabletop target allocation is omitted.
- Hunter's Mark tracking-check advantage is outside combat. Lay on Hands automatically spends up to the target's missing HP and remaining pool; curing poison and selecting a smaller amount are omitted. Smite's extra creature-type die is represented only by the curated skeleton opponent. Damage resistance is limited to the species traits listed above.
- Hide requires leaving every enemy's unobstructed line of sight and DC 15 Stealth. It grants attack advantage and ends after an attack or casting a supported verbal spell. Light/obscurement, a Search action, stored discovery DC and the complete Invisible-condition model are omitted. Supplied poisoned/restrained/stunned conditions have their relevant attack/save/incapacity effects; there are no catalog powers applying these conditions and no generic escape or duration-save framework.
- Enemy templates are curated game opponents with fixed statistics and rewards, not full official monster statblocks. The local controller plans shortest legal paths to squares satisfying both attack range and line of sight, selects a reachable conscious opponent, and follows only the affordable movement prefix before attacking and ending its turn. Detours can temporarily increase direct distance to the target. Encounter difficulty currently informs proposal validation/UI rather than changing template statistics.
- Any wholly incapacitated party loses the encounter immediately, including unconscious but living members; defeat does not mean all characters died. This intentionally ends the tactical encounter instead of rolling indefinitely with no player actions. Enemies die at zero HP. Battle completion clears encounter-bound concentration links. A stable character's automatic recovery after 1d4 hours is not simulated.
- A healing potion is a self-only bonus action, restores 2d4+2 HP and consumes an inventory entry or its `xN` suffix. Other consumables are unsupported. Retreat is a game action from the left map boundary and withdraws the whole party.
- Short rest automatically spends hit dice until healed or exhausted, and Wizard Arcane Recovery prefers higher eligible slots. Long rest restores HP, all spent hit dice, slots and daily class pools. A character must have positive HP to benefit; rests never resurrect. The campaign records one/eight hours; interruption, supplies, exhaustion and the once-per-24-hour long-rest restriction are not simulated.

## Persistence and API

Campaign settlement shares experience among party members and advances the supported level range at 300/900/2700/6500 XP. Level-up adds average class hit points and new supported resources while retaining existing wounds and spent spell slots. It does not implement the complete tabletop advancement choices such as feats or ability-score improvements.

`applyAction` returns a new snapshot for a newly accepted action. Rejection returns the identical input snapshot and an error. Already processed action IDs return the identical snapshot without spending or rolling again. The UI must persist the full returned battle, including `processedActionIds` and `pendingReaction`, and use a fresh ID for each new intent.

The engine exports `createPartyMember`, `createBattle`, `applyAction`, `advanceEnemyTurn`, `restParty`, `getCurrentActor`, `getReachableCells` and `getAvailableSpells`. Spells are also exported from `catalog.ts`. Cunning Action uses `useBonusAction: true`; standing uses a `move` action whose point is the actor's current cell. Reactions submit `react` with the pending reactor's ID and `accept` or `decline`.

## Attribution

This work includes material from the System Reference Document 5.2.1 by Wizards of the Coast LLC, available at [dndbeyond.com/srd](https://www.dndbeyond.com/srd), licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). This implementation is an independent adaptation with the limitations listed above.
