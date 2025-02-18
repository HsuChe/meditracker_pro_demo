module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/app/__tests__'],
  testMatch: ['**/*.test.js', '**/*.test.tsx', '**/*.test.ts'],
  setupFilesAfterEnv: [
    '<rootDir>/app/__tests__/setup/jest.setup.js'
  ],
  moduleDirectories: ['node_modules', '<rootDir>'],
  testPathIgnorePatterns: ['/node_modules/'],
  verbose: true,
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }],
    '^.+\\.(js|jsx)$': ['babel-jest', { configFile: './.babelrc' }]
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/app/__tests__/setup/fileMock.js',
    '^@/(.*)$': '<rootDir>/$1'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testEnvironmentOptions: {
    url: 'http://localhost'
  }
}; 