const {
  checkRateLimit,
  recordMessage,
  getUsageStats,
  acquireRateLimitSlot,
  releaseRateLimitSlot,
  recordProviderSuccess,
  recordProviderFailure,
  resetRateLimiter,
  MAX_PER_MINUTE,
  MAX_PER_DAY,
  MAX_INPUT_LENGTH,
  MAX_CONVERSATION_TURNS,
  GLOBAL_DAILY_BUDGET,
} = require("../../src/modules/chat/services/chatRateLimiter");

const {
  searchKnowledgeBase,
  isAllowedNavigation,
  ALLOWED_NAVIGATION_PATHS,
  NAVIGATION_ACTIONS,
} = require("../../src/modules/chat/services/knowledgeBase");

const {
  buildGeminiPayload,
  parseActions,
  isClearlyOutOfScope,
  SYSTEM_PROMPT,
} = require("../../src/modules/chat/services/chatService");

describe("Chat Support System Unit Tests", () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  // ─── 1. RATE LIMITER & CONCURRENCY TESTS ───
  describe("chatRateLimiter", () => {
    const testUserId = "test-user-rate-limit-123";

    test("should reject empty or missing messages", () => {
      expect(checkRateLimit(testUserId, null)).toEqual({
        error: "Message is required.",
      });
      expect(checkRateLimit(testUserId, "")).toEqual({
        error: "Message is required.",
      });
      expect(checkRateLimit(testUserId, "   ")).toEqual({
        error: "Message cannot be empty.",
      });
    });

    test("should reject messages exceeding MAX_INPUT_LENGTH characters", () => {
      const longMessage = "a".repeat(MAX_INPUT_LENGTH + 1);
      const res = checkRateLimit(testUserId, longMessage);
      expect(res).not.toBeNull();
      expect(res.error).toContain(`Maximum ${MAX_INPUT_LENGTH} characters allowed`);
    });

    test("should allow valid messages under MAX_INPUT_LENGTH", () => {
      const validMessage = "How do I place a bid on an active auction?";
      expect(checkRateLimit("fresh-user-1", validMessage, 0)).toBeNull();
    });

    test("should reject when conversation turn limit (50 turns) is reached", () => {
      const res = checkRateLimit(
        "fresh-user-2",
        "Hello",
        MAX_CONVERSATION_TURNS
      );
      expect(res).not.toBeNull();
      expect(res.error).toContain(
        `maximum of ${MAX_CONVERSATION_TURNS} turns`
      );
    });

    test("should enforce MAX_PER_MINUTE rate limit", () => {
      const burstUser = "burst-user-999";
      for (let i = 0; i < MAX_PER_MINUTE; i++) {
        expect(checkRateLimit(burstUser, "Valid message", 0)).toBeNull();
        recordMessage(burstUser);
      }

      // Next message should exceed rate limit
      const blocked = checkRateLimit(burstUser, "Another message", 0);
      expect(blocked).not.toBeNull();
      expect(blocked.error).toContain("Rate limit exceeded");
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    });

    test("acquireRateLimitSlot should synchronously reserve slots and prevent concurrency race", () => {
      const concurrentUser = "concurrent-user-456";

      // Acquire up to MAX_PER_MINUTE synchronously
      const reservations = [];
      for (let i = 0; i < MAX_PER_MINUTE; i++) {
        const slot = acquireRateLimitSlot(concurrentUser, `Message #${i}`, 0);
        expect(slot.allowed).toBe(true);
        expect(slot.reservation).toBeDefined();
        reservations.push(slot.reservation);
      }

      // Immediate 21st attempt must be blocked synchronously without race condition
      const overflowSlot = acquireRateLimitSlot(concurrentUser, "Message #21", 0);
      expect(overflowSlot.allowed).toBe(false);
      expect(overflowSlot.error).toContain("Rate limit exceeded");

      // Releasing a reservation restores capacity
      releaseRateLimitSlot(reservations.pop());
      const retrySlot = acquireRateLimitSlot(concurrentUser, "Retry message", 0);
      expect(retrySlot.allowed).toBe(true);
      expect(retrySlot.reservation).toBeDefined();
    });

    test("acquireRateLimitSlot should fail closed when global budget is exhausted", () => {
      const budgetUser = "budget-user-789";

      // Simulate global budget saturation
      for (let i = 0; i < GLOBAL_DAILY_BUDGET; i++) {
        const slot = acquireRateLimitSlot(`bot-user-${i}`, "Ping", 0);
        expect(slot.allowed).toBe(true);
      }

      // Next call from any user should be blocked by global daily budget
      const blockedSlot = acquireRateLimitSlot(budgetUser, "Valid query", 0);
      expect(blockedSlot.allowed).toBe(false);
      expect(blockedSlot.isBudgetExceeded).toBe(true);
      expect(blockedSlot.error).toContain("Platform daily chat capacity reached");
    });

    test("acquireRateLimitSlot should trip circuit breaker on quota error (429)", () => {
      const testUser = "circuit-test-user";

      // Verify normal slot acquisition works initially
      const initialSlot = acquireRateLimitSlot(testUser, "Test message", 0);
      expect(initialSlot.allowed).toBe(true);

      // Simulate provider reporting quota error (HTTP 429)
      recordProviderFailure(true);

      // Subsequent requests must be immediately blocked by circuit breaker
      const blockedSlot = acquireRateLimitSlot(testUser, "Next message", 0);
      expect(blockedSlot.allowed).toBe(false);
      expect(blockedSlot.isCircuitOpen).toBe(true);
      expect(blockedSlot.error).toContain("AI generation service is temporarily in cooldown");

      // Provider success resets circuit breaker
      recordProviderSuccess();
      const recoveredSlot = acquireRateLimitSlot(testUser, "Recovered message", 0);
      expect(recoveredSlot.allowed).toBe(true);
    });

    test("should track usage stats accurately", () => {
      const statsUser = "stats-user-100";
      recordMessage(statsUser);
      recordMessage(statsUser);

      const stats = getUsageStats(statsUser);
      expect(stats.minuteUsed).toBe(2);
      expect(stats.dayUsed).toBe(2);
      expect(stats.minuteLimit).toBe(MAX_PER_MINUTE);
      expect(stats.dayLimit).toBe(MAX_PER_DAY);
    });
  });

  // ─── 2. KNOWLEDGE BASE & NAVIGATION ROUTE TESTS ───
  describe("knowledgeBase and Navigation Routes", () => {
    test("should return relevant entries for bidding queries", () => {
      const results = searchKnowledgeBase("How do I bid on an auction?", 3);
      expect(results.length).toBeGreaterThan(0);
      const topics = results.map((r) => r.topic.toLowerCase());
      expect(topics.some((t) => t.includes("bid"))).toBe(true);
    });

    test("should return relevant entries for payment queries", () => {
      const results = searchKnowledgeBase("What payment methods are supported?", 3);
      expect(results.length).toBeGreaterThan(0);
      const content = results.map((r) => r.content.toLowerCase()).join(" ");
      expect(content).toContain("payment");
    });

    test("central NAVIGATION_ACTIONS must match verified frontend routes", () => {
      // Verified App.jsx router paths
      expect(NAVIGATION_ACTIONS.REGISTER.path).toBe("/login");
      expect(NAVIGATION_ACTIONS.PROFILE.path).toBe("/profile/myprofile");
      expect(NAVIGATION_ACTIONS.SETTINGS.path).toBe("/profilesettings");
      expect(NAVIGATION_ACTIONS.SELL_ITEM.path).toBe("/seller/dashboard/sell");
      expect(NAVIGATION_ACTIONS.MY_BIDS.path).toBe("/scheduledbids");

      // Verify all defined actions pass route allowlisting
      for (const actionKey of Object.keys(NAVIGATION_ACTIONS)) {
        const action = NAVIGATION_ACTIONS[actionKey];
        expect(isAllowedNavigation(action.path)).toBe(true);
      }
    });

    test("should validate allowlisted navigation paths", () => {
      expect(isAllowedNavigation("/profile/orders")).toBe(true);
      expect(isAllowedNavigation("/seller/dashboard")).toBe(true);
      expect(isAllowedNavigation("/about")).toBe(true);
      expect(isAllowedNavigation("/contact")).toBe(true);
      expect(isAllowedNavigation("/")).toBe(true);
      expect(isAllowedNavigation("/login")).toBe(true);
      expect(isAllowedNavigation("/profilesettings")).toBe(true);
      expect(isAllowedNavigation("/scheduledbids")).toBe(true);
      expect(isAllowedNavigation("/seller/dashboard/sell")).toBe(true);

      // Disallowed / untrusted paths
      expect(isAllowedNavigation("/admin/secrets")).toBe(false);
      expect(isAllowedNavigation("https://malicious-site.com")).toBe(false);
      expect(isAllowedNavigation("javascript:alert(1)")).toBe(false);
      expect(isAllowedNavigation("")).toBe(false);
      expect(isAllowedNavigation(null)).toBe(false);
    });
  });

  // ─── 3. CHAT SERVICE & OUT-OF-SCOPE FILTER TESTS ───
  describe("chatService and Domain Filtering", () => {
    test("isClearlyOutOfScope correctly rejects non-AuctionX general requests", () => {
      const outOfScopeQueries = [
        "Write a Python script to scrape a website",
        "Can you write a 500 word essay on the French Revolution?",
        "Give me a recipe for chocolate chip cookies",
        "Write a poem about the sunrise",
        "Fix this bug in my C++ binary search tree code",
        "Solve this math equation: 3x^2 + 5x - 8 = 0",
        "What is the capital of Australia?",
        "Explain quantum computing to a five year old",
      ];

      for (const query of outOfScopeQueries) {
        expect(isClearlyOutOfScope(query)).toBe(true);
      }
    });

    test("isClearlyOutOfScope allows legitimate AuctionX inquiries including technical ones", () => {
      const validAuctionXQueries = [
        "How do I place a bid on an active auction?",
        "Why did my bid fail with an API error?",
        "Is there an error code 400 when submitting a bid?",
        "What is the minimum bid increment for items?",
        "How do I sell my antique watch on AuctionX?",
        "My payment failed on the checkout screen, what should I do?",
        "Where can I find my scheduled bids in my profile?",
        "How does the wallet refund work if outbid?",
      ];

      for (const query of validAuctionXQueries) {
        expect(isClearlyOutOfScope(query)).toBe(false);
      }
    });

    test("SYSTEM_PROMPT specifies strict AuctionX domain restriction and verified routes", () => {
      expect(SYSTEM_PROMPT).toContain("AuctionX");
      expect(SYSTEM_PROMPT).toContain("ONLY answer questions about AuctionX");
      expect(SYSTEM_PROMPT).toContain("REFUSAL TEMPLATE");
      expect(SYSTEM_PROMPT).toContain("/login");
      expect(SYSTEM_PROMPT).toContain("/profile/myprofile");
      expect(SYSTEM_PROMPT).toContain("/profilesettings");
      expect(SYSTEM_PROMPT).toContain("/seller/dashboard/sell");
      expect(SYSTEM_PROMPT).toContain("/scheduledbids");
    });

    test("buildGeminiPayload formats prompt and context correctly", () => {
      const userMessage = "How do I view my won orders?";
      const knowledgeContext = [
        { topic: "Orders", content: "Go to My Orders page." },
      ];
      const conversationHistory = [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello! How can I help?" },
      ];
      const userContext = { name: "Alice", role: "buyer" };

      const payload = buildGeminiPayload(
        userMessage,
        knowledgeContext,
        conversationHistory,
        userContext
      );

      expect(payload).toBeDefined();
      expect(payload.contents).toBeDefined();
      expect(payload.contents.length).toBeGreaterThan(2);

      // System instruction as first user message
      expect(payload.contents[0].parts[0].text).toContain("AuctionX");
      expect(payload.contents[0].parts[0].text).toContain("Alice");
      expect(payload.contents[0].parts[0].text).toContain("buyer");

      // Last message is the current user query
      const lastContent = payload.contents[payload.contents.length - 1];
      expect(lastContent.role).toBe("user");
      expect(lastContent.parts[0].text).toBe(userMessage);
    });

    test("parseActions parses and validates navigation action blocks", () => {
      const botResponse =
        'You can view all your orders on the orders page.\n[ACTION:{"type":"navigate","path":"/profile/orders","label":"View My Orders"}]';

      const { cleanText, actions } = parseActions(botResponse);

      expect(cleanText).toBe("You can view all your orders on the orders page.");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({
        type: "navigate",
        path: "/profile/orders",
        label: "View My Orders",
      });
    });

    test("parseActions ignores unallowed or malicious action paths", () => {
      const maliciousResponse =
        'Click here: [ACTION:{"type":"navigate","path":"https://phishing.com","label":"Login"}] and [ACTION:{"type":"navigate","path":"/admin/database","label":"Admin"}]';

      const { cleanText, actions } = parseActions(maliciousResponse);

      expect(cleanText).toBe("Click here:  and");
      expect(actions).toHaveLength(0);
    });

    test("parseActions handles responses without actions cleanly", () => {
      const simpleResponse = "AuctionX bids require a minimum ₹50 increment.";
      const { cleanText, actions } = parseActions(simpleResponse);
      expect(cleanText).toBe(simpleResponse);
      expect(actions).toEqual([]);
    });
  });
});
