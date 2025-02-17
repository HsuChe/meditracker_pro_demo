module.exports = {
  // Lint & Prettify TS and JS files
  '**/*.(ts|tsx|js|jsx)': (filenames) => [
    `eslint --fix ${filenames.join(' ')}`,
    `prettier --write ${filenames.join(' ')}`,
    `jest --bail --findRelatedTests ${filenames.join(' ')}`
  ],
  
  // Prettify only Markdown and JSON files
  '**/*.(md|json)': (filenames) =>
    `prettier --write ${filenames.join(' ')}`
};