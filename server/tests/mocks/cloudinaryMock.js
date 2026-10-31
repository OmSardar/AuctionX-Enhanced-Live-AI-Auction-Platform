const mockCloudinary = {
  uploader: {
    upload: jest.fn().mockResolvedValue({
      secure_url: "https://res.cloudinary.com/test/image/upload/v12345/test.jpg",
      public_id: "products/test_image_123",
    }),
    destroy: jest.fn().mockResolvedValue({ result: "ok" }),
  },
  config: jest.fn(),
};

module.exports = mockCloudinary;
