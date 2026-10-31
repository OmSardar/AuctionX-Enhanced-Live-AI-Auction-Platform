/**
 * Setup process signal and error handlers for graceful application shutdown.
 */
function setupGracefulShutdown({ server, stopScheduler, stopOutboxWorker, logger }) {
  // Catch unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection:", reason);
    if (logger && logger.error) {
      logger.error("Unhandled Rejection:", { reason: reason?.message || reason });
    }
  });

  // Catch uncaught exceptions — log and exit
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    if (logger && logger.error) {
      logger.error("Uncaught Exception:", {
        message: error.message,
        stack: error.stack,
      });
    }
    process.exit(1);
  });

  // Graceful shutdown hooks
  const gracefulShutdown = async () => {
    console.log("Shutting down server gracefully...");
    if (stopScheduler) {
      try {
        await stopScheduler();
      } catch (err) {
        console.error("Error stopping scheduler:", err.message);
      }
    }
    if (stopOutboxWorker) {
      try {
        stopOutboxWorker();
      } catch (err) {
        console.error("Error stopping outbox worker:", err.message);
      }
    }
    if (server) {
      server.close(() => {
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);

  return { gracefulShutdown };
}

module.exports = { setupGracefulShutdown };
