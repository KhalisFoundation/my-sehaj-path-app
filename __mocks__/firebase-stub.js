module.exports = new Proxy({}, { get: () => jest.fn() });
