const ioClient = require("socket.io-client");

/**
 * Creates an authenticated or unauthenticated socket.io-client instance connected to the test server.
 */
function createSocketClient(server, token = null, extraOptions = {}) {
  const address = server.address();
  const port = address.port;

  const authOptions = token
    ? {
        auth: {
          token,
        },
      }
    : {};

  const client = ioClient(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    ...authOptions,
    ...extraOptions,
  });

  return client;
}

module.exports = {
  createSocketClient,
};
