---
title: "Release process for EA MCP Server"
date: 2026-08-13
problem_type: conventions
category: conventions
module: build
tags:
  - release
  - versioning
  - build
  - checklist
track: knowledge
applies_when: "Shipping a new version of the EA MCP server"
---

# Release process for EA MCP Server

## Context

v2.0.0 release (2026-08-13) went through five pushback rounds because the release steps were done ad-hoc. Each round caught something the previous missed: stale dist, wrong version format, missing not-found handling on one tool, unupdated README. A checklist prevents repeating this.

## Guidance

### Pre-release checklist

1. **Bump version** in `package.json` (`"version": "X.Y.Z"`)
2. **Rebuild** — `npm run build` (prebuild generates `src/version.ts` with version + UTC build timestamp)
3. **Run tests** — `npm test` (156 tests must pass)
4. **Run eval** — `npm run eval:generate -- <qea-path>` then `npm run eval:run -- <qea-path>` (all tasks must pass)
5. **Verify dist is current** — `git diff --ignore-cr-at-eol --name-only` after build shows no real changes (CRLF warnings are cosmetic)
6. **Update README** — tool descriptions, usage examples, breaking changes
7. **Commit** with release notes as message — `git commit -m "feat: EA MCP Server vX.Y.Z — <summary>"`
8. **Push** — `git push origin main`

### Version format

`package.json` has the semver (`2.0.0`). The prebuild script generates:

```js
export const packageVersion = "2.0.0+20260813105415";
```

The `+YYYYMMDDHHmmss` suffix is a UTC build timestamp — unique per build, no self-reference problem (commit SHA cannot reference itself). Reported in `ea_get_model_info` as `serverVersion`.

### Breaking change criteria (bump major)

- Response shape changes (wrapping bare arrays, adding required fields)
- Renamed or removed tools
- Changed parameter semantics

### When to amend vs new commit

- **Amend** (`git commit --amend`) — fixing something in the same logical release before others depend on it. Force push required.
- **New commit** — after others have pulled or are using the current version.

## Why This Matters

Without a checklist, each release iteration catches one more missed step. Five pushback rounds in one afternoon = five manual verification passes by the consuming agent. A single pass through this checklist catches them all upfront.

## When to Apply

Every time a new version ships — whether a major release, a patch, or a pushback fix that changes the public contract.

## Examples

**Bad:** bump version → push → realize dist is stale → amend → realize README is wrong → amend again → realize one tool was missed → amend again.

**Good:** bump version → build → test → eval → verify dist → update README → commit → push → done.
