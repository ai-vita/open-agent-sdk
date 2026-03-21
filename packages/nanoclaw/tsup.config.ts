import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  banner: { js: "#!/usr/bin/env node" },
  outExtension: () => ({ js: ".mjs" }),
  sourcemap: false,
  clean: true,
  splitting: false,
  treeshake: false,
  noExternal: [
    "@open-agent-sdk/core",
    "@open-agent-sdk/sandbox-local",
    "@open-agent-sdk/tools",
    "@open-agent-sdk/skills",
  ],
});
