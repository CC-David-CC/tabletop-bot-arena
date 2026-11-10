> Original design reference from 2026-10-30. This describes intended behavior, not current implementation or qualification. The current app README is authoritative for status. Pseudocode and template JSON here are documentation, not build entries.

# Tabletop Bot Arena

**Single-player BattleBots-style capstone · Three.js + Rapier · single-player · phone required · immersive XR required**

> Planned design, not implemented or browser-tested. `index.pseudo.mjs` is an explanatory entry point, not a playable game.

## Experience

Drive a small toy robot against three readable local-AI opponents in a tabletop arena.

## What this demonstrates

- Compound colliders and driven bodies
- Weapon joints, contact-based damage and AI
- Polished match loop shared across screen and XR

## Rules and complete loop

- Select wedge, lifter or spinner preset. Fight one AI bot at a time; no robot CAD editor or multiplayer in this release.
- Rounds last 90 simulation seconds. Win by ring-out, health depletion or declared score comparison. Weapon energy and impulses are bounded.
- AI uses the same drive/weapon action interface and cannot teleport or bypass cooldowns. Damage uses filtered contact criteria with immunity windows.

## Bounded polished release

One arena, three player presets, three opponent personalities, practice dummy and a three-round cup.

- Clear weapon telegraphs and opponent personality
- Bots keep physics hulls independent of face animation
- Contact feedback without forced XR shake; restart in one action

No multiplayer, accounts, server simulation or generic editor is required. Start, rules/help, play/activity, pause, outcome/goal feedback and retry must all be complete. Settings include volume/mute, reduced motion, contrast and game-specific options where meaningful. State changes occur in the game model; animations illustrate them.

## Rive inside this app

Garage helper, match announcer and animated faces on bots via tiny texture panels. The requested asset is `bot-crew.riv`; it is **not included**. See [RIVE.md](RIVE.md) for the authoring/integration contract. A placeholder or unrelated animated logo does not satisfy this requirement.

## Save behavior

Exact same-build match snapshot; portable cup/progress save also available as a clearly different document kind. See [SAVE.md](SAVE.md). Loading starts paused; resume is explicit. Entering/exiting XR preserves the live current state even when exported saves are checkpoints.

## Build sequence

Implement the rule loop in [gameplay.pseudo.txt](gameplay.pseudo.txt); bind the exact app lifecycle from [index.pseudo.mjs](index.pseudo.mjs); complete [CONTROLS.md](CONTROLS.md); author/integrate [RIVE.md](RIVE.md); then satisfy [ACCEPTANCE.md](ACCEPTANCE.md). The full XR flow and game-specific presentation are in [XR.md](XR.md).

Target wave: **4**. Integrator first reads [AGENTS.md](../../../../../docs/games/design-reference/ORIGINAL-INSTRUCTIONS.md); do not guess host APIs from symbolic helper names.

Original toy robots and branding. BattleBots-style is descriptive; do not bundle branded logos, show assets or copied robots.
