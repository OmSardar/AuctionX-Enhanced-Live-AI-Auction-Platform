const nodemailer = require("nodemailer");

describe("emailSender Unit Tests", () => {
  let sendMailMock;

  beforeEach(() => {
    sendMailMock = jest.fn().mockResolvedValue({ response: "250 OK" });
    jest.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: sendMailMock,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create transporter and send OTP email", async () => {
    const sendOtpEmail = require("../../../src/common/utilities/emailSender");

    await expect(sendOtpEmail("recipient@example.com", "123456")).resolves.not.toThrow();
  });
});
