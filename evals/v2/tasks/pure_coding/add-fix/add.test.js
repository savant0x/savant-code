const add = require('./add')

if (add(2, 3) !== 5) {
  throw new Error('add(2,3) should be 5')
}

if (add(0, 0) !== 0) {
  throw new Error('add(0,0) should be 0')
}

console.log('ok')
