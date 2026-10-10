## [0.1.3](https://github.com/hashpass-tech/lukas-treasury-agent/compare/v0.1.2...v0.1.3) (2026-10-10)

### Changed

- 🐞 fix: preserve chain status contract
- 📱 fix: make treasury layout mobile first
- 🎨 feat: redesign treasury operator interface

## [0.1.2](https://github.com/hashpass-tech/lukas-treasury-agent/compare/v0.1.1...v0.1.2) (2026-10-10)

### Changed

- 🐛 fix: preserve release metadata during bump
- 🐛 fix: accept linked versioning changelog headings
- 🛠️ fix: run specs versioning from workspace root
- 🐛 fix: resolve versioning config during release
- 🧹 chore: refresh Pages action versions
- 🚀 feat: publish static web demo to GitHub Pages
- 🔧 chore: guard releases with versioning and husky

# Changelog

All notable changes to LUKAS Treasury are recorded here. Version numbers follow semantic versioning.

## [0.1.1] - 2026-10-10

### Added

- Internal commerce simulation with transport-neutral `commerce.v1` adapter ports.
- Immutable policy, quote, reservation and booking snapshots with integer basis-point accounting.
- Deterministic capacity, expiry, idempotency, payment, attendance and settlement behavior.
- `.specs` task workspace managed through `@edcalderon/versioning@1.5.13`.
- Follow-up tracking for domain/accounting work and future HashPass or allied adapters.

### Documentation

- Added commerce architecture, economics and interoperability documentation.
- Recorded the internal-first MVP boundary and remaining external validation gates.

## [0.1.0] - 2026-10-09

- Initial local LUKAS treasury MVP and hackathon readiness baseline.

[0.1.1]: https://github.com/hashpass-tech/lukas-treasury-agent/releases/tag/v0.1.1
[0.1.0]: https://github.com/hashpass-tech/lukas-treasury-agent/releases/tag/v0.1.0
