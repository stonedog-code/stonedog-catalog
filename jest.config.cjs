/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/\\.claude/"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: { module: "commonjs" } }],
  },
  // Every adapter is a `fetch` away from a third-party API, and the suite fakes
  // that fetch. Coverage is therefore cheap to keep high and worth keeping
  // high: the branches that matter are the ones where an API answered with
  // something unexpected, which is exactly what nobody exercises by hand.
  coverageThreshold: {
    global: { branches: 85, functions: 90, lines: 90, statements: 90 },
  },
};
