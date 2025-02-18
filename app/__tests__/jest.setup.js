// Add TextEncoder/TextDecoder for pg package
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Add testing library matchers
require('@testing-library/jest-dom'); 