const fs = require('fs')

const greet = require('./greet')

// Contract check: greet accepts an options object with name and uppercase.
if (greet({ name: 'Bob', uppercase: true }) !== 'HELLO, BOB') {
  throw new Error(
    'greet should uppercase the message when options.uppercase is true',
  )
}

if (greet({ name: 'Bob', uppercase: false }) !== 'Hello, Bob') {
  throw new Error(
    'greet should return normal case when options.uppercase is false',
  )
}

// Orchestration check: both source files must use the options contract, not a plain string.
const greetSrc = fs.readFileSync('greet.js', 'utf8')
const appSrc = fs.readFileSync('app.js', 'utf8')

if (!greetSrc.includes('options')) {
  throw new Error('greet.js should accept an options object')
}

if (!appSrc.includes('name:') || !appSrc.includes('uppercase:')) {
  throw new Error('app.js should pass an options object to greet')
}

console.log('ok')
