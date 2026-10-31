const request = require("supertest");
const { app } = require("../../../server");
const { createTestUser } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const ChatHistory = require("../../../src/modules/chat/models/ChatHistory");

describe("Chat Routes Integration Tests (/api/chat)", () => {
  let testUser;
  let testToken;
  let csrf;

  beforeAll(async () => {
    const userRes = await createTestUser({
      name: "Chat Test User",
      email: `chattest_${Date.now()}@example.com`,
    });
    testUser = userRes.user;
    testToken = userRes.token;
  });

  beforeEach(() => {
    csrf = createCsrfCredentials();
  });

  afterAll(async () => {
    if (testUser) {
      await ChatHistory.deleteMany({ userId: testUser._id });
    }
  });

  describe("Legacy FAQ Search (/api/search-faq)", () => {
    it("should allow unauthenticated access and return safe FAQ results without reaching billable AI", async () => {
      const res = await request(app).get("/api/search-faq?query=bidding");

      expect(res.statusCode).toBe(200);
      expect(res.body.answer).toBeDefined();
      expect(res.body.confidence).toBeDefined();
      expect(["knowledge_base", "faq_fallback"]).toContain(res.body.source);
    });

    it("should return 400 when query is missing", async () => {
      const res = await request(app).get("/api/search-faq");

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe("Query required");
    });
  });

  describe("GET /api/chat/topics", () => {
    it("should return suggested topics without requiring authentication", async () => {
      const res = await request(app).get("/api/chat/topics");

      expect(res.statusCode).toBe(200);
      expect(res.body.topics).toBeDefined();
      expect(Array.isArray(res.body.topics)).toBe(true);
      expect(res.body.topics.length).toBeGreaterThan(0);
      expect(res.body.topics[0]).toHaveProperty("id");
      expect(res.body.topics[0]).toHaveProperty("label");
      expect(res.body.topics[0]).toHaveProperty("query");
    });
  });

  describe("Authentication Enforcement on Chat Routes", () => {
    it("should reject POST /api/chat/message when unauthenticated", async () => {
      const res = await request(app)
        .post("/api/chat/message")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ message: "Hello" });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/Unauthorized/i);
    });

    it("should reject GET /api/chat/history when unauthenticated", async () => {
      const res = await request(app).get("/api/chat/history");
      expect(res.statusCode).toBe(401);
    });

    it("should reject DELETE /api/chat/history when unauthenticated", async () => {
      const res = await request(app)
        .delete("/api/chat/history")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue);

      expect(res.statusCode).toBe(401);
    });

    it("should reject PATCH /api/chat/feedback when unauthenticated", async () => {
      const res = await request(app)
        .patch("/api/chat/feedback")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ conversationId: "conv-1", messageIndex: 0, feedback: "positive" });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("Authenticated Chat Operations", () => {
    let createdConversationId;

    it("should successfully process a chat message for authenticated user", async () => {
      const res = await request(app)
        .post("/api/chat/message")
        .set("Cookie", [csrf.cookie, `token=${testToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .set("Authorization", `Bearer ${testToken}`)
        .send({ message: "How does bidding work on AuctionX?" });

      expect(res.statusCode).toBe(200);
      expect(res.body.reply).toBeDefined();
      expect(res.body.conversationId).toBeDefined();
      expect(res.body.actions).toBeDefined();
      expect(Array.isArray(res.body.actions)).toBe(true);

      createdConversationId = res.body.conversationId;
    });

    it("should retrieve conversation history for authenticated user", async () => {
      const res = await request(app)
        .get("/api/chat/history")
        .set("Cookie", [`token=${testToken}`])
        .set("Authorization", `Bearer ${testToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.conversations).toBeDefined();
      expect(Array.isArray(res.body.conversations)).toBe(true);
      expect(res.body.conversations.length).toBeGreaterThan(0);
      expect(res.body.conversations[0].conversationId).toBe(createdConversationId);
    });

    it("should retrieve full conversation details by conversationId", async () => {
      const res = await request(app)
        .get(`/api/chat/history/${createdConversationId}`)
        .set("Cookie", [`token=${testToken}`])
        .set("Authorization", `Bearer ${testToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.conversationId).toBe(createdConversationId);
      expect(res.body.messages.length).toBeGreaterThanOrEqual(2);
      expect(res.body.messages[0].role).toBe("user");
      expect(res.body.messages[1].role).toBe("assistant");
    });

    it("should submit feedback for an assistant message", async () => {
      const res = await request(app)
        .patch("/api/chat/feedback")
        .set("Cookie", [csrf.cookie, `token=${testToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .set("Authorization", `Bearer ${testToken}`)
        .send({
          conversationId: createdConversationId,
          messageIndex: 1,
          feedback: "positive",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify persistence
      const conv = await ChatHistory.findOne({ conversationId: createdConversationId });
      expect(conv.messages[1].feedback).toBe("positive");
    });

    it("should deterministically refuse out-of-scope non-AuctionX queries without calling provider", async () => {
      const res = await request(app)
        .post("/api/chat/message")
        .set("Cookie", [csrf.cookie, `token=${testToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .set("Authorization", `Bearer ${testToken}`)
        .send({ message: "Can you write a 500 word essay on the French Revolution?" });

      expect(res.statusCode).toBe(200);
      expect(res.body.source).toBe("pre_filter_refusal");
      expect(res.body.reply).toContain("AuctionX");
    });

    it("should enforce conversation turn limit when 50 turns are reached", async () => {
      const maxedConvId = `conv-maxed-${Date.now()}`;
      const dummyMessages = [];
      for (let i = 0; i < 50; i++) {
        dummyMessages.push({ role: "user", content: `User question ${i}` });
        dummyMessages.push({ role: "assistant", content: `Bot answer ${i}` });
      }

      await ChatHistory.create({
        conversationId: maxedConvId,
        userId: testUser._id,
        messages: dummyMessages,
      });

      const res = await request(app)
        .post("/api/chat/message")
        .set("Cookie", [csrf.cookie, `token=${testToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .set("Authorization", `Bearer ${testToken}`)
        .send({
          conversationId: maxedConvId,
          message: "One more question please",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("maximum of 50 turns");
    });

    it("should reject message exceeding maximum length (>500 chars)", async () => {
      const longMessage = "a".repeat(501);
      const res = await request(app)
        .post("/api/chat/message")
        .set("Cookie", [csrf.cookie, `token=${testToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .set("Authorization", `Bearer ${testToken}`)
        .send({ message: longMessage });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("Maximum 500 characters allowed");
    });

    it("should clear all conversation history for the user", async () => {
      const res = await request(app)
        .delete("/api/chat/history")
        .set("Cookie", [csrf.cookie, `token=${testToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .set("Authorization", `Bearer ${testToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const afterHistory = await ChatHistory.find({ userId: testUser._id });
      expect(afterHistory.length).toBe(0);
    });
  });
});
