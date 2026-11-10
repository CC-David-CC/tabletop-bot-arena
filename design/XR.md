> Original design reference from 2026-10-30. This describes intended behavior, not current implementation or qualification. The current app README is authoritative for status. Pseudocode and template JSON here are documentation, not build entries.

# App-owned XR flow — Tabletop Bot Arena

## Same game, spatial presentation

The full match on a placed arena board; optional spectator orbit on desktop, direct viewing in XR. Do not physically move the arena while the match is active.

Both immersive-ar and immersive-vr are targets, independently probed; manual placement or a virtual table keeps play possible without hit-test/anchors.

```
Normal desktop window
  ├── Fully playable game preview
  ├── Settings
  ├── Load/save
  └── Enter XR (available mode + explicit user action)
          ↓
      Immersive experience: same model/world and current progress
          ↓
      Exit XR (own button or system end)
          ↓
      Original desktop window: restored camera/UI, current game paused
```

This behavior lives in this app's implementation, not a desktop service. [index.pseudo.mjs](index.pseudo.mjs) includes the intended orchestration. Read [XR-LIFECYCLE.md](../../../../../docs/games/design-reference/XR-LIFECYCLE.md) for entry, pending-request disposal, end events and timing rules.

## Game-specific comfort and input

Seated tabletop controls; no mandatory crouching or locomotion. Reposition pauses and clears held controls.

All commands are mapped in [CONTROLS.md](CONTROLS.md). Use target-ray/select with optional hands or gamepads. Never assume gripSpace or hand joints exist. If tracking disappears, cancel uncommitted gestures and clear held actions. No raw camera/eye-tracking dependency.

## Settings, file actions and Rive

Use a reachable in-world panel for Pause, Resume, Settings, Recenter and Exit. Rive role: Garage helper, match announcer and animated faces on bots via tiny texture panels.

Render required Rive content into the scene, not only into HTML. Validate ray UV → artboard coordinate mapping. A native file picker may need window mode: Load/Save explains any required exit, executes in the original window and does not auto-reenter XR. Saving to an already-authorized destination is permitted only through the actual file service.

## Continuity

On entry, pause at a tick boundary and keep the same model/world. Keep desktop camera settings separately; no duplicated game. Change only presentation transform and input mapping. On exit, clear XR handles/timing debt, keep the latest progress and show Resume in the original window. Even checkpoint saves do not justify resetting the live game on XR transitions.

Model-space dimensions/physics remain unchanged when the scene is visually scaled or placed. Anchors are session state, not persisted world coordinates. Manual placement is not physical scene understanding; real room obstacles are not simulated automatically.

## Unrun acceptance

All X01–X16 in [common acceptance](../../../../../docs/games/design-reference/ACCEPTANCE-COMMON.md) apply, plus this game's specific cases. Test real headset entry/exit and in-world Rive controls. Desktop XR emulation is useful but is not device validation.
