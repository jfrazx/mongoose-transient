module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '/test/.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  coverageDirectory: './coverage/',
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
