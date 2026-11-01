# Acceptance — Tabletop Bot Arena

**All runtime cases are NOT RUN.** This file is a plan; document checks are not gameplay evidence.

Apply all C01–C24 in [common acceptance](../../docs/ACCEPTANCE-COMMON.md). Also apply X01–X16 on the actual Galaxy XR.

## Game-specific cases

| ID | Experiment / invariant | Status |
|---|---|---|
| tabletop-bot-arena-G01 | AI and player are constrained by the same action validation. | not_run |
| tabletop-bot-arena-G02 | Damage cannot repeat unboundedly during resting contact. | not_run |
| tabletop-bot-arena-G03 | Spinner speed/energy capped at solver-safe values. | not_run |
| tabletop-bot-arena-G04 | Closing one arena cannot stop another world. | not_run |
| tabletop-bot-arena-G05 | Cup save preserves logical progress and live match snapshot semantics. | not_run |
| tabletop-bot-arena-G06 | XR exit while driving releases input and returns to paused current match. | not_run |

## Release evidence

Record rules/content and dependency versions, actual asset names/hashes, desktop browser, real phone and (where required) Galaxy XR build, commands/logs, complete-playthrough result, save restoration result, multiwindow/late-disposal behavior, frame timing and unresolved defects. Exercise actual Rive properties and texture input rather than substituting an HTML mock.

A pure rules unit test, a visual smoke test and a hardware XR test are different evidence. Preserve that distinction. All promised features must be demonstrated or explicitly left incomplete; do not relabel a generic engine scene as the finished game.
