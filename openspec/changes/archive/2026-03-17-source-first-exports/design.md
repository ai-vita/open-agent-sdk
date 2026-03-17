## Context

This monorepo contains 8 packages (core, tools, tools-web, skills, sandbox-local, sandbox-e2b, sandbox-vercel, sandbox-memory) built with tsup. All packages export from `dist/`, requiring a build step before IDE resolution works correctly. The base tsconfig already enables `declarationMap: true` and `sourceMap: true`.

## Goals / Non-Goals

**Goals:**
- VS Code and TypeScript resolve source `.ts` files directly during development — no build needed for type checking or navigation
- "Go to Definition" jumps to `.ts` source, not `.d.ts`
- External npm consumers continue to receive compiled `dist/` output unchanged
- Cross-package imports resolve via TypeScript project references

**Non-Goals:**
- Changing the build tool (tsup stays)
- Restructuring package internals or barrel exports
- Supporting CJS consumers during development (dev is ESM-only)

## Decisions

### 1. Source-first exports with `publishConfig` override

Each package's `exports` field points to `./src/index.ts` for development. The `publishConfig.exports` field remaps to `./dist/` for npm publish.

**Why over alternatives:**
- **vs. path aliases / `paths` mapping**: Path aliases require bundler/runtime support and don't work with `node --conditions`. Source exports work natively with TypeScript's `moduleResolution: NodeNext`.
- **vs. `typesVersions`**: A legacy workaround for older TypeScript. The `exports` field is the modern standard.
- **vs. build watch (`tsup --watch`)**: Keeps the dist-based approach but requires a running watcher. Adds latency and process management overhead.

### 2. TypeScript project references with `composite: true`

Each package tsconfig gets `composite: true`. A root `tsconfig.json` declares project references to all packages. Packages that depend on other workspace packages add `references` entries.

**Why:** Project references let `tsc` understand the dependency graph across packages and resolve source directly. This also enables incremental builds with `tsc --build`.

### 3. Conditional exports structure

```json
"exports": {
  ".": {
    "import": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  }
}
```

The `types` condition is listed first per TypeScript handbook guidance (conditions are matched top-to-bottom).

## Risks / Trade-offs

- **[Risk] Editors other than VS Code may not resolve `.ts` source exports** → Mitigation: This is standard TypeScript behavior with `moduleResolution: NodeNext`; all major editors using tsserver will work.
- **[Risk] `publishConfig` behavior varies across package managers** → Mitigation: pnpm supports `publishConfig.exports` natively. Verify with `pnpm pack --dry-run`.
- **[Trade-off] `composite: true` requires `declaration: true`** → Already enabled in tsconfig.base.json, no change needed.
- **[Trade-off] Root tsconfig.json must list all packages** → Small maintenance cost; packages are rarely added.
