<!-- Generated from spec/oracle-capsule.mdx | schema: urn:ixo:domain-md:x-oracle-capsule:manifest:0.1.0 -->
<!-- Do not edit directly. Run npm run spec:generate. -->

# x-oracle-capsule companion manifest contract

Status: experimental static-conformance contract 0.1.0. The architecture and threat-model decisions remain the source of truth for the trust boundaries behind this schema.

## Scope and authority boundary

The `x-oracle-capsule` binding, companion manifest and source lock describe immutable release bytes. They do not grant authority, select current protocol state, authorize evidence disclosure, approve an outcome, activate a tool, sign a receipt or move value. A static-pass report always returns `externalChecksRequired`; a runtime must resolve those checks from their owning authorities and fail closed when any required verdict is missing, stale, ambiguous or negative.

The portable package is host-neutral. Codex, Claude, Pi, CLI and MCP hosts may supply reasoning and presentation, but cannot reinterpret this contract or become its authority, durable state, secret store, signer or audit ledger.

## Frozen identities

| Surface                 | Frozen value                                           |
| ----------------------- | ------------------------------------------------------ |
| Binding key             | `x-oracle-capsule`                                     |
| `apiVersion`            | `ixo.earth/oracle-capsule/v0alpha1`                    |
| Manifest `kind`         | `OracleCapsuleRelease`                                 |
| Manifest schema         | `urn:ixo:domain-md:x-oracle-capsule:manifest:0.1.0`    |
| Manifest media type     | `application/vnd.ixo.oracle-capsule+json`              |
| Source-lock `kind`      | `OracleCapsuleSourceLock`                              |
| Source-lock schema      | `urn:ixo:domain-md:x-oracle-capsule:source-lock:0.1.0` |
| Source-lock media type  | `application/vnd.ixo.oracle-capsule.source-lock+json`  |
| Exact-byte digest       | SHA-256                                                |
| Exact-byte address      | CIDv1, raw codec, sha2-256 multihash                   |
| Generated serialization | RFC 8785 JSON Canonicalization Scheme (JCS)            |

The schema URI is an identifier, not a network authority. Implementations use the schema packaged with the validator; they must not fetch a mutable replacement.

## `domain.md` binding

The top-level binding contains only `contract` and `manifest`. The manifest URI is immutable only when coupled to both its CID and SHA-256. The CID and SHA-256 cover the exact fetched UTF-8 bytes. The media type, schema URI and release SemVer must match the fetched manifest. Generic `x-*` extension behavior does not weaken this exact binding.

## Manifest ownership

`metadata` owns release identity and supersession history. Supersession does not activate a release. `provenance` pins the repository, commit, builder and exact reviewed architecture/threat-model digests. `compatibility` declares the contract major, minimum kernel, required features and presentation hosts; a runtime may narrow these requirements but never downgrade them.

`domains.oracle` pins the Oracle identity document. `domains.subjects` pins every permitted subject-domain contract. Domain references do not copy or override current controller, right, claim, rubric, evidence, Flow, consent or review state.

`components` contains exactly one required `master_skill`. Every component is immutable, dual-addressed by CID and SHA-256, versioned, owned, update-authority scoped, explicitly required or optional, assigned a disclosure/loading policy, and read-only at runtime. Optional specialist skills, scripts, runtime bundles, policies, rubrics, output schemas, reference-memory snapshots, evaluation suites and host adapters remain bounded components; an unknown required kind fails schema validation. Dependencies must resolve and form an acyclic graph.

The Master artifact references one content-addressed source lock and names a relative entrypoint. It may orchestrate reasoning and request declared tools, but cannot activate a tool, alter authority precedence, modify package bytes, read secrets directly, suppress evidence, approve itself or change a kernel invariant.

`tools` describes requested runtime contracts: DID, version, signed manifest, typed input/output and receipt schemas, risk, side effects, capability actions, sandbox and egress projection. These records are allowlist requests only. `requestedCapabilities` must name a declared tool and remains subject to the effective runtime intersection.

`effectCeiling` can only narrow the identity document, run authorization, live capability, subject policy and runtime policy. Human review remains external and digest-bound.

## Strict parsing and RFC 8785

Manifest, lock, attestation, authority-record and receipt digest/signature surfaces use RFC 8785 JCS after strict I-JSON parsing. Inputs must be UTF-8 without a BOM; object names must be unique; Unicode must contain no lone surrogate; numbers must be finite; integers must be within `[-9007199254740991, 9007199254740991]`; arrays preserve order. Object names are sorted by UTF-16 code units as required by RFC 8785.

The release digest is SHA-256 over JCS of the entire manifest after removing only `metadata.release_digest`. No other field is omitted. The published vectors in `oracle-capsule-jcs-vectors.json` are normative and must run unchanged in every implementation and packed host.

Canonical serialization never substitutes for exact-byte verification. Whitespace-different manifest bytes can produce the same JCS bytes while having different valid exact-byte SHA/CID identities.

## Source locks and extraction

A source lock binds one manifest component to its artifact CID, SHA-256 and byte length, then lists every regular file by unambiguous relative path, byte length and SHA-256. Paths are `/`-separated, relative, non-empty, non-duplicated and contain no backslash, empty segment or `..` segment. Only regular files are permitted. Symbolic/hard links, devices, sockets, absolute paths, traversal, duplicate archive names, case/normalization collisions, undeclared files, missing files and extraction outside a fresh isolated root must fail before execution.

The static in-memory package verifier checks exact locked bytes and refuses unlocked files. Archive readers and network resolvers are downstream runtime surfaces and must additionally enforce redirect, DNS/IP, decompression, total-size, file-count and race-safe extraction controls before presenting bytes to this verifier.

## Stable findings and limits

Strict JSON failures carry a stable `capsule-*` code, JSON Pointer path, and one-based line/column. Schema and semantic findings inherit the closest parsed pointer location. The frozen default budgets are 1 MiB per manifest/lock, depth 64, 10,000 JSON nodes, 10,000 characters per scalar, 10,000 locked files and 64 MiB total locked file bytes. A runtime may choose smaller limits, never larger limits while claiming this contract.

## Static verdict

A `static-pass` proves only local syntax, schema, internal references, release serialization and the exact bytes supplied to the package verifier. It does not prove URI resolution, current identity or subject state, authorization, revocation, trusted time, consent/decryption, human approval, distribution trust or signer trust. These remain explicitly listed as runtime external checks in every report.

Any byte or semantic change creates a new release version and exact-byte CID/SHA. Rollback is an explicit activation decision by the owning authority; it never rewrites history. Existing Blueprint Runtime v0.2 canonical JSON helpers and digest fixtures are unchanged: capsule JCS is a new versioned contract and downstream runtimes must call this implementation or pass its exact vectors before claiming conformance.
