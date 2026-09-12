# Changelog

## Unreleased

- Add a Workers `nodejs_compat` export for shared domain and capsule validation without filesystem reads or dynamic schema compilation.
- Generate schema validators ahead of time and verify generated-source drift in CI.

All notable package and specification changes are recorded here. Package versions and specification
versions are intentionally independent.

## Unreleased

### Added

- `1.0.0-rc.3` legal-form-independent constitutional-subject profiles for persons, organisations,
  assets, commodities, instruments, rights, agreements, work, services, claims, evidence, places,
  biological subjects, networks, and recursive agentic twins.
- Uniform subject facets including claims and wallets, reusable constitutional archetypes, the IXO constitutional agency cycle,
  and stable validation for subject classification, references, identity, and twin evaluation binding.
- `1.0.0-rc.2` constitutional subject, normative-system, instrument, governance, execution, legal-effect,
  and Constitutional-AI contracts, backed by the merged IXO constitutional vocabulary.
- Stable constitutional semantic rule codes, runtime external checks, public TypeScript types/constants,
  governed examples, and a passive `not_applicable` example.
- Migration guidance for rc.1 documents and deterministic protocol templates.

### Changed

- Unreleased package contract advanced to `0.3.0`.
- rc.3 domains require `constitution.subject_profile`; `domain.type` remains the coarse serialization
  category and no longer carries the full constitutional classification.
- Every document entry now requires a unique stable `id`; constitutional instruments reference that ID.
- Every rc.3 domain declares constitutional status, with complete packages required for governed and
  agentic domains.
