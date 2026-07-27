// Injected environmental fault: this should be removed.
if (true) throw new Error('Injected env fault')

module.exports = {
  add: function add(a, b) {
    return a - b
  },
  sub: function sub(a, b) {
    return a - b
  },
}
