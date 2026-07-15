# domain.md philosophy

`domain.md` gives agents an operating map, not authority. It combines a normative machine-readable index
with human-readable purpose, boundaries, and rationale so different agents can work consistently without
collapsing protocol state, DID documents, claims, evidence, collaboration systems, or model memory into one
opaque context.

## Legibility before action

An agent should know where truth lives, what it may inspect, which right gates an action, and which human or
controller must review the result before it calls a state-changing tool. Missing authority is denial.

## References, not sensitive payloads

The index contains typed references, policies, hashes, and proofs. Credentials, private keys, raw evidence,
personal data, and private reasoning do not belong in it.

## Prose explains; canonical state decides

The YAML frontmatter supplies exact fields and references. Markdown explains intent and operating context.
Neither may override resolved protocol or IID state for canonical facts.

## Extensible without becoming ambiguous

Unknown Markdown sections are preserved and `x-*` fields provide explicit extensions. Core authority,
identity, privacy, claim, and flow semantics remain versioned and fail closed.
