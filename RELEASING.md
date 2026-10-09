# Releasing

`@ixo/domain.md` is released automatically from `main` by [semantic-release](https://semantic-release.gitbook.io/)
in `.github/workflows/release.yml`. Nobody edits a version number by hand.

## What happens on every push to `main`

1. The full check suite runs (`npm run ci` and a production dependency audit).
2. semantic-release reads the commits since the last `v*` tag and decides the next version from their
   [Conventional Commits](https://www.conventionalcommits.org/) types: `fix` → patch, `feat` → minor,
   `BREAKING CHANGE` footer or `!` → major, `perf` and `refactor` → patch, `build(deps)` → patch. `docs`,
   `test`, `ci`, `chore` and `build(deps-dev)` commits release nothing; a push with no releasable commit
   publishes nothing.
3. The version is written into `packages/cli/package.json` in the workflow's checkout only, the package is
   rebuilt so `PACKAGE_VERSION` and the CLI's `--version` carry it, and it is published to npm with
   provenance.
4. A `v<version>` git tag and a GitHub release with the generated notes are created.

The version in git stays `0.0.0-development`; the tag is the source of truth. Package release notes live on
GitHub releases; `CHANGELOG.md` records specification changes.

## Authentication

Publishing uses npm [trusted publishing](https://docs.npmjs.com/trusted-publishers): the job runs in the
protected `npm-release` environment with `id-token: write`, and npm exchanges the GitHub OIDC token for a
short-lived publish credential. No long-lived token lives in the repository.

One-time setup on npmjs.com for `@ixo/domain.md` → Settings → Trusted publisher: provider GitHub Actions,
organisation `ixoworld`, repository `domain.md`, workflow `release.yml`, environment `npm-release`. For a
package that has never been published, npm lets you create that configuration before the first publish and
expires it if the first publish does not happen within two days. If trusted publishing is not configured in
time, add a granular automation token with publish rights as the `NPM_TOKEN` secret of the `npm-release`
environment for the first run and delete it afterwards; the workflow prefers the OIDC exchange whenever the
token is absent.

## Commits and pull-request titles

`main` only accepts pull requests. Squash merges use the pull-request title, so the title must be a
Conventional Commit (checked by `.github/workflows/pr-title.yml`); merge commits are ignored and the
pull request's own commits are analysed instead, so keep those conventional too.

## Manual run and recovery

- `workflow_dispatch` on the Release workflow re-runs the release step for the current `main`; it is
  idempotent and publishes nothing if the latest commit is already released.
- A dry run locally: `GITHUB_TOKEN=$(gh auth token) npx -p semantic-release@25.0.9 -p @semantic-release/exec@7.0.0 -p conventional-changelog-conventionalcommits@10.4.1 semantic-release --dry-run --no-ci`.
- Before the first automated release the repository carries the tag `v0.2.0` on the last manually reviewed
  state, so the first release is `0.3.0`, the package contract announced in `CHANGELOG.md`.
