const cloudinary = require("cloudinary").v2;
const { deleteFromCloudinary } = require("../../../src/common/utilities/cloudinaryConfig");

jest.mock("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

describe("F-08 Cloudinary Cleanup Bounded Retry Unit Tests", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.useRealTimers();
  });

  it("1. succeeds on first attempt without retrying", async () => {
    cloudinary.uploader.destroy.mockResolvedValueOnce({ result: "ok" });

    const result = await deleteFromCloudinary("sample_avatar_1", { initialDelayMs: 1 });

    expect(result).toEqual({ result: "ok" });
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(1);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("sample_avatar_1", {
      resource_type: "image",
    });
  });

  it("2. treats 'not found' provider response as successful cleanup", async () => {
    cloudinary.uploader.destroy.mockResolvedValueOnce({ result: "not found" });

    const result = await deleteFromCloudinary("already_deleted_avatar", { initialDelayMs: 1 });

    expect(result).toEqual({ result: "not found" });
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(1);
  });

  it("3. retries and succeeds after a transient network failure on attempt 1", async () => {
    cloudinary.uploader.destroy
      .mockRejectedValueOnce(new Error("ETIMEDOUT: Connection reset by peer"))
      .mockResolvedValueOnce({ result: "ok" });

    const result = await deleteFromCloudinary("transient_avatar_2", { initialDelayMs: 5 });

    expect(result).toEqual({ result: "ok" });
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(2);
  });

  it("4. retries and succeeds on third attempt after two transient failures", async () => {
    cloudinary.uploader.destroy
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("Socket closed unexpectedly"))
      .mockResolvedValueOnce({ result: "ok" });

    const result = await deleteFromCloudinary("transient_avatar_3", { initialDelayMs: 5 });

    expect(result).toEqual({ result: "ok" });
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(3);
  });

  it("5. stops after 3 failed attempts (no unbounded retrying) and throws last error", async () => {
    cloudinary.uploader.destroy
      .mockRejectedValueOnce(new Error("Network glitch 1"))
      .mockRejectedValueOnce(new Error("Network glitch 2"))
      .mockRejectedValueOnce(new Error("Network glitch 3"));

    await expect(
      deleteFromCloudinary("exhausted_avatar_4", { initialDelayMs: 5 })
    ).rejects.toThrow("Network glitch 3");

    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(3);
  });

  it("6. emits safe structured log with CLOUDINARY_CLEANUP_FAILURE event on exhaustion", async () => {
    cloudinary.uploader.destroy.mockRejectedValue(new Error("Cloud service unreachable"));

    await expect(
      deleteFromCloudinary("unreachable_asset_5", { initialDelayMs: 1 })
    ).rejects.toThrow("Cloud service unreachable");

    // Verify console.error was called with the structured payload
    expect(consoleErrorSpy).toHaveBeenCalled();
    const errorCalls = consoleErrorSpy.mock.calls.map((call) => call.join(" "));
    const failureLog = errorCalls.find((msg) => msg.includes("CLOUDINARY_CLEANUP_FAILURE"));
    expect(failureLog).toBeDefined();

    // Verify payload contents and lack of secrets
    expect(failureLog).toContain("unreachable_asset_5");
    expect(failureLog).toContain('"attempts":3');
    expect(failureLog).not.toMatch(/api[_-]?secret/i);
    expect(failureLog).not.toMatch(/api[_-]?key/i);
    expect(failureLog).not.toMatch(/password/i);
    expect(failureLog).not.toMatch(/token/i);
  });

  it("7. correctly enforces backoff delays using fake timers", async () => {
    jest.useFakeTimers();

    cloudinary.uploader.destroy
      .mockRejectedValueOnce(new Error("Fail 1"))
      .mockRejectedValueOnce(new Error("Fail 2"))
      .mockResolvedValueOnce({ result: "ok" });

    const cleanupPromise = deleteFromCloudinary("timed_backoff_asset", {
      initialDelayMs: 500,
      backoffMultiplier: 3,
    });

    // Attempt 1 fails immediately
    await jest.advanceTimersByTimeAsync(0);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(1);

    // Wait 500ms for Attempt 2
    await jest.advanceTimersByTimeAsync(500);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(2);

    // Wait 1500ms (500 * 3) for Attempt 3
    await jest.advanceTimersByTimeAsync(1500);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(3);

    const result = await cleanupPromise;
    expect(result).toEqual({ result: "ok" });
  });

  it("8. treats non-ok response results as retryable failure", async () => {
    cloudinary.uploader.destroy
      .mockResolvedValueOnce({ result: "error", message: "Internal server error" })
      .mockResolvedValueOnce({ result: "ok" });

    const result = await deleteFromCloudinary("non_ok_result_asset", { initialDelayMs: 5 });

    expect(result).toEqual({ result: "ok" });
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(2);
  });
});
