# Security policy

Report suspected vulnerabilities privately through GitHub Security Advisories for this repository. Do not
open a public issue containing exploit details, credentials, private evidence, capability proofs, or keys.

The `domain.md` CLI performs static validation and verified template retrieval. It does not prove live DID
resolution, capability revocation, trusted time, chain anchoring, or runtime authorization. Consumers must
perform the external checks listed in each report before authority-bearing actions.

Only the latest released package line will receive security fixes once releases begin. Until then, security
fixes target `main`.

Built-in HTTPS resolution blocks credentials in URLs, non-public DNS answers, DNS rebinding through
connection-address pinning, unsafe redirects, excess redirects, timeouts, and oversized responses. Remote
manifests and files require immutable digests, and local resolution rejects traversal and symlinks. These
controls are defense in depth, not permission to retrieve untrusted templates with ambient credentials.
