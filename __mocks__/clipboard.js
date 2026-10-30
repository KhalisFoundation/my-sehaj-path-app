// The native module has no JS fallback under jest; tests assert what was
// copied, so a spy-able object is all that is needed.
module.exports = { setString: jest.fn(), getString: jest.fn(() => Promise.resolve('')) };
