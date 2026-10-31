/**
 * Load Tests — Gradual Ramp-Up HTTP Endpoints
 *
 * Increases concurrent connections to identify degradation points.
 * Tests products endpoint and auth login at 10, 25, and 50 concurrency.
 */
const autocannon = require("autocannon");
const { app, server } = require("../../server");
const { clearDatabase } = require("../helpers/dbHelper");
const { createCsrfCredentials } = require("../helpers/csrfHelper");
const Product = require("../../src/modules/products/models/productSchema");

describe("Load Tests — Gradual Ramp-Up", () => {
  let testServer;
  let baseUrl;
  const results = [];

  beforeAll(async () => {
    await clearDatabase();

    // Seed products for realistic reads
    for (let i = 0; i < 20; i++) {
      await Product.create({
        name: `Load Test Item ${i}`,
        description: [{ name: "Condition", description: "Good" }],
        email: "loadseller@example.com",
        category: "Electronics",
        images: [{ secure_url: `https://example.com/l${i}.jpg`, public_id: `l_${i}` }],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(),
        biddingStartTime: "10:00",
        biddingStartPrice: 500,
        biddingEndTime: new Date(Date.now() + 86400000).toISOString(),
        status: "Active",
      });
    }

    await new Promise((resolve) => {
      testServer = server.listen(0, () => {
        baseUrl = `http://127.0.0.1:${testServer.address().port}`;
        resolve();
      });
    });
  });

  afterAll((done) => {
    // Print summary table
    if (results.length > 0) {
      console.log("\n=== Load Test Summary ===");
      console.table(results);
    }
    testServer.close(done);
  });

  function runLoad(label, opts) {
    return new Promise((resolve, reject) => {
      autocannon(
        { url: baseUrl, duration: 5, ...opts },
        (err, result) => {
          if (err) return reject(err);
          const row = {
            test: label,
            connections: opts.connections,
            "req/sec": result.requests.average,
            "latency_p50": result.latency.p50,
            "latency_p95": result.latency.p95,
            "latency_p99": result.latency.p99,
            "total": result.requests.total,
            "non2xx": result.non2xx,
            "errors": result.errors,
          };
          results.push(row);
          resolve(row);
        }
      );
    });
  }

  // Products endpoint ramp-up
  it("products — 10 concurrent connections", async () => {
    const r = await runLoad("products@10", {
      url: `${baseUrl}/api/products`,
      connections: 10,
    });
    expect(r.errors).toBe(0);
  });

  it("products — 25 concurrent connections", async () => {
    const r = await runLoad("products@25", {
      url: `${baseUrl}/api/products`,
      connections: 25,
    });
    expect(r.errors).toBe(0);
  });

  it("products — 50 concurrent connections", async () => {
    const r = await runLoad("products@50", {
      url: `${baseUrl}/api/products`,
      connections: 50,
    });
    expect(r.errors).toBe(0);
  });

  // Auth login ramp-up
  it("auth login — 10 concurrent connections", async () => {
    const csrf = createCsrfCredentials();
    const r = await runLoad("auth@10", {
      url: `${baseUrl}/api/auth/login`,
      connections: 10,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": csrf.cookie,
        [csrf.headerName]: csrf.headerValue,
      },
      body: JSON.stringify({ email: "load@test.com", password: "invalid" }),
    });
    expect(r.errors).toBe(0);
  });

  it("auth login — 25 concurrent connections", async () => {
    const csrf = createCsrfCredentials();
    const r = await runLoad("auth@25", {
      url: `${baseUrl}/api/auth/login`,
      connections: 25,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": csrf.cookie,
        [csrf.headerName]: csrf.headerValue,
      },
      body: JSON.stringify({ email: "load@test.com", password: "invalid" }),
    });
    expect(r.errors).toBe(0);
  });
});
