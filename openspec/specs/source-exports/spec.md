# source-exports Specification

## Purpose

Point package exports at TypeScript source files for development so IDEs resolve source directly, with publishConfig overrides to ship compiled output to npm consumers.

## Requirements
### Requirement: Package exports resolve to TypeScript source in development
Each package's `exports` field in `package.json` SHALL point to `./src/index.ts` so that TypeScript and IDE tooling resolve source files directly without requiring a build step.

#### Scenario: IDE resolves source types without build
- **WHEN** a developer imports from `@open-agent-sdk/core` in another workspace package without running `pnpm build`
- **THEN** TypeScript resolves the import to `packages/core/src/index.ts` with full type information

#### Scenario: Go to Definition navigates to source
- **WHEN** a developer uses "Go to Definition" on an import from a workspace package
- **THEN** the IDE navigates to the `.ts` source file, not a `.d.ts` declaration file

### Requirement: Published packages export compiled output
Each package SHALL include a `publishConfig.exports` field that remaps exports to compiled `dist/` output, ensuring npm consumers receive JavaScript and declaration files.

#### Scenario: npm pack includes compiled output
- **WHEN** `pnpm pack` is run on a package after building
- **THEN** the resulting tarball contains `dist/` files and the resolved exports point to `dist/index.js` and `dist/index.d.ts`

#### Scenario: publishConfig overrides dev exports
- **WHEN** a package is published to npm
- **THEN** the published `package.json` exports field points to `./dist/index.js` (not `./src/index.ts`)

### Requirement: Exports use correct condition ordering
The `exports` field SHALL list the `types` condition before `default` within each condition group, per TypeScript documentation.

#### Scenario: Types condition takes precedence
- **WHEN** TypeScript resolves an import using the `exports` field
- **THEN** it matches the `types` condition first, resolving to the `.ts` source (dev) or `.d.ts` file (published)

