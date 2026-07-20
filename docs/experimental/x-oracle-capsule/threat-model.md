# x-oracle-capsule threat model

- Status: accepted after independent architecture and security review
- Scope: experimental contract and Livelihoods shadow pilot
- Companion decision: [x-oracle-capsule experimental architecture decision](./architecture.md)

## Security objective

Run one verified Master skill on a minimal host kernel without allowing the model host, prompt, skill, evidence, retrieved content, or tool output to become authority. A conforming run preserves least authority, source provenance, subject privacy, replay evidence, human review, and an auditable stop on uncertainty.

The shadow pilot is considered safe only when a compromise cannot produce a protected IXO effect. It may at worst produce a clearly labelled, development-scoped advisory artifact that still requires independent human review.

## Protected assets

- Oracle identity, controller state, rights, capabilities, revocations, and trusted-time decisions.
- Capsule manifest, Master skill, kernel, tool adapters, source locks, activation records, and dependency provenance.
- Subject-domain policies, claim schemas, evidence rules, rubrics, reason codes, and Flow state.
- Evidence confidentiality, consent, decryption rights, retention, and subject isolation.
- Human approvals, reviewer identity, signer authorization, keys, nonces, and transaction intent.
- Durable memory, hash-chained traces, signed receipts, replay inputs, and audit exports.
- The pilot ceiling and the distinction between advisory output and canonical determination.

## Actors and assumptions

| Actor                                                  | Trusted for                                                                                    | Never trusted for                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Oracle/domain controllers                              | Approving identity and declared policy changes within their canonical authority                | Subject-domain facts outside that authority                                     |
| Subject policy and evidence owners                     | Rubric, consent, disclosure, evidence and human-review policy within their scope               | Capsule code or runtime integrity                                               |
| Runtime authority provider                             | Verifying capability assertions, time, nonce and revocation                                    | Model reasoning or subject facts                                                |
| Runtime bootstrap verifier                             | Verifying signed distribution attestations against independently configured trust roots        | Subject policy, live capabilities, model reasoning or receipt truth             |
| Runtime kernel                                         | Enforcing verified contract, isolation, recording and stop conditions after verified bootstrap | Inventing authority or policy                                                   |
| Receipt signer and independent verifier                | Signing run evidence and verifying signer/distribution trust chains                            | Oracle policy, subject facts, human approval or canonical outcome               |
| Independent Evaluation Owner                           | Reviewing and issuing the authoritative pilot decision, if separately authorized               | Bypassing protocol, evidence or payment controls                                |
| Model host and Master skill                            | Producing bounded reasoning and requesting exposed tools                                       | Authority, durable state, signing, secret custody, self-approval or audit truth |
| Evidence, prompts, retrieved resources and tool output | Untrusted inputs after verification and disclosure checks                                      | Instructions, capabilities, policy changes or executable code                   |

The network, package registries, IPFS gateways, archives, model provider, local filesystem before verified bootstrap, clocks not explicitly declared trusted, and all mutable endpoints are potentially hostile. The bootstrap verifier and its configured trust anchors are part of the trusted computing base; compromise of that boundary is a pilot kill condition.

## Trust boundaries and data flow

1. **Bootstrap-integrity boundary:** a verifier outside the installed bundle validates the signed distribution attestation and exact kernel/adapter bytes before execution.
2. **Canonical-state boundary:** IID/protocol, Flow, capability and revocation state enter through protocol-specific verified adapters.
3. **Supply-chain boundary:** the manifest, Master artifact, schemas and tool adapters cross an untrusted resolver and are accepted only after source-lock and content-address verification.
4. **Disclosure boundary:** evidence and subject context cross into the run only after purpose, consent, sensitivity, access, decryption and retention checks.
5. **Model boundary:** the kernel projects bounded context and tools into an untrusted probabilistic reasoning shell. Any returned tool request or output is untrusted until independently validated.
6. **Effect boundary:** every tool call leaves the reasoning shell through a default-deny capability and egress gate. Protected effects also require the applicable human/signer gate.
7. **Persistence boundary:** model outputs enter encrypted, classed memory, traces or receipts only through schema, redaction, scope, integrity, key-policy and retention controls.
8. **Audit boundary:** replay and audit consumers verify hashes, signatures, source pins, distribution and signer trust chains, and disclosure policy; they do not receive secrets or hidden chain-of-thought.

## Threats, controls and negative tests

