module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: ['src/domain/**/*.ts', 'src/storage/**/*.ts'],
  coverageThreshold: { global: { lines: 80, functions: 80, statements: 80, branches: 70 } }
};
