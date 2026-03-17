import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: { compilerOptions: { composite: false } },
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
});
