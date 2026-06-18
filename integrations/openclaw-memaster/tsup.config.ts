import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/init-cli.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node18",
  splitting: false,
  treeshake: true,
});