const mongoose = require("mongoose");
const User = require("../../../src/modules/users/models/user");

describe("User Model Unit Tests", () => {
  it("should validate a valid user model instance", () => {
    const validUserData = {
      name: "John Doe",
      email: "john@example.com",
      password: "HashedPassword123!",
      role: "user",
    };

    const user = new User(validUserData);
    const err = user.validateSync();
    expect(err).toBeUndefined();
  });

  it("should fail validation when name is missing", () => {
    const user = new User({
      email: "john@example.com",
      password: "HashedPassword123!",
    });

    const err = user.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.name).toBeDefined();
  });

  it("should fail validation when email is missing", () => {
    const user = new User({
      name: "John Doe",
      password: "HashedPassword123!",
    });

    const err = user.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.email).toBeDefined();
  });

  it("should default role to 'user'", () => {
    const user = new User({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "HashedPassword123!",
    });

    expect(user.role).toBe("user");
  });

  it("should reject invalid role enum", () => {
    const user = new User({
      name: "Invalid Role User",
      email: "invalid@example.com",
      password: "HashedPassword123!",
      role: "superadmin",
    });

    const err = user.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.role).toBeDefined();
  });

  it("should require password when isNewUser is false or not set", () => {
    const user = new User({
      name: "No Password User",
      email: "nopass@example.com",
      isNewUser: false,
    });

    const err = user.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.password).toBeDefined();
  });
});
