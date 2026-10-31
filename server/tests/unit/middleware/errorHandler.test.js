const errorHandler = require("../../../src/common/errors/errorHandler");

describe("errorHandler Unit Tests", () => {
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    mockReq = {
      method: "GET",
      originalUrl: "/api/test",
      ip: "127.0.0.1",
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFn = jest.fn();
  });

  it("should respond with custom statusCode and message when provided", () => {
    const customError = new Error("Resource not found");
    customError.statusCode = 404;

    errorHandler(customError, mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: "Resource not found",
    });
  });

  it("should default statusCode to 500 when not specified", () => {
    const genericError = new Error("Database crashed");

    errorHandler(genericError, mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Database crashed",
      })
    );
  });
});
