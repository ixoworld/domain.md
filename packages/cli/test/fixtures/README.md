# Adversarial fixture coverage

The checked-in fixtures cover unsafe YAML, duplicate keys, path traversal, and malicious redirect targets.
The test suite derives the remaining cases from valid canonical examples so fixtures cannot silently drift
away from the schema:

- malformed UTF-8 and oversized byte streams;
- duplicate identifiers, broken local references, unreachable Flow states, and missing persisted CIDs;
- unresolved placeholder and secret leakage;
- direct and manifest-relative symlinks;
- loopback/private-address SSRF and unsafe redirect destinations;
- protocol/manifest marker mismatch, remote-to-local resolver crossing, and per-file size mismatch;
- SHA-256, CID, and template parameter mismatches.

Binary and oversized cases are generated in temporary directories during tests to avoid storing malformed or
megabyte-scale artifacts in the repository.
