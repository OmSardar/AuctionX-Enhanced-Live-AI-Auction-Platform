const jwt = require("jsonwebtoken");
const Product = require("../../products/models/productSchema");
const User = require("../../users/models/user");
const {
  getAuctionTimeStatus,
} = require("../../bidding/middleware/checkTimeRestriction");
const {
  placeBid: executePlaceBid,
  BidError,
} = require("../../bidding/services/bidService");

const socketController = (io) => {
  // Authenticate socket connections via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    // Allow unauthenticated connections (they can view but not bid)
    if (!token) {
      socket.user = null;
      return next();
    }

    try {
      const secret = process.env.JWT_SECRET;
      const decoded = jwt.verify(token, secret);
      if (decoded && decoded.id && !decoded._id) {
        decoded._id = decoded.id;
      }
      socket.user = decoded;
      next();
    } catch (err) {
      // Invalid token — still allow connection but mark as unauthenticated
      socket.user = null;
      next();
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `Socket connected: ${socket.id} (user: ${socket.user?.email || "anonymous"})`
    );

    // Join a product room and receive current bid state from the database
    socket.on("joinProductRoom", async (productId) => {
      try {
        socket.join(productId);

        // Load the product's current bid state from MongoDB
        const product = await Product.findById(productId).lean();
        if (product) {
          if (product.isModerated || ["REMOVED", "SUSPENDED"].includes(product.moderationStatus)) {
            const isAdmin = socket.user && ["admin", "super-admin"].includes(socket.user.role);
            if (!isAdmin) {
              return socket.emit("error", {
                code: "LISTING_MODERATED",
                message: "This auction listing is unavailable because it has been moderated",
              });
            }
          }

          const productData = {
            productId: product._id.toString(),
            currentBid:
              product.currentPrice !== undefined
                ? product.currentPrice
                : product.biddingStartPrice || 0,
            bidderName: product.highestBidderName || product.tempname || "",
            biddingEndTime:
              product.biddingEndTime ||
              (product.endTime ? product.endTime.toISOString() : null),
            bidCount: product.bidCount || 0,
          };
          socket.emit("productData", productData);
        }
      } catch (error) {
        console.error(
          `Error joining product room ${productId}:`,
          error.message
        );
        socket.emit("error", { message: "Failed to load product data" });
      }
    });

    // Handle bid placement with authoritative service validation
    socket.on("placeBid", async (newBidData) => {
      try {
        // Must be authenticated to bid
        if (!socket.user) {
          return socket.emit("error", {
            code: "UNAUTHORIZED",
            message: "Authentication required to place a bid",
          });
        }

        // Authoritative suspension check
        const bidderDoc = await User.findById(socket.user._id || socket.user.id).select("status suspensionReason");
        if (bidderDoc && bidderDoc.status === "Suspended") {
          return socket.emit("error", {
            code: "ACCOUNT_SUSPENDED",
            message: `Account has been suspended${bidderDoc.suspensionReason ? `: ${bidderDoc.suspensionReason}` : ""}`,
          });
        }

        const { productId, currentBid, amount } = newBidData || {};
        const rawAmount = amount !== undefined ? amount : currentBid;

        if (!productId || rawAmount === undefined) {
          return socket.emit("error", {
            code: "INVALID_BID_DATA",
            message: "Invalid bid data: productId and amount are required",
          });
        }

        const bidAmount = parseFloat(rawAmount);

        // Execute authoritative bidding service (enforces concurrency, anti-snipe, and invariants)
        const result = await executePlaceBid({
          productId,
          bidder: socket.user,
          amount: bidAmount,
        });

        // Broadcast verified accepted bid to all users in the product room
        io.to(productId).emit("productData", result.broadcastData);
        io.to(productId).emit("bidPlaced", {
          productId,
          currentBid: result.broadcastData.currentBid,
          bidderName: result.broadcastData.bidderName,
          bidCount: result.broadcastData.bidCount,
        });

        if (result.wasExtended) {
          io.to(productId).emit("auctionExtended", {
            productId,
            newEndTime: result.broadcastData.biddingEndTime,
          });
        }
      } catch (error) {
        if (error instanceof BidError) {
          return socket.emit("error", {
            code: error.code,
            message: error.message,
            details: error.details,
          });
        }
        console.error("Error placing bid via socket:", error.message);
        socket.emit("error", {
          code: "INTERNAL_ERROR",
          message: error.message || "Failed to place bid",
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = socketController;
