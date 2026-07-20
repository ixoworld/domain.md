# @ixo/domain.md

TypeScript library and command-line tooling for the authority-aware
[`domain.md`](https://github.com/ixoworld/domain.md) specification.

```bash
npm install @ixo/domain.md
npx domainmd lint ./domain.md --format text
```

The package exports parsing, linting, typed diff, JSON/SARIF export, specification access, schema access,
rule metadata, verified template rendering, and pluggable resolver APIs. Both `domain.md` and the
Windows-safe `domainmd` command names invoke the same CLI.

The package also exports the experimental host-neutral `x-oracle-capsule` manifest and source-lock
schemas, strict I-JSON parsing, RFC 8785 canonicalization/golden vectors, and static in-memory package
verification. A capsule `static-pass` always lists the live identity, authority, privacy, review,
distribution, and signer checks that remain unresolved; it is not an executable or authorization verdict.

Static validation never proves live authority. Anchored and runtime reports enumerate the resolver, CID,
revocation, trusted-clock, and chain checks that remain external.

See the [repository README](https://github.com/ixoworld/domain.md#readme),
[specification](https://github.com/ixoworld/domain.md/blob/main/docs/spec.md), and
[security policy](https://github.com/ixoworld/domain.md/security/policy) for full documentation.
