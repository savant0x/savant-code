const fs = require('fs')

const app = require('./app')
const { welcome } = require('./greet')

if (typeof welcome !== 'function') {
  throw new Error('greet.js should export a function named welcome')
}

if (welcome('World') !== 'Hello, World') {
  throw new Error('welcome("World") should return "Hello, World"')
}

if (app('World') !== 'Hello, World') {
  throw new Error('app("World") should return "Hello, World"')
}

const greetSrc = fs.readFileSync('greet.js', 'utf8')
const appSrc = fs.readFileSync('app.js', 'utf8')

// The module file is still named greet.js, so the import path './greet' is
// fine. We only want to ensure the exported property and function call were
// renamed from greet to welcome.
if (greetSrc.includes('greet:') || greetSrc.includes('greet(')) {
  throw new Error('greet.js still exports or defines a function named greet')
}

if (appSrc.includes('const { greet }') || appSrc.includes('greet(')) {
  throw new Error('app.js still imports or calls a function named greet')
}

console.log('ok')
