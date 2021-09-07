module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  testResultsProcessor: "./node_modules/jest-junit-reporter",
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  }
};
