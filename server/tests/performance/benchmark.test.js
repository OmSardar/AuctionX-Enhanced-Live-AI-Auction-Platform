/**
 * Performance Tests — Endpoint Benchmarks
 *
 * Uses autocannon to measure response time, throughput, and error rate
 * for critical API endpoints. Results include p50/p95/p99 latencies.
 */
const autocannon = require("autocannon");
const { app, server } = require("../../server");
const { clearDatabase } = require("../helpers/dbHelper");
const {
  createTestUser,
  createTestAdmin,
} = require("../helpers/authHelper");
const { createCsrfCredentials } = require("../helpers/csrfHelper");
const Product = require("../../src/modules/products/models/productSchema");

describe("Performance Tests — Endpoint Benchmarks", () => {
  let testServer;
  let baseUrl;

  beforeAll(async () => {
    await clearDatabase();

    // Seed some products for realistic reads
    for (let i = 0; i < 10; i++) {
      await Product.create({
        name: `Perf Test Item ${i}`,
        description: [{ name: "Condition", description: "New" }],
        email: "perfseller@example.com",
        category: i % 2 === 0 ? "Electronics" : "Art",
        images: [{ secure_url: `https://example.com/img${i}.jpg`, public_id: `img_${i}` }],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(),
        biddingStartTime: "10:00",
        biddingStartPrice: 1000 + i * 100,
        biddingEndTime: new Date(Date.now() + 86400000).toISOString(),
        status: "Active",
      });
    }

    await new Promise((resolve) => {
      testServer = server.listen(0, () => {
        const port = testServer.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll((done) => {
    testServer.close(done);
  });

  function runBenchmark(opts) {
    return new Promise((resolve, reject) => {
      const instance = autocannon(
        {
          url: baseUrl,
          connections: 10,
          duration: 5,
          ...opts,
        },
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });
  }

  function reportMetrics(label, result) {
    const metrics = {
      endpoint: label,
      "req/sec": result.requests.average,
      "latency_p50_ms": result.latency.p50,
      "latency_p95_ms": result.latency.p95,
      "latency_p99_ms": result.latency.p99,
      "total_requests": result.requests.total,
      "non2xx": result.non2xx,
      "errors": result.errors,
    };
    console.table([metrics]);
    return metrics;
  }

  it("GET / — server root benchmark", async () => {
    const result = await runBenchmark({ url: `${baseUrl}/` });
    const m = reportMetrics("GET /", result);
    expect(m.errors).toBe(0);
    expect(m["req/sec"]).toBeGreaterThan(0);
  });

  it("GET /api/products — products listing benchmark", async () => {
    const result = await runBenchmark({ url: `${baseUrl}/api/products` });
    const m = reportMetrics("GET /api/products", result);
    expect(m.errors).toBe(0);
  });

  it("GET /api/csrf-token — CSRF token benchmark", async () => {
    const result = await runBenchmark({ url: `${baseUrl}/api/csrf-token` });
    const m = reportMetrics("GET /api/csrf-token", result);
    expect(m.errors).toBe(0);
  });

  it("GET /api/banners — banners listing benchmark", async () => {
    const result = await runBenchmark({ url: `${baseUrl}/api/banners` });
    const m = reportMetrics("GET /api/banners", result);
    expect(m.errors).toBe(0);
  });

  it("POST /api/auth/login — auth login benchmark (invalid creds)", async () => {
    const csrf = createCsrfCredentials();
    const result = await runBenchmark({
      url: `${baseUrl}/api/auth/login`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": csrf.cookie,
        [csrf.headerName]: csrf.headerValue,
      },
      body: JSON.stringify({ email: "perf@test.com", password: "invalid" }),
    });
    const m = reportMetrics("POST /api/auth/login", result);
    // We expect non-2xx since creds are invalid, but no server errors
    expect(m.errors).toBe(0);
  });

  it("GET /api/products/:id — single product benchmark", async () => {
    const product = await Product.findOne();
    const result = await runBenchmark({
      url: `${baseUrl}/api/products/${product._id}`,
    });
    const m = reportMetrics("GET /api/products/:id", result);
    expect(m.errors).toBe(0);
  });

  it("GET /api/recommendations/:email — recommendation proxy benchmark", async () => {
    const result = await runBenchmark({
      url: `${baseUrl}/api/recommendations/perf@test.com`,
      connections: 5,
      duration: 3,
    });
    const m = reportMetrics("GET /api/recommendations", result);
    // Errors expected since FastAPI isn't running, but server shouldn't crash
    expect(result.requests.total).toBeGreaterThan(0);
  });
});
