const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const {
  generateWsdl,
  processSoapTransactionRequest,
} = require("./soapTransactionService");

/**
 * GET /api/soap/transactions?wsdl
 * Exposes authoritative WSDL definition.
 */
router.get("/", (req, res) => {
  if (req.query.wsdl !== undefined || req.query.WSDL !== undefined) {
    const host = req.get("host") || "localhost:5000";
    const proto = req.protocol || "http";
    const serviceUrl = `${proto}://${host}/api/soap/transactions`;
    const wsdl = generateWsdl(serviceUrl);

    res.set("Content-Type", "application/xml; charset=utf-8");
    return res.status(200).send(wsdl);
  }

  // Without ?wsdl, return human-readable service status
  res.set("Content-Type", "text/plain; charset=utf-8");
  return res.status(200).send(
    "AuctionX SOAP Transaction & Settlement Ledger Service is active.\nQuery WSDL with ?wsdl.\nSupported operations: GetTransactionDetails, QuerySettlement."
  );
});

/**
 * POST /api/soap/transactions
 * Processes incoming SOAP 1.1 and SOAP 1.2 transaction queries.
 */
router.post("/", async (req, res) => {
  try {
    const rawBody =
      req.rawBody ||
      (typeof req.body === "string" ? req.body : Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "");

    const xmlString = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");

    let sessionUser = req.user || req.seller || null;
    if (!sessionUser) {
      const token =
        req.cookies?.token ||
        req.cookies?.sellerToken ||
        (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")
          ? req.headers.authorization.split(" ")[1]
          : null);
      if (token) {
        try {
          const secret = process.env.JWT_SECRET || "auctionx-super-secure-test-jwt-secret-key-32chars";
          const decoded = jwt.verify(token, secret);
          if (decoded && !decoded.mfaPending) {
            sessionUser = {
              _id: decoded.id || decoded._id,
              email: decoded.email,
              role: decoded.role || (decoded.isAdmin ? "admin" : "user"),
              isAdmin: Boolean(decoded.isAdmin || decoded.role === "admin"),
            };
          }
        } catch {
          // Token invalid/expired; fallback to other SOAP auth methods
        }
      }
    }

    const contentType = req.headers["content-type"] || "text/xml";
    const result = await processSoapTransactionRequest({
      xmlString,
      contentType,
      headers: req.headers,
      user: sessionUser,
    });

    res.set("Content-Type", result.contentType);
    return res.status(result.statusCode).send(result.body);
  } catch (error) {
    console.error("SOAP Transaction Service error:", error);
    const isSoap12 = (req.headers["content-type"] || "").includes("application/soap+xml");
    const statusCode = error.statusCode || 500;
    const { buildSoapFault } = require("./soapTransactionService");

    const faultXml = buildSoapFault(
      error.code || "Server.InternalError",
      error.message || "An unexpected error occurred during SOAP processing",
      isSoap12
    );

    res.set("Content-Type", isSoap12 ? "application/soap+xml; charset=utf-8" : "text/xml; charset=utf-8");
    return res.status(statusCode).send(faultXml);
  }
});

module.exports = router;
