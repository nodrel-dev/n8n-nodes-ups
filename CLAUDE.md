# @nodrel-dev/n8n-nodes-ups — Claude Code project memory

A verified-targeted n8n community node for UPS, scaffolded with the n8n-node CLI.
Rules are imperative. Rationale lives in the imports below; do not duplicate it here.

## Source of truth (imports)
- @internal/.specify/memory/constitution.md — non-negotiable principles. If anything
  here conflicts with the constitution, the constitution wins.
- @internal/specs/ — current feature spec, scope, endpoint map, verify-live items.
- @docs/n8n-gotchas.md — known build/release/test traps.
- @package.json — actual scripts, the `n8n` attribute, and the engine requirement.

> The `internal/` imports live in the **private companion repo**
> (`nodrel-dev/n8n-ups-node-internal`), gitignored from this public repo. On a fresh
> clone, run `./bootstrap-internal.sh` to restore them — see "Public vs private split".

## Rules
- Zero runtime dependencies. Built-in n8n HTTP helpers only. Never add a SOAP/XML/SDK dep.
  Note this does NOT mean zero installed packages: npm auto-installs PEER deps, so the
  `n8n-workflow` peer drags in a native `isolated-vm` unless installed with `--omit=peer`
  (gotchas §17). Keep that flag in the harness scripts.
- Dependency updates arrive as ONE grouped Dependabot PR per ecosystem per week. Dependabot
  alerts and security updates are enabled. Never blind-merge a grouped bump: the group can
  contain majors (a group carrying eslint 10 / TypeScript 7 / vitest 4 broke `n8n-node lint`
  outright), so read the contents and let CI decide.
- Node.js >= 22.22 for `n8n-node dev`. All GitHub Actions workflows pin **Node 24**
  (`actions/setup-node` `node-version: '24'`) — keep every workflow on 24, not `lts/*` or `22`.
- **One workflow per concern.** `ci.yml` is the ONLY merge gate (lint → test → build →
  `npm pack --dry-run` → shellcheck); `codeql.yml` owns security; `label.yml`/`stale.yml`
  own triage; `release-please.yml` owns release; `.github/dependabot.yml` owns dependency
  updates (npm + github-actions, GROUPED weekly — see below). Do not add a second build/lint workflow
  (the scaffold's duplicate `validate.yml` was folded in and deleted), and do not add a
  second security scanner (Codacy was removed — see gotchas §15). A red `CI` must mean
  exactly one thing: the code is broken.
- Build/lint/dev go through the n8n-node CLI. Releases are driven by **release-please**:
  merge the auto-generated release PR on `main` and the `release-please.yml` workflow tags,
  publishes to npm with provenance, and scans. Never run a release or `npm publish` locally;
  the `prepublishOnly` guard blocks raw `npm publish` (CI sets `RELEASE_MODE=true`).
- Keep TypeScript `incremental` OFF. Run `npm pack --dry-run` before every release.
- Set `usableAsTool: true`. Test every operation through BOTH the normal node path and
  the AI-Agent tool path. There is no `npm run harness` script — the harness is
  `./scripts/harness-up.sh up` (build, boot, seed credential, import workflows) then
  `./scripts/harness-up.sh run` (gates 1-4b headless). Gate 5 is the AI-Agent tool path and
  is interactive: it needs an `anthropicApi` credential and the chat UI, so it cannot run
  headlessly (gotchas §9).
- Secrets only in gitignored `.env.local`. Never hardcode secrets anywhere; rotate on leak.
- Conventional commits (feat/fix/chore/...). The changelog and version bump are derived
  from commit messages; keep npm and the GitHub repo in lockstep on each release.
- Declarative node style by default; programmatic only with a documented reason.

## Definition of done
- `npm run lint` clean and `npx @n8n/scan-community-package @nodrel-dev/n8n-nodes-ups` passes.
- Verified through normal AND AI-Agent tool paths in the Docker harness
  (`./scripts/harness-up.sh`; gate 5 is the tool path and is interactive).
- No new runtime dependency introduced.
- `npm audit` shows no HIGH or CRITICAL. Advisories inside `@n8n/node-cli`'s own tree are
  upstream-blocked and dev-only — the published tarball is LICENSE + README + dist, and the
  production tree is empty — but record which they are rather than letting the count drift.

If a rule is better enforced by CI or a lint/hook check, prefer that over relying on prose.

## Public vs private split

This public repo (`nodrel-dev/n8n-ups-node`) ships only what's safe to publish: the
node source, public docs (`README.md`, `docs/` incl. the public ADRs, `CONTEXT.md`,
`AGENTS.md`/`.agents/`), and config. Everything sensitive lives in a **private companion
repo**, `nodrel-dev/n8n-ups-node-internal`, cloned into `internal/` (gitignored here):

- `ups-api-documentation/` — copyrighted UPS API specs.
- `ups-node-build-brief.md` — the commercial build brief.
- `specs/` and `.specify/` — spec-kit feature spec, planning, and the constitution.

On a fresh clone, restore it with `./bootstrap-internal.sh` (defaults to the SSH remote;
pass a different remote as `$1`). `internal/`, `.claude/`, `.specify/`, `.vscode/`,
`.harness-stage/`, `.env.local`, and `*.tgz` are all gitignored — never commit them here.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
@internal/specs/001-ups-node/plan.md (with research.md, data-model.md, contracts/, and
quickstart.md alongside it).
<!-- SPECKIT END -->
