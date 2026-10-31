const http = require("http");
const socketIo = require("socket.io");
const DbCon = require("../../infrastructure/database/databaseConnection");
const seedDatabase = require("../../../scripts/data/seedData");
const socketRoutes = require("../../modules/auctions/routes/socketRoutes");
const { startScheduler, stopScheduler } = require("../../infrastructure/scheduling/schedulerService");
const { startOutboxWorker, stopOutboxWorker } = require("../../infrastructure/messaging/recommendationTrackingService");
const { isOriginAllowed } = require("../application/createApplication");

function createServer(app, options = {}) {
  const PORT = process.env.PORT || 3000;
  const server = http.createServer(app);
  const allowedOrigins = options.allowedOrigins || [];

  const io = socketIo(server, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin, allowedOrigins)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      methods: ["GET", "POST", "DELETE", "PATCH", "PUT", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "x-csrf-token",
        "X-CSRF-Token",
        "Authorization",
      ],
      credentials: true,
    },
  });

  // Attach socket.io instance to express app for controller access
  app.set("io", io);

  // Mount socket routes
  app.use("/socket", socketRoutes(io));

  async function startServer() {
    try {
      await DbCon();
      await seedDatabase();

      server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        startScheduler({ io });
        startOutboxWorker();
      });
    } catch (error) {
      console.error("FATAL: Server startup failed:", error.message);
      process.exit(1);
    }
  }

  return {
    server,
    io,
    startServer,
    startScheduler,
    stopScheduler,
    startOutboxWorker,
    stopOutboxWorker,
  };
}

module.exports = { createServer };
