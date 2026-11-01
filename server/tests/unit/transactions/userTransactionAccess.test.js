const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../../server");
const User = require("../../../src/modules/users/models/user");
const Admin = require("../../../src/modules/admin/authentication/models/admin");
const Transaction = require("../../../src/modules/admin/finance/models/transaction");
const { createTestUser, generateUserToken, generateAdminToken } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");

describe("User & Admin Transaction Access Control", () => {
  let userA;
  let userB;
  let admin;
  let userATx;
  let userBTx;
  let csrf;

  beforeAll(async () => {
    await User.init();
    await Admin.init();
    await Transaction.init();

    csrf = createCsrfCredentials();

    userA = await createTestUser({
      name: "User Alpha",
      email: "user.alpha@test.com",
      role: "user",
    });

    userB = await createTestUser({
      name: "User Beta",
      email: "user.beta@test.com",
      role: "user",
    });

    admin = await Admin.create({
      firstName: "Admin",
      lastName: "Master",
      email: "admin.master@test.com",
      password: "HashedPassword123!",
      role: "admin",
    });
    admin.token = generateAdminToken({
      id: admin._id.toString(),
      email: admin.email,
      role: "admin",
      purpose: "auth",
    });

    // Seed transactions
    userATx = await Transaction.create({
      userId: userA.user._id,
      userEmail: userA.user.email,
      name: userA.user.name,
      type: "deposit",
      amount: 500,
    });

    userBTx = await Transaction.create({
      userId: userB.user._id,
      userEmail: userB.user.email,
      name: userB.user.name,
      type: "withdrawal",
      amount: 200,
    });
  });

  afterAll(async () => {
    await Transaction.deleteMany({
      _id: { $in: [userATx._id, userBTx._id] },
    });
    await User.deleteMany({
      _id: { $in: [userA.user._id, userB.user._id] },
    });
    await Admin.deleteMany({ _id: admin._id });
  });

  it("1. Rejects unauthenticated GET /api/transactions with 401", async () => {
    const res = await request(app).get("/api/transactions");
    expect(res.status).toBe(401);
  });

  it("2. Allows User Alpha to GET /api/transactions and scopes results to User Alpha", async () => {
    const res = await request(app)
      .get("/api/transactions")
      .set("Authorization", `Bearer ${userA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.transactions).toBeDefined();
    const emails = res.body.transactions.map((t) => t.userEmail);
    expect(emails).toContain("user.alpha@test.com");
    expect(emails).not.toContain("user.beta@test.com");
  });

  it("3. Forcibly overrides query param if User Alpha queries for User Beta's transactions", async () => {
    const res = await request(app)
      .get("/api/transactions?userEmail=user.beta@test.com")
      .set("Authorization", `Bearer ${userA.token}`);

    expect(res.status).toBe(200);
    const emails = res.body.transactions.map((t) => t.userEmail);
    expect(emails).not.toContain("user.beta@test.com");
  });

  it("4. Allows User Alpha to record a transaction for themselves on POST /api/transactions", async () => {
    const res = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${userA.token}`)
      .set("X-CSRF-Token", csrf.token)
      .set("Cookie", csrf.cookie)
      .send({
        userEmail: "user.alpha@test.com",
        name: "User Alpha",
        type: "deposit",
        amount: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.userEmail).toBe("user.alpha@test.com");

    // Clean up created record
    if (res.body.data._id) {
      await Transaction.findByIdAndDelete(res.body.data._id);
    }
  });

  it("5. Rejects User Alpha attempting to record a transaction for User Beta with 403", async () => {
    const res = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${userA.token}`)
      .set("X-CSRF-Token", csrf.token)
      .set("Cookie", csrf.cookie)
      .send({
        userEmail: "user.beta@test.com",
        name: "User Beta",
        type: "deposit",
        amount: 1000,
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Cannot record transactions for other users/i);
  });

  it("6. Rejects User Alpha from updating transaction status (PUT /api/transactions/:id) with 403", async () => {
    const res = await request(app)
      .put(`/api/transactions/${userATx._id}`)
      .set("Authorization", `Bearer ${userA.token}`)
      .set("X-CSRF-Token", csrf.token)
      .set("Cookie", csrf.cookie)
      .send({
        status: "completed",
      });

    expect(res.status).toBe(403);
  });

  it("7. Rejects User Alpha from deleting transaction (DELETE /api/transactions/:id) with 403", async () => {
    const res = await request(app)
      .delete(`/api/transactions/${userATx._id}`)
      .set("Authorization", `Bearer ${userA.token}`)
      .set("X-CSRF-Token", csrf.token)
      .set("Cookie", csrf.cookie);

    expect(res.status).toBe(403);
  });

  it("8. Allows Admin to view all transactions and update transaction status", async () => {
    const getRes = await request(app)
      .get("/api/transactions")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(getRes.status).toBe(200);

    const putRes = await request(app)
      .put(`/api/transactions/${userATx._id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .set("X-CSRF-Token", csrf.token)
      .set("Cookie", csrf.cookie)
      .send({
        notes: "Audited by admin",
      });

    expect(putRes.status).toBe(200);
    expect(putRes.body.data.notes).toBe("Audited by admin");
  });

  it("9. User Alpha can GET their own transaction by ID, but is denied for User Beta's transaction", async () => {
    const ownRes = await request(app)
      .get(`/api/transactions/${userATx._id}`)
      .set("Authorization", `Bearer ${userA.token}`);

    expect(ownRes.status).toBe(200);
    expect(ownRes.body.data.userEmail).toBe("user.alpha@test.com");

    const otherRes = await request(app)
      .get(`/api/transactions/${userBTx._id}`)
      .set("Authorization", `Bearer ${userA.token}`);

    expect(otherRes.status).toBe(403);
    expect(otherRes.body.error).toMatch(/You do not own this transaction/i);
  });
});

