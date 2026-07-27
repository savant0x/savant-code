const { greet } = require('./greet')

module.exports = function app(name) {
  return greet(name)
}
