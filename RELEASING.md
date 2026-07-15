# Releasing

Releases are manual and require explicit authorization. Repository setup does not publish a package or create
a GitHub release.

1. Confirm `npm run ci` and the GitHub checks pass.
2. Confirm package and specification versions independently.
3. Review `CHANGELOG.md`, the packed file list, provenance, and dependency audit.
4. Obtain an IXO npm administrator for the first `@ixo/domain.md` publication.
5. Configure the protected `npm-release` environment and npm trusted publishing or a scoped automation token.
6. Manually dispatch the release workflow with `publish=true`.
7. Verify both CLI aliases and programmatic exports from the public registry before creating a GitHub release.
