# tabletop-bot-arena: source migration, integration pending

Original source: `apps/games/02-three-physics-xr/tabletop-bot-arena/` at `4f72ea86928666189b32f6f05c2c697a37341d06`.
Mechanical baseline: `aa91e283a24a4abe1df9a6e9b509ad617fb642f9`; source tree `eeecee26751fbf4b1fe2da71a15180830810016f`.
All 20 current files retain the exact original Git blobs/modes. Owned historical paths, designs and WIP were retained; original complete history and source-to-extracted commit maps remain in private migration recovery. Copied generic helpers/tooling do not make another game's entire history part of this app.

This commit adds only generated-output exclusions and this provenance note. It changes no app behavior. The original host/files/save lifecycle remains source reference and needs a deliberate port to the new assembly. Source presence does not enable this app or establish server-backed save compatibility, agent operations, immersive-session behavior or complete build assets.

Existing configured checks passed in an isolated copy with the original sibling layout. Independent extraction checks are recorded privately. Configured test/typecheck results are recorded separately from browser/host integration.

Dependency locks and tracked artwork/license notices remain authoritative inputs. Third-party dependencies keep their own licenses. Generated artifacts must be built and verified independently; do not copy a production bundle or user documents into this repository.
