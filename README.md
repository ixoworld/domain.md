# domain.md

An open format and TypeScript toolchain for giving AI agents a persistent, authority-aware operating model
for an IXO entity domain.

`domain.md` combines YAML 1.2 frontmatter with ordered Markdown guidance. The machine layer identifies
controllers, services, resources, rights, claims, accounts, flows, privacy, and source-of-truth boundaries.
The prose layer explains purpose and safe operating context.

The repository is structurally inspired by
[google-labs-code/design.md](https://github.com/google-labs-code/design.md) while providing an original IXO
domain model and implementation. See [ATTRIBUTION.md](ATTRIBUTION.md) and [NOTICE](NOTICE).

## Quick start

```bash
npm install @ixo/domain.md
npx domainmd lint ./domain.md
npx domainmd spec
```

The package has not been published yet. During development:

```bash
npm ci
npm run build
node packages/cli/dist/cli.js lint examples/project-authoring/domain.md
```

The public package version is `0.1.0`; the bundled specification version is `1.0.0-rc.1`. They are
intentionally independent.

## Library API

```ts
import {
  diffDomains,
  exportDomain,
  getRules,
  getSchema,
  getSpecification,
  lint,
  parseDomain,
  renderTemplateBundle,
} from '@ixo/domain.md';
```

Every lint finding carries a stable code, severity, JSON-pointer or section path, message, and source
location. Reports distinguish static conformance from the structured external checks that remain required.

## Commands

- `lint` validates a file, package directory, or stdin and emits JSON, text, or SARIF.
- `diff` classifies typed and narrative changes and reports conformance regressions.
- `export` emits a parsed JSON model or SARIF findings; exported JSON is not CID-canonical bytes.
- `spec` emits the bundled specification and active rule registry.
- `schema` emits the matching JSON Schema.
- `init` renders a pinned protocol template bundle into a validated `authoring_draft`.

Both `domain.md` and `domainmd` binaries point to the same CLI. Use `domainmd` on Windows to avoid `.md`
file-association conflicts.

`lint`, `diff`, and invalid SARIF export return exit `1` for a conformance or configured gate failure.
Invocation, filesystem, decoding, and internal failures return exit `2`.

## Verified template initialization

Initialization accepts parameters from JSON/YAML or stdin and never runs an interactive wizard:

```bash
domainmd init \
  --manifest ./examples/protocol-domain/template-manifest.yaml \
  --protocol did:ixo:entity:protocol:verified-services \
  --derived-type project \
  --params ./examples/protocol-domain/parameters.json \
  --output ./new-project
```

HTTPS manifests require `--manifest-sha256` or `--manifest-cid`. IPFS requires an explicit HTTPS
`--ipfs-gateway`; path-addressed IPFS manifests also require a SHA-256. CID verification in this release is
limited to raw sha2-256 CIDs over the exact retrieved bytes. Resolvers are pluggable, while the built-in
local, HTTPS, and IPFS resolvers enforce path, symlink, redirect, DNS, timeout, and size boundaries.

Successful initialization writes a validated `authoring_draft` and `provenance.yaml` through an atomic
temporary-directory rename. It does not persist, anchor, publish, register an entity, execute a Flow, grant
rights, or move value.

## Static versus runtime conformance

A static pass is not proof of live authorization. Anchored and runtime profiles still require external CID,
DID/IID resolver, capability revocation, trusted-clock, chain-anchor, and canonical-state checks. Reports
enumerate those unresolved checks.

## Specification

The current specification is `1.0.0-rc.1`. Read [the generated specification](docs/spec.md) and the
[machine-readable schema](spec/domain-md.schema.json) together.

Canonical inputs live under `spec/`: MDX, JSON Schemas, TypeScript rule metadata, and version constants.
`npm run spec:generate` creates `docs/spec.md` and packaged assets; `npm run spec:check` fails on drift in
schemas, IDs, rule codes, generated docs, legal notices, or runtime version constants. Valid examples live
under `examples/`.

## Repository layout

- `spec/` — canonical specification, domain schema, template-manifest schema, and rule registry
- `docs/` — generated human-readable specification
- `packages/cli/` — public ESM TypeScript library and CLI
- `examples/` — valid project draft, protocol/template bundle, and service domain
- `scripts/` — specification, example, and packed-package verification

## Development and releases

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [RELEASING.md](RELEASING.md).
This project is licensed under Apache-2.0.
