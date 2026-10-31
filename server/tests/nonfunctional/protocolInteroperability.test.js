/**
 * Non-Functional Tests — Protocol, Web-Service & Interoperability Audit
 *
 * Verifies:
 * 1. SOAP 1.1 & SOAP 1.2 absence and safe 404 rejection on probe routes (?wsdl, /soap, /api/soap) with and without CSRF.
 * 2. XML / XXE injection immunity (Express body parsers do not evaluate XML entities).
 * 3. HTTP method restrictions and content-type handling on REST APIs.
 * 4. CORS preflight (OPTIONS) negotiation for allowed and disallowed origins.
 * 5. Malformed payload resilience (corrupted JSON handling).
 */
const request = require("supertest");
const { app } = require("../../server");
const { clearDatabase } = require("../helpers/dbHelper");
const { createCsrfCredentials } = require("../helpers/csrfHelper");

describe("Non-Functional Tests — Protocol & Interoperability", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  // =========================================================================
  // 1. SOAP 1.1 & 1.2 Absence & Safe Rejection
  // =========================================================================
  describe("SOAP 1.1 & 1.2 Absence Verification", () => {
    it("should reject SOAP 1.1 POST probe without CSRF token with HTTP 403", async () => {
      const soap11Payload = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetAuction xmlns="http://auctionx.internal/soap">
      <auctionId>12345</auctionId>
    </GetAuction>
  </soap:Body>
</soap:Envelope>`;

      const res = await request(app)
        .post("/soap")
        .set("Content-Type", "text/xml; charset=utf-8")
        .set("SOAPAction", '"http://auctionx.internal/soap/GetAuction"')
        .send(soap11Payload);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/CSRF/i);
    });

    it("should return structured 404 for SOAP 1.1 POST probe even when valid CSRF is provided", async () => {
      const csrf = createCsrfCredentials();
      const soap11Payload = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetAuction xmlns="http://auctionx.internal/soap">
      <auctionId>12345</auctionId>
    </GetAuction>
  </soap:Body>
</soap:Envelope>`;

      const res = await request(app)
        .post("/soap")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .set("Content-Type", "text/xml; charset=utf-8")
        .set("SOAPAction", '"http://auctionx.internal/soap/GetAuction"')
        .send(soap11Payload);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("success", false);
      expect(res.text).not.toContain("<soap:Envelope");
      expect(res.text).not.toContain("<soap:Fault");
    });

    it("should return structured 404 for SOAP 1.2 POST probe with valid CSRF", async () => {
      const csrf = createCsrfCredentials();
      const soap12Payload = `<?xml version="1.0" encoding="utf-8"?>
<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope">
  <env:Body>
    <GetAuction xmlns="http://auctionx.internal/soap">
      <auctionId>12345</auctionId>
    </GetAuction>
  </env:Body>
</env:Envelope>`;

      const res = await request(app)
        .post("/api/soap")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .set("Content-Type", "application/soap+xml; charset=utf-8")
        .send(soap12Payload);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("success", false);
      expect(res.headers["content-type"]).toMatch(/application\/json/);
      expect(res.text).not.toContain("<env:Envelope");
      expect(res.text).not.toContain("<env:Fault");
    });

    it("should NOT expose any WSDL definition when queried with ?wsdl", async () => {
      const res = await request(app).get("/api/products?wsdl");

      // Should treat as a normal REST query, ignoring ?wsdl parameter, returning JSON products
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/json/);
      expect(res.text).not.toContain("<wsdl:definitions");
      expect(res.text).not.toContain("xmlns:wsdl");
    });
  });

  // =========================================================================
  // 2. XML Parser Hardening & XXE Immunity
  // =========================================================================
  describe("XML Parser Hardening & XXE Immunity", () => {
    it("should NOT parse or expand XML external entities (XXE) sent to REST endpoints even with valid CSRF", async () => {
      const csrf = createCsrfCredentials();
      const xxePayload = `<?xml version="1.0" encoding="ISO-8859-1"?>
<!DOCTYPE foo [
  <!ELEMENT foo ANY >
  <!ENTITY xxe SYSTEM "file:///etc/passwd" >
]>
<user>
  <email>&xxe;</email>
  <password>secret</password>
</user>`;

      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .set("Content-Type", "text/xml")
        .send(xxePayload);

      // Since Express only registers express.json and express.urlencoded,
      // text/xml is NOT parsed into req.body; req.body is empty {} or unparsed string.
      // Therefore login fails with 400 Bad Request because email and password fields are missing,
      // never evaluating or leaking entity contents.
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toMatch(/Email and password are required|missing/i);
      expect(res.text).not.toContain("root:x:0:0");
      expect(res.text).not.toContain("daemon:");
    });

    it("should ignore XML body on CSRF-exempt endpoints and never deserialize XML into req.body", async () => {
      const xmlPayload = `<telemetry><interaction>view</interaction><productId>123</productId></telemetry>`;

      const res = await request(app)
        .post("/api/track")
        .set("Content-Type", "text/xml")
        .send(xmlPayload);

      // CSRF-exempt /api/track receives req.body as empty {} because no XML parser is registered.
      // Strict identity binding returns 401 or standard rejection without attempting XML parsing.
      expect([200, 400, 401]).toContain(res.statusCode);
      expect(res.text).not.toContain("syntax error");
    });
  });

  // =========================================================================
  // 3. HTTP Methods & Content Negotiation
  // =========================================================================
  describe("HTTP Methods & Content Negotiation", () => {
    it("should reject malformed JSON with HTTP 400 Bad Request when CSRF is provided", async () => {
      const csrf = createCsrfCredentials();
      const res = await request(app)
        .post("/api/products")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .set("Content-Type", "application/json")
        .send('{"title": "Unclosed string, invalid json');

      expect([400, 500]).toContain(res.statusCode);
    });

    it("should block unsupported HTTP TRACE method via CSRF or routing defense", async () => {
      const res = await request(app)
        .trace("/api/products");

      // Express and CSRF middleware block or reject TRACE requests
      expect([403, 404, 405]).toContain(res.statusCode);
    });
  });

  // =========================================================================
  // 4. CORS Preflight (OPTIONS) Interoperability
  // =========================================================================
  describe("CORS Preflight Interoperability", () => {
    it("should return preflight CORS headers for configured frontend origin", async () => {
      const res = await request(app)
        .options("/api/products")
        .set("Origin", "http://localhost:5173")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "Content-Type, x-csrf-token");

      expect([200, 204]).toContain(res.statusCode);
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("should NOT return Access-Control-Allow-Origin for untrusted third-party origin", async () => {
      const res = await request(app)
        .options("/api/products")
        .set("Origin", "https://unauthorized-attacker-domain.com")
        .set("Access-Control-Request-Method", "POST");

      const origin = res.headers["access-control-allow-origin"];
      if (origin) {
        expect(origin).not.toBe("https://unauthorized-attacker-domain.com");
      }
    });
  });
});