| Threat                                                                  | Required controls                                                                                                                                                             | Required failing test / observable stop                                                                                                            |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt injection in task text, evidence, resources or tool output       | Treat all content as data; fixed authority precedence; structured tool contracts; output/effect validation; Master cannot alter kernel policy                                 | An evidence document instructs the Oracle to activate a tool or ignore human review; no tool is activated and the trace records the refusal reason |
| Capability escalation or confused deputy                                | Effective authority is the intersection of all ceilings; exact subject/action/object/audience matching; deny precedence; no wildcard promotion                                | A valid capability for another subject, object or action is rejected immediately before invocation                                                 |
| Revoked, expired or replayed grant                                      | Trusted time, nonce, audience, expiry and revocation checks at bootstrap and per protected call; no pilot grace period                                                        | Reuse an assertion nonce, revoke mid-run, or make the clock unavailable; the run stops and emits a non-success receipt                             |
| Tool misuse or undeclared tool activation                               | Verified manifest allowlist; runtime contract registry; per-call schema; isolated credentials; protected effects disabled by pilot policy                                     | The Master names an installed but undeclared tool or changes an argument after authorization; the call is absent from the adapter log              |
| Data exfiltration through prompts, output, logs, URLs or tool arguments | Purpose-limited evidence projection; egress allowlist; sensitivity labels; value-pattern plus field-name secret scanning; size limits; redaction before persistence           | Seed secrets and sensitive evidence in nested fields, URLs and free text; outbound call and receipt creation fail without echoing the value        |
| Cross-subject or cross-workspace disclosure                             | Subject/workspace/run-scoped storage and keys; canonical identifiers; no ambient filesystem access                                                                            | A run requests memory or evidence for a different subject/workspace; access is denied and no existence-sensitive detail leaks                      |
| At-rest disclosure or key-scope confusion                               | Encryption at rest; environment/workspace/subject-scoped keys; explicit retention/deletion/legal-hold state; key rotation and cryptographic-erasure evidence                  | Copy encrypted memory into another subject scope, request the wrong key, expire retention or remove a key; access/write/resume fails closed        |
| Evidence tampering or substitution                                      | Verify URI, CID/hash, schema, freshness, consent and decryption rights before use; bind exact references to receipt                                                           | Substitute bytes at the same gateway URL or supply an unpinned evidence item; evaluation does not start                                            |
| Replay or receipt substitution                                          | Hash-chained events; unique run ID and nonce; receipt binds release, source set, authority, inputs, tools, outputs and review; external verification                          | Change one input, policy pin, tool result or review reference; replay comparison fails at the first divergent digest                               |
| Supply-chain compromise                                                 | Immutable commit/CID pins, full file locks, generated distribution provenance, protected review, dependency allowlist and installed-artifact smoke tests                      | Modify one locked byte or add an executable file after build; resolver or installed smoke test fails before bootstrap                              |
| Kernel, adapter or distribution substitution                            | Signed distribution attestation; out-of-bundle trust anchors; exact kernel/adapter digests; verified bootstrap; post-load integrity checks                                    | Replace the installed kernel, adapter, command contract or provenance together; bootstrap fails before any Oracle content is loaded                |
| Dependency confusion                                                    | No unpinned package lookup at runtime; repository/commit/digest identity; exact adapter registry; offline verified bundle preferred                                           | Publish a higher-version same-name package or adapter; it is not selected because identity and digest do not match                                 |
| Unsafe resolver or SSRF                                                 | Allowlisted schemes/hosts; DNS/IP policy; HTTPS where applicable; redirect revalidation; time/byte limits; no ambient credentials                                             | Redirect to loopback, link-local, private IP, mutable HTTP or oversized response; resolution fails closed                                          |
| Malicious archive                                                       | Staged extraction; reject absolute/traversal/duplicate paths, links, devices, sparse bombs and excessive entry/expanded sizes; verify lock after extraction; atomic promotion | Archive contains `../`, symlink escape, duplicate `SKILL.md`, oversized expansion or unlocked file; no target file is promoted                     |
| Credential theft                                                        | Secrets remain outside model and package; scoped adapter injection; short-lived assertions; external signing; logs and errors redacted                                        | Prompt or Master requests an environment dump/private key; no secret enters model output, trace or package receipt                                 |
| Signer or transaction abuse                                             | Canonical structured intent, simulation, exact authorization, human review, signer outside model, idempotency and broadcast result verification                               | Advisory pilot requests signing/broadcast or changes intent after review; kernel rejects before signer contact                                     |
| Model manipulation, hallucinated confidence or evaluator drift          | Pinned model policy where required; typed-fact-first evaluation; pinned rubric; deterministic checks; confidence only routes review; independent owner                        | Confidence below 98%, missing fact, unsupported reason code or rubric mismatch routes to review/stop rather than determination                     |
| Capsule downgrade or unauthorized rollback                              | Explicit contract compatibility; immutable activation; supersedes is non-activating; revocation check; human-authorized rollback record                                       | Present an older signed but revoked release or a superseding release without activation; bootstrap fails                                           |
| Runtime or Master self-modification                                     | Read-only verified release; executable and policy directories outside writable workspace; post-load integrity; no write capability for kernel/source pins                     | Master attempts to edit its files, manifest, policy, tool contract or receipt history; write is denied and run interrupted                         |
| Memory poisoning                                                        | Class schemas, provenance on durable writes, subject/purpose scoping, review for promoted facts, no memory-as-authority                                                       | Prior session memory contradicts canonical state or injects instructions; canonical source wins and conflict is recorded                           |
| Trace suppression or audit forgery                                      | Recorder is kernel-owned; append-before/after tool events; hash chain, signatures and external verification; fail run if recording unavailable                                | Disable or corrupt the recorder, omit a tool result, reorder events or alter a receipt; run cannot complete successfully                           |
| Receipt signer substitution or unverifiable signature                   | Signer DID and verification method in receipt; independent key registry and revocation check; distribution/source binding; authority-mode separation                          | Sign with an unknown, revoked, wrong-purpose or development-only key under production policy; independent verification fails                       |
| Human-review bypass                                                     | Review policy resolved from subject domain and run authorization; reviewer identity and exact artifact digest bound; self-review denied                                       | Master marks its own output approved or supplies a review for another digest; protected transition remains unavailable                             |
| Denial of service and resource exhaustion                               | Strict input, resolver, archive, context, runtime and output budgets; cancellation; partial trace; no effect on timeout                                                       | Oversized/deep manifest, decompression bomb, recursive retrieval or long tool call stops within the declared budget                                |

