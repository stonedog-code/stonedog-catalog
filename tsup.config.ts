import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  // Nothing external: this package has no runtime dependencies. The version of
  // these adapters inside HopperGuard sat in a package whose build listed
  // hopper-logger and @prisma/client — neither of which this code ever reached.
  external: [],
});
