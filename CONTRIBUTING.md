# Contributing

Use pull requests for all changes. Specification changes must include the matching schema, rule metadata,
generated documentation, migration note, examples, and tests.

## Development

```bash
npm ci
npm run ci
```

Run `npm run spec:generate` after editing specification inputs. Never edit `docs/spec.md` directly. Add a
changelog entry for public API, CLI, schema, rule-severity, or specification changes.

All TypeScript must remain original IXO implementation code and Apache-2.0 compatible. Do not include real
credentials, private evidence, personal data, or production capability proofs in fixtures.

## Commit messages and pull-request titles

Releases are cut automatically from the commit history (see [RELEASING.md](RELEASING.md)), so every
pull-request title, and every commit that lands on `main`, must be a
[Conventional Commit](https://www.conventionalcommits.org/): `feat: …` for a new capability (minor release),
`fix: …` for a correction (patch), `feat!: …` or a `BREAKING CHANGE:` footer for an incompatible change
(major), and `docs:`, `test:`, `ci:`, `chore:`, `build(deps-dev):` for changes that release nothing.
