## Why

All 8 packages in this monorepo export compiled `dist/` artifacts. This causes two DX problems: (1) VS Code resolves stale types and reports false errors when source changes haven't been compiled yet, and (2) "Go to Definition" jumps to `.d.ts` files instead of the original TypeScript source. Both issues slow down development and create friction in a multi-package workspace.

## What Changes

- Point each package's `exports` field at source `.ts` files so VS Code and TypeScript resolve source directly during development.
- Add `publishConfig.exports` to each package so `npm publish` still ships compiled `dist/` output to external consumers.
- Enable `composite: true` in each package's `tsconfig.json` and add TypeScript project references so cross-package resolution uses source.
- Create a root `tsconfig.json` with project references to all packages.

## Capabilities

### New Capabilities
- `source-exports`: Package exports point to `.ts` source for dev, with `publishConfig` override for publishing compiled output.
- `project-references`: TypeScript project references across packages for correct cross-package source resolution in IDE.

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **All 8 packages**: `package.json` exports remapped, `tsconfig.json` updated with `composite: true`
- **Root config**: New `tsconfig.json` with project references added
- **Build**: tsup build pipeline unchanged — still produces `dist/` for publishing
- **No breaking changes** for external npm consumers (publishConfig preserves current dist layout)
