/**
 * Unit Regression Test Suite: Scroll Restoration & Layout Navigation
 *
 * Verifies the scroll state machine contract:
 * 1. PUSH / New Route navigation resets document scroll to (0, 0).
 * 2. Search-to-product navigation starts at top.
 * 3. Browser Back/Forward (POP) restores previous history entry's saved coordinates.
 * 4. Query param updates on the same pathname preserve scroll position.
 * 5. Hash navigation targets the specific anchor element.
 * 6. Asynchronous height expansion handles deferred scroll restoration.
 */

class ScrollRestorationController {
  constructor(windowMock, documentMock, sessionStorageMock) {
    this.window = windowMock;
    this.document = documentMock;
    this.sessionStorage = sessionStorageMock;
    this.positions = new Map();
    this.activeKey = "default";
    this.prevPathname = "/";
  }

  recordScroll(key, x, y) {
    this.positions.set(key, { x, y });
    this.sessionStorage.setItem(`auctionx_scroll_${key}`, JSON.stringify({ x, y }));
  }

  handleRouteChange({ pathname, search, hash, key, navigationType }) {
    const isPop = navigationType === "POP";
    const isSamePath = this.prevPathname === pathname;
    this.prevPathname = pathname;
    this.activeKey = key;

    // 1. Hash scrolling
    if (hash) {
      const targetId = hash.slice(1);
      const element = this.document.getElementById(targetId);
      if (element) {
        element.scrollIntoView();
        return { action: "SCROLLED_TO_HASH", targetId };
      }
    }

    // 2. Query param changes on same pathname
    if (isSamePath && !isPop) {
      return { action: "PRESERVED_SCROLL", x: this.window.scrollX, y: this.window.scrollY };
    }

    // 3. POP (Browser Back/Forward)
    if (isPop) {
      let saved = this.positions.get(key);
      if (!saved) {
        const stored = this.sessionStorage.getItem(`auctionx_scroll_${key}`);
        if (stored) saved = JSON.parse(stored);
      }

      if (saved && typeof saved.y === "number" && saved.y > 0) {
        const targetX = saved.x || 0;
        const targetY = saved.y;
        const maxScrollY = Math.max(
          this.document.documentElement.scrollHeight - this.window.innerHeight,
          0
        );

        if (maxScrollY >= targetY) {
          this.window.scrollTo(targetX, targetY);
          return { action: "RESTORED_IMMEDIATE", x: targetX, y: targetY };
        } else {
          this.window.scrollTo(targetX, maxScrollY);
          return { action: "DEFERRED_ASYNC_EXPANSION", x: targetX, y: targetY, currentY: maxScrollY };
        }
      }
    }

    // 4. Default PUSH / new page
    this.window.scrollTo(0, 0);
    this.document.documentElement.scrollTop = 0;
    this.document.body.scrollTop = 0;
    return { action: "RESET_TO_TOP", x: 0, y: 0 };
  }
}

