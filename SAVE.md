# Save and load — Tabletop Bot Arena

## Promise shown to the user

Exact same-build match snapshot; portable cup/progress save also available as a clearly different document kind.

## Authoritative fields

- robot preset definitions
- world snapshot and stable component ids
- health/energy/cooldowns
- AI state and seed
- match clock, score and cup progress

Use the versioned envelope from [SAVE-LOAD.md](../../docs/SAVE-LOAD.md), app id `tabletop-bot-arena`, a content/rules version and any required engine fingerprint. Derived render positions, DOM, texture handles, Rive artboards and in-flight worker jobs are excluded. XR anchors, tracked poses and hardware identities are excluded.

Pause at a committed game boundary, cancel uncommitted input, capture only the documented snapshot/checkpoint and report what was actually written. A visible Save operation must not quietly write an older checkpoint without saying so. On load validate size, app/version, finite values, ids and invariants, prepare a replacement, then commit; failure leaves the current game intact. The game resumes paused with an explicit Resume.

XR entry/exit is NOT save/load. Preserve the same live model, even when this file format is checkpoint-based. Load file inside XR explains any necessary exit and never auto-reenters.

File integration is unbound until the real host services are inspected. Do not invent host method names, atomic write guarantees or another hidden document store. Use explicit Save As/conflict handling appropriate to the actual provider.
