const run = require('./app')

if (run() !== 'HELLO, ALICE') {
  throw new Error('run() should return "HELLO, ALICE"')
}

console.log('ok')
