const mockSendOtpEmail = jest.fn().mockResolvedValue({
  messageId: "mock-message-id-12345",
});

module.exports = {
  mockSendOtpEmail,
};
