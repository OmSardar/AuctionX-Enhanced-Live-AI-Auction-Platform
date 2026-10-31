const request = require("supertest");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestUser, createTestSeller } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const Payment = require("../../../src/modules/payments/models/Payment");
const Order = require("../../../src/modules/orders/models/orderSchema");
const Subscription = require("../../../src/modules/subscriptions/models/subscription");
const Seller = require("../../../src/modules/sellers/accounts/models/seller");
const AuditLog = require("../../../src/modules/authentication/models/auditLog");

describe("SOAP Transaction & Settlement Service Integration Tests", () => {
  const TEST_API_KEY = "ax_soap_test_key_auctionx_b2b_secret_2026";

  beforeEach(async () => {
    await clearDatabase();
  });

  describe("1. WSDL Definition & Service Metadata", () => {
    it("should return authoritative WSDL XML on GET /api/soap/transactions?wsdl", async () => {
      const res = await request(app).get("/api/soap/transactions?wsdl");

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/xml/);
      expect(res.text).toContain("<wsdl:definitions");
      expect(res.text).toContain("AuctionXTransactionService");
      expect(res.text).toContain("AuctionXTransactionPort");
      expect(res.text).toContain("GetTransactionDetails");
      expect(res.text).toContain("QuerySettlement");
      expect(res.text).toContain("Razorpay");
    });

    it("should return service info on GET /api/soap/transactions without ?wsdl", async () => {
      const res = await request(app).get("/api/soap/transactions");
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain("AuctionX SOAP Transaction & Settlement Ledger Service is active");
    });
  });

  describe("2. Authentication & XXE Security Gate", () => {
    it("should reject unauthenticated SOAP requests with SOAP Fault and HTTP 401", async () => {
      const soap11Payload = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetTransactionDetailsRequest xmlns="http://auctionx.internal/soap/transactions">
      <TransactionId>non_existent_id</TransactionId>
    </GetTransactionDetailsRequest>
  </soap:Body>
</soap:Envelope>`;

      const res = await request(app)
        .post("/api/soap/transactions")
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(soap11Payload);

      expect(res.statusCode).toBe(401);
      expect(res.text).toContain("<soap:Fault>");
      expect(res.text).toContain("Authentication required");
    });

    it("should authenticate via OASIS WS-Security UsernameToken in <soap:Header> without HTTP X-API-Key header", async () => {
      const { user } = await createTestUser({ email: "wss_payer@example.com" });
      const payment = await Payment.create({
        type: "SELLER_SUBSCRIPTION",
        userId: user._id,
        userEmail: user.email,
        amount: 500000,
        currency: "INR",
        status: "CAPTURED",
        razorpayOrderId: "order_wss_123",
        razorpayPaymentId: "pay_wss_456",
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      const wssPayload = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
               xmlns:ax="http://auctionx.internal/soap/transactions">
  <soap:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>admin</wsse:Username>
        <wsse:Password>${TEST_API_KEY}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    <ax:GetTransactionDetailsRequest>
      <ax:PaymentId>${payment._id}</ax:PaymentId>
    </ax:GetTransactionDetailsRequest>
  </soap:Body>
</soap:Envelope>`;

      const res = await request(app)
        .post("/api/soap/transactions")
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(wssPayload);

      expect(res.statusCode).toBe(200);
      expect(res.text).toContain("<ax:GetTransactionDetailsResponse>");
      expect(res.text).toContain("<ax:Status>CAPTURED</ax:Status>");
      expect(res.text).toContain("<ax:AmountPaise>500000</ax:AmountPaise>");
    });

    it("should reject invalid OASIS WS-Security credentials with SOAP Fault and HTTP 401", async () => {
      const invalidWssPayload = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
               xmlns:ax="http://auctionx.internal/soap/transactions">
  <soap:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>admin</wsse:Username>
        <wsse:Password>wrong_password_attempt</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    <ax:GetTransactionDetailsRequest>
      <ax:PaymentId>507f1f77bcf86cd799439011</ax:PaymentId>
    </ax:GetTransactionDetailsRequest>
  </soap:Body>
</soap:Envelope>`;

      const res = await request(app)
        .post("/api/soap/transactions")
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(invalidWssPayload);

      expect(res.statusCode).toBe(401);
      expect(res.text).toContain("<soap:Fault>");
      expect(res.text).toContain("Authentication required");
    });

    it("should reject replayed WS-Security request with duplicate nonce", async () => {
      const fixedNonce = "abc123nonceReplayTest==";
      const created = new Date().toISOString();
      const wsseHeader = `
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
      <wsse:UsernameToken>
        <wsse:Username>admin</wsse:Username>
        <wsse:Password>${TEST_API_KEY}</wsse:Password>
        <wsse:Nonce>${fixedNonce}</wsse:Nonce>
        <wsu:Created>${created}</wsu:Created>
      </wsse:UsernameToken>
    </wsse:Security>`;

      const payload = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ax="http://auctionx.internal/soap/transactions">
  <soap:Header>${wsseHeader}</soap:Header>
  <soap:Body>
    <ax:GetTransactionDetailsRequest>
      <ax:TransactionId>nonexistent_replay_id</ax:TransactionId>
    </ax:GetTransactionDetailsRequest>
  </soap:Body>
</soap:Envelope>`;

      // First request (passes WS-Security auth, fails on record 404)
      const res1 = await request(app)
        .post("/api/soap/transactions")
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(payload);
      expect(res1.statusCode).toBe(404);

      // Replay request with identical nonce should fail authentication with 401
      const res2 = await request(app)
        .post("/api/soap/transactions")
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(payload);
      expect(res2.statusCode).toBe(401);
      expect(res2.text).toContain("replay attack was detected");
    });

    it("should strictly reject XXE payload with DOCTYPE/ENTITY declarations", async () => {
      const xxePayload = `<?xml version="1.0" encoding="ISO-8859-1"?>
<!DOCTYPE foo [
  <!ELEMENT foo ANY >
  <!ENTITY xxe SYSTEM "file:///etc/passwd" >
]>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetTransactionDetailsRequest xmlns="http://auctionx.internal/soap/transactions">
      <TransactionId>&xxe;</TransactionId>
    </GetTransactionDetailsRequest>
  </soap:Body>
</soap:Envelope>`;

      const res = await request(app)
        .post("/api/soap/transactions")
        .set("Content-Type", "text/xml; charset=utf-8")
        .set("X-API-Key", TEST_API_KEY)
        .send(xxePayload);

      expect(res.statusCode).toBe(400);
      expect(res.text).toContain("<soap:Fault>");
      expect(res.text).toContain("XXE vulnerability detected");
    });
  });

  describe("3. SOAP 1.1 GetTransactionDetails Operation", () => {
    it("should return transaction details for valid Payment record", async () => {
      const { user } = await createTestUser({ email: "soap_buyer@example.com" });

      const payment = await Payment.create({
        type: "SELLER_SUBSCRIPTION",
        userId: user._id,
        userEmail: user.email,
        amount: 299900, // ₹2,999.00
        currency: "INR",
        status: "CAPTURED",
        razorpayOrderId: "order_soap_test_12345",
        razorpayPaymentId: "pay_soap_test_98765",
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      const soap11Payload = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ax="http://auctionx.internal/soap/transactions">
  <soap:Body>
    <ax:GetTransactionDetailsRequest>
      <ax:TransactionId>${payment._id}</ax:TransactionId>
    </ax:GetTransactionDetailsRequest>
  </soap:Body>
</soap:Envelope>`;

      const res = await request(app)
        .post("/api/soap/transactions")
        .set("Content-Type", "text/xml; charset=utf-8")
        .set("SOAPAction", '"http://auctionx.internal/soap/transactions/GetTransactionDetails"')
        .set("X-API-Key", TEST_API_KEY)
        .send(soap11Payload);

      expect(res.statusCode).toBe(200);
      expect(res.text).toContain("<ax:GetTransactionDetailsResponse>");
      expect(res.text).toContain("<ax:Status>CAPTURED</ax:Status>");
      expect(res.text).toContain("<ax:AmountPaise>299900</ax:AmountPaise>");
      expect(res.text).toContain("<ax:AmountINR>2999.00</ax:AmountINR>");
      expect(res.text).toContain("<ax:Currency>INR</ax:Currency>");
      expect(res.text).toContain("<ax:Type>SELLER_SUBSCRIPTION</ax:Type>");
      expect(res.text).toContain("<ax:PayerEmail>soap_buyer@example.com</ax:PayerEmail>");
      expect(res.text).toContain("<ax:RazorpayOrderId>order_soap_test_12345</ax:RazorpayOrderId>");
      expect(res.text).toContain("<ax:RazorpayPaymentId>pay_soap_test_98765</ax:RazorpayPaymentId>");
      expect(res.text).toContain("AuctionX ledger query service. Real-time payments processed via Razorpay gateway.");
    });

    it("should return SOAP Fault 404 when transaction is not found", async () => {
      const nonExistentId = "507f1f77bcf86cd799439011";
      const soap11Payload = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ax="http://auctionx.internal/soap/transactions">
  <soap:Body>
    <ax:GetTransactionDetailsRequest>
      <ax:TransactionId>${nonExistentId}</ax:TransactionId>
    </ax:GetTransactionDetailsRequest>
  </soap:Body>
</soap:Envelope>`;

      const res = await request(app)
        .post("/api/soap/transactions")
        .set("Content-Type", "text/xml; charset=utf-8")
        .set("X-API-Key", TEST_API_KEY)
        .send(soap11Payload);

      expect(res.statusCode).toBe(404);
      expect(res.text).toContain("<faultcode>soap:Client.NotFound</faultcode>");
      expect(res.text).toContain("Transaction record not found");
    });
  });

  describe("4. SOAP 1.2 QuerySettlement Operation", () => {
    it("should return order settlement status using SOAP 1.2 envelope", async () => {
      const order = await Order.create({
        title: "Vintage Rolex Submariner",
        name: "Vintage Rolex",
        userEmail: "buyer_rolex@example.com",
        sellerEmail: "seller_rolex@example.com",
        category: "Watches",
        images: [{ secure_url: "https://example.com/rolex.jpg", public_id: "rolex_1" }],
        biddingStartPrice: 50000,
        highestBid: 125000,
        finalPrice: 125000,
        phoneNo: "+919876543210",
        address: "Mumbai, India",
        status: "PAID",
        paidAt: new Date(),
        isDisputeHoldActive: false,
      });

      const soap12Payload = `<?xml version="1.0" encoding="utf-8"?>
<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope" xmlns:ax="http://auctionx.internal/soap/transactions">
  <env:Body>
    <ax:QuerySettlementRequest>
      <ax:OrderId>${order._id}</ax:OrderId>
    </ax:QuerySettlementRequest>
  </env:Body>
</env:Envelope>`;

      const res = await request(app)
        .post("/api/soap/transactions")
        .set("Content-Type", "application/soap+xml; charset=utf-8")
        .set("X-API-Key", TEST_API_KEY)
        .send(soap12Payload);

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/soap\+xml/);
      expect(res.text).toContain("<ax:QuerySettlementResponse>");
      expect(res.text).toContain("<ax:Status>PAID</ax:Status>");
      expect(res.text).toContain("<ax:FinalPrice>125000.00</ax:FinalPrice>");
      expect(res.text).toContain("<ax:DisputeHoldActive>false</ax:DisputeHoldActive>");
      expect(res.text).toContain("<ax:WinnerEmail>buyer_rolex@example.com</ax:WinnerEmail>");
      expect(res.text).toContain("<ax:SellerEmail>seller_rolex@example.com</ax:SellerEmail>");
    });

    it("should accurately report active dispute holds and remain strictly read-only without modifying state", async () => {
      const order = await Order.create({
        title: "Vintage Diamond Necklace",
        userEmail: "buyer_dispute@example.com",
        sellerEmail: "seller_dispute@example.com",
        name: "Disputed Buyer",
        biddingStartPrice: 100000,
        category: "Jewelry",
        highestBid: 250000,
        finalPrice: 250000,
        phoneNo: "+919876543210",
        address: "Delhi, India",
        status: "PENDING",
        isDisputeHoldActive: true,
      });

      const soap12Payload = `<?xml version="1.0" encoding="utf-8"?>
<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope" xmlns:ax="http://auctionx.internal/soap/transactions">
  <env:Body>
    <ax:QuerySettlementRequest>
      <ax:OrderId>${order._id}</ax:OrderId>
    </ax:QuerySettlementRequest>
  </env:Body>
</env:Envelope>`;

      const res = await request(app)
        .post("/api/soap/transactions")
        .set("Content-Type", "application/soap+xml; charset=utf-8")
        .set("X-API-Key", TEST_API_KEY)
        .send(soap12Payload);

      expect(res.statusCode).toBe(200);
      expect(res.text).toContain("<ax:Status>PENDING</ax:Status>");
      expect(res.text).toContain("<ax:DisputeHoldActive>true</ax:DisputeHoldActive>");

      // Strict Non-Mutation Invariant Check: Verify Order was NOT modified or released
      const orderAfterQuery = await Order.findById(order._id);
      expect(orderAfterQuery.status).toBe("PENDING");
      expect(orderAfterQuery.isDisputeHoldActive).toBe(true);
      expect(orderAfterQuery.paidAt).toBeFalsy();
    });

    it("should forbid a seller from querying another merchant's order settlement (HTTP 403 SOAP Fault)", async () => {
      const { seller, token: sellerToken } = await createTestSeller({ email: "seller_a@example.com" });

      const otherSellerOrder = await Order.create({
        title: "Rare Painting",
        userEmail: "buyer_art@example.com",
        sellerEmail: "seller_b@example.com",
        name: "Art Buyer",
        biddingStartPrice: 10000,
        category: "Art",
        highestBid: 20000,
        finalPrice: 20000,
        phoneNo: "+919876543210",
        address: "Kolkata, India",
        status: "PAID",
      });

      const soapPayload = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ax="http://auctionx.internal/soap/transactions">
  <soap:Body>
    <ax:QuerySettlementRequest>
      <ax:OrderId>${otherSellerOrder._id}</ax:OrderId>
    </ax:QuerySettlementRequest>
  </soap:Body>
</soap:Envelope>`;

      const res = await request(app)
        .post("/api/soap/transactions")
        .set("Content-Type", "text/xml; charset=utf-8")
        .set("Cookie", [`token=${sellerToken}`])
        .send(soapPayload);

      expect(res.statusCode).toBe(403);
      expect(res.text).toContain("<faultcode>soap:Client.Unauthorized</faultcode>");
      expect(res.text).toContain("Unauthorized to query settlement for another merchant");
    });
  });
});

describe("Admin Subscription Management API Integration Tests", () => {
  it("should return configured subscription plans with active subscriber counts on GET /api/subscriptions/plans", async () => {
    const { token: adminToken } = await createTestUser({ email: "admin_sub_mgr@example.com", role: "admin" });

    // Seed one active subscription
    await Subscription.create({
      planId: "business",
      planName: "Business",
      userEmail: "active_biz@example.com",
      status: "active",
      billingInterval: "monthly",
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      price: 2999,
      amountPaise: 299900,
      listingLimit: 50,
    });

    const res = await request(app)
      .get("/api/subscriptions/plans")
      .set("Cookie", [`token=${adminToken}`]);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.plans)).toBe(true);
    expect(res.body.plans.length).toBe(4);

    const bizPlan = res.body.plans.find((p) => p.id === "business");
    expect(bizPlan).toBeDefined();
    expect(bizPlan.activeSubscribers).toBe(1);
    expect(bizPlan.listingLimit).toBe(50);
  });

  it("should cancel subscription and revert seller cached plan to free on PUT /api/subscriptions/:id/cancel", async () => {
    const csrf = createCsrfCredentials();
    const { user: adminUser, token: adminToken } = await createTestUser({ email: "admin_cancel_mgr@example.com", role: "admin" });
    const { seller } = await createTestSeller({ email: "seller_to_cancel@example.com" });

    // Update seller to business
    await Seller.updateOne({ _id: seller._id }, { subscriptionPlan: "business", subscriptionStatus: "active" });

    const sub = await Subscription.create({
      planId: "business",
      planName: "Business",
      sellerId: seller._id,
      userEmail: seller.email,
      status: "active",
      billingInterval: "monthly",
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      price: 2999,
      amountPaise: 299900,
      listingLimit: 50,
    });

    const res = await request(app)
      .put(`/api/subscriptions/${sub._id}/cancel`)
      .set("Cookie", [csrf.cookie, `token=${adminToken}`])
      .set(csrf.headerName, csrf.headerValue)
      .send({ reason: "Policy violation" });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.subscription.status).toBe("cancelled");
    expect(res.body.subscription.cancellationReason).toBe("Policy violation");

    // Verify Seller model cached plan was reverted
    const updatedSeller = await Seller.findById(seller._id);
    expect(updatedSeller.subscriptionPlan).toBe("free");
    expect(updatedSeller.subscriptionStatus).toBe("cancelled");

    // Verify durable AuditLog entry was created
    const auditEntry = await AuditLog.findOne({
      resourceId: sub._id.toString(),
      action: "CANCEL_SUBSCRIPTION",
    });
    expect(auditEntry).toBeDefined();
    expect(auditEntry.outcome).toBe("SUCCESS");
    expect(auditEntry.reason).toBe("Policy violation");
  });
});
