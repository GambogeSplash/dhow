import { defineConfig } from "vitest/config";

// Scope the runner to our own unit tests. Without this, vitest's default glob
// also picks up the vendored Hardhat/Mocha suites under contracts/lib/** (e.g.
// OpenZeppelin's *.test.js), which aren't vitest tests and report as failures.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "components/**/*.test.ts"],
    exclude: ["node_modules/**", "contracts/**", ".next/**"],
  },
});