describe("Scroll Restoration & Layout Navigation Suite", () => {
  let windowMock;
  let documentMock;
  let sessionStorageMock;
  let storageStore;
  let controller;

  beforeEach(() => {
    storageStore = {};
    sessionStorageMock = {
      getItem: jest.fn((k) => storageStore[k] || null),
      setItem: jest.fn((k, v) => { storageStore[k] = String(v); }),
      removeItem: jest.fn((k) => { delete storageStore[k]; }),
    };

    windowMock = {
      scrollX: 0,
      scrollY: 0,
      innerHeight: 800,
      scrollTo: jest.fn((x, y) => {
        windowMock.scrollX = x;
        windowMock.scrollY = y;
      }),
    };

    documentMock = {
      documentElement: { scrollHeight: 3000, scrollTop: 0 },
      body: { scrollTop: 0 },
      getElementById: jest.fn((id) => (id === "specs" ? { scrollIntoView: jest.fn() } : null)),
    };

    controller = new ScrollRestorationController(windowMock, documentMock, sessionStorageMock);
  });

  describe("1. New Page Navigation & Search-to-Product", () => {
    it("should reset scroll to (0, 0) on standard PUSH to a new page", () => {
      // Simulate user scrolled down 1200px on home page
      windowMock.scrollX = 0;
      windowMock.scrollY = 1200;

      const result = controller.handleRouteChange({
        pathname: "/scheduledbids",
        search: "",
        hash: "",
        key: "key_sched_1",
        navigationType: "PUSH",
      });

      expect(result.action).toBe("RESET_TO_TOP");
      expect(windowMock.scrollTo).toHaveBeenCalledWith(0, 0);
      expect(windowMock.scrollY).toBe(0);
    });

    it("should open product detail at (0, 0) when navigating from search results", () => {
      // User searched from navbar while scrolled at 850px
      windowMock.scrollY = 850;

      const result = controller.handleRouteChange({
        pathname: "/posts/prod_12345",
        search: "",
        hash: "",
        key: "key_search_post",
        navigationType: "PUSH",
      });

      expect(result.action).toBe("RESET_TO_TOP");
      expect(windowMock.scrollTo).toHaveBeenCalledWith(0, 0);
      expect(windowMock.scrollY).toBe(0);
    });

    it("should prevent scroll position leakage between unrelated routes", () => {
      windowMock.scrollY = 2400;

      controller.handleRouteChange({
        pathname: "/orders",
        search: "",
        hash: "",
        key: "key_orders",
        navigationType: "PUSH",
      });

      expect(windowMock.scrollY).toBe(0);
      expect(documentMock.documentElement.scrollTop).toBe(0);
    });
  });

  describe("2. Browser Back/Forward (POP) History Restoration", () => {
    it("should restore previous scroll coordinates when returning via Back button (POP)", () => {
      // Step 1: User visits /category/Electronics (key: key_cat_1) and scrolls to 1450px
      controller.handleRouteChange({
        pathname: "/category/Electronics",
        search: "",
        hash: "",
        key: "key_cat_1",
        navigationType: "PUSH",
      });
      controller.recordScroll("key_cat_1", 0, 1450);

      // Step 2: User clicks product card to view /product/prod_99 (key: key_prod_99)
      controller.handleRouteChange({
        pathname: "/product/prod_99",
        search: "",
        hash: "",
        key: "key_prod_99",
        navigationType: "PUSH",
      });
      expect(windowMock.scrollY).toBe(0); // Product detail opened at top

      // Step 3: User hits browser Back button -> POP to key_cat_1
      const popResult = controller.handleRouteChange({
        pathname: "/category/Electronics",
        search: "",
        hash: "",
        key: "key_cat_1",
        navigationType: "POP",
      });

      expect(popResult.action).toBe("RESTORED_IMMEDIATE");
      expect(popResult.y).toBe(1450);
      expect(windowMock.scrollTo).toHaveBeenCalledWith(0, 1450);
      expect(windowMock.scrollY).toBe(1450);
    });

    it("should restore from sessionStorage if in-memory position was lost during refresh", () => {
      // In-memory map is empty, but sessionStorage has saved coordinates
      storageStore["auctionx_scroll_key_refreshed"] = JSON.stringify({ x: 0, y: 920 });

      const popResult = controller.handleRouteChange({
        pathname: "/bid",
        search: "",
        hash: "",
        key: "key_refreshed",
        navigationType: "POP",
      });

      expect(popResult.action).toBe("RESTORED_IMMEDIATE");
      expect(popResult.y).toBe(920);
      expect(windowMock.scrollY).toBe(920);
    });

    it("should defer scroll if document height is not yet expanded by async data", () => {
      controller.recordScroll("key_deferred", 0, 2000);

      // Document is currently short (1000px, window 800px -> maxScrollY = 200px)
      documentMock.documentElement.scrollHeight = 1000;

      const popResult = controller.handleRouteChange({
        pathname: "/posts/prod_async",
        search: "",
        hash: "",
        key: "key_deferred",
        navigationType: "POP",
      });

      expect(popResult.action).toBe("DEFERRED_ASYNC_EXPANSION");
      expect(popResult.y).toBe(2000);
      expect(popResult.currentY).toBe(200); // Scrolled to current max
    });
  });

  describe("3. Query Params & Hash Navigation", () => {
    it("should preserve scroll position when query parameters change on same page", () => {
      controller.handleRouteChange({
        pathname: "/category/Watches",
        search: "",
        hash: "",
        key: "key_w1",
        navigationType: "PUSH",
      });

      windowMock.scrollY = 600;

      // User selects a filter dropdown which updates search param without changing page
      const result = controller.handleRouteChange({
        pathname: "/category/Watches",
        search: "?sort=price_desc",
        hash: "",
        key: "key_w2",
        navigationType: "REPLACE",
      });

      expect(result.action).toBe("PRESERVED_SCROLL");
      expect(windowMock.scrollY).toBe(600); // Unchanged!
    });

    it("should scroll to anchor element if hash is provided", () => {
      const result = controller.handleRouteChange({
        pathname: "/terms",
        search: "",
        hash: "#specs",
        key: "key_terms",
        navigationType: "PUSH",
      });

      expect(result.action).toBe("SCROLLED_TO_HASH");
      expect(result.targetId).toBe("specs");
    });
  });
});