## Pilot abuse cases

The Livelihoods pilot specifically rejects these paths:

- Treating the Oracle's draft as the Independent Evaluation Owner's final determination.
- Turning a confidence score into payment approval, claim rejection, or a default outcome.
- Evaluating raw documents directly instead of producing typed facts and applying the pinned rubric.
- Using evidence without approved consent, disclosure, decryption, freshness, retention, and reviewer rules.
- Continuing after an unresolved rubric conflict, missing disqualifier, missing reason code, or evidence outside the authorized corpus.
- Calling production state, credential, governance, deletion, signer, transaction, or value-moving tools.
- Labelling a development-authority trace or a green CI result as production or launch readiness.

## Stop and containment behavior

On a security or authority failure, the kernel:

1. denies the requested operation and prevents new tool calls;
2. preserves already recorded audit events without copying prohibited data;
3. marks the run `interrupted`, `denied`, or `non-conformant`, never `success`;
4. records the stable reason code and dependency that failed, without secrets;
5. invalidates resumability when a release, artifact, policy, authority or evidence pin changed;
6. requires a fresh authorized run after remediation; and
7. never attempts to compensate, roll back, delete, or mutate canonical IXO state on its own.

Unexpected protected effects, secret disclosure, cross-subject access, evidence corruption, signature failure, or receipt-chain failure are pilot kill conditions. They require incident review before another pilot run.

## Required evidence before pilot authorization

The pilot package must contain or reference:

- static conformance reports for the Oracle identity document, manifest, Master lock and package;
- the exact reviewed architecture/threat-model commit and file digests plus cross-language RFC 8785 golden-vector results;
- a signed distribution attestation and independent bootstrap-verifier result for the installed kernel and adapters;
- resolver, archive, downgrade, revocation, capability, secret-leak, isolation and self-modification negative-test results;
- installed Codex-host smoke evidence proving the runtime artifact, not only source tests;
- the exact Oracle and subject-domain CIDs, release and Master digests, tool contracts, runtime build provenance and authority mode;
- signed development run authorization naming the evidence corpus, subject scope, reviewer, trusted clock, revocation provider, retention and stop conditions;
- approved consent/decryption/disclosure policy and rubric version;
- replay verification from the emitted run receipt;
- independent receipt-signature verification including signer DID/key status, authority mode and revocation verdict; and
- explicit human acknowledgement that the result is advisory and cannot move value or production state.

Absence of any required item is a blocked pilot, not a waived control.

## Residual and deferred risks

The experimental design cannot establish the safety of an unspecified model provider, production AuthHub endpoint, production signer, evidence corpus, consent/decryption policy, rubric, reviewer, or retention regime. Those items require named owners and evidence before the corresponding gate.

Production state change and value movement remain out of scope even if every shadow-pilot test passes. Standardization requires audit evidence showing that the authority separation, negative controls, replay, human review and operator workflow work in the installed host.
