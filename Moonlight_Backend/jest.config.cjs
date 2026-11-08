/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest/presets/default-esm', // Preset específico para ESM
  testPathIgnorePatterns: ['<rootDir>/dist/'],
  testEnvironment: 'node',
  rootDir: "./",
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@shared/(.*)\\.js$': '<rootDir>/src/shared/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@modules/(.*)\\.js$': '<rootDir>/src/modules/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
  },
  transform: {
    // Configura o ts-jest para usar ESM durante a transformação
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
};
