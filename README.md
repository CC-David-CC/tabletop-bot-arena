# Tabletop Bot Arena

Tabletop Bot Arena is a single-player, top-down toy-robot fighting preview. It
uses Three.js for presentation and Rapier for motion, collision impulses and
ring-outs. The player and local AI use the same bounded drive and weapon rules.

Choose Wedge, Lifter or Spinner, then play the stationary practice dummy or a
three-round cup against three opponent personalities. A round lasts 90
simulation seconds. Win by reducing the opponent's health, forcing a ring-out,
or holding more health when time expires. The weapon has an energy cost and
cooldown; self-right is available once per match.

Desktop controls are WASD/arrows to drive, Space for the weapon, R for
self-right, and Escape to pause. Phones receive the same controls as large
on-screen buttons. Losing window focus, minimizing, rolling up, switching
workspaces, or leaving the browser pauses the match and clears held input.

## Files

**Save match** writes an exact same-build Rapier and logical-state snapshot to
My files as a `.game.json` file. **Save cup progress** uses a separately labeled
portable document kind containing cup position and logical progress. Loading
either kind starts paused. Invalid, stale or conflicting files leave the current
arena intact.

## Current limitations

- `bot-crew.riv` has not been supplied. The match announcer is a clearly labeled
  procedural fallback with the same health/energy/phase intent.
- The desktop preview is implemented; immersive XR entry and device testing are
  not yet implemented.
- Physical-phone input, audible speaker output and full 90-second three-round
  playthroughs remain unverified.
- Robots are original procedural toys. No BattleBots branding or copied assets
  are used.

## Development

```sh
npm ci --prefix apps/system/tabletop-bot-arena --ignore-scripts
npm run typecheck --prefix apps/system/tabletop-bot-arena
npm test --prefix apps/system/tabletop-bot-arena
```

The browser fixture and account tests are under `tests/tabletop-bot-arena-*`.
Use an isolated account server and browser profile. Do not use production
account data.

Keyboard controls act only in the focused game window and leave text fields
alone. Losing focus clears held controls. A local registered-account test
covers input focus, server sync, and a phone-sized reopen; physical touch was
not tested.
