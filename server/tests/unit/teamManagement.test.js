const teamController = require("../../src/modules/team/controllers/teamController");
const TeamMember = require("../../src/modules/team/models/TeamMember");

// Mock dependencies
jest.mock("../../src/modules/team/models/TeamMember");
jest.mock("../../src/common/utilities/cloudinaryConfig", () => ({
  deleteFromCloudinary: jest.fn().mockResolvedValue({ result: "ok" }),
}));

describe("Team Management Controller & Security Unit Tests", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe("GET /api/team (Public Active Team Members)", () => {
    test("returns only active members sorted deterministically", async () => {
      const mockMembers = [
        {
          _id: "1",
          name: "Kunal Sarkar",
          role: "Lead Developer / Technical Strategist",
          bio: "Passionate Graphic & Branding Designer...",
          imageUrl: "/kunal.jpg",
          socialLinks: { linkedin: "https://linkedin.com/in/kunal" },
          displayOrder: 0,
        },
        {
          _id: "2",
          name: "Om Sardar",
          role: "Lead Full-Stack Developer",
          bio: "Passionate engineer with deep proficiency...",
          imageUrl: "/om.jpg",
          socialLinks: { linkedin: "https://linkedin.com/in/om" },
          displayOrder: 1,
        },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockMembers),
      };
      TeamMember.find.mockReturnValue(mockQuery);

      req = {};
      await teamController.getActiveTeamMembers(req, res);

      expect(TeamMember.find).toHaveBeenCalledWith({ isActive: true });
      expect(mockQuery.sort).toHaveBeenCalledWith({ displayOrder: 1, createdAt: 1 });
      expect(mockQuery.select).toHaveBeenCalledWith(
        "name role bio imageUrl socialLinks displayOrder createdAt"
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: mockMembers,
      });
    });

    test("handles database query failures gracefully without leaking internals", async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error("Database connection timed out")),
      };
      TeamMember.find.mockReturnValue(mockQuery);

      req = {};
      await teamController.getActiveTeamMembers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch team members",
      });
    });
  });

  describe("POST /api/team (Create Team Member Validation & Sanitization)", () => {
    test("rejects request if name is missing or too short", async () => {
      req = {
        body: {
          name: "A",
          role: "Engineer",
          bio: "This is a valid bio description with more than 10 characters.",
          imageUrl: "https://example.com/avatar.jpg",
        },
      };

      await teamController.createTeamMember(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/Name is required/i),
        })
      );
    });

    test("rejects request if bio is shorter than 10 characters", async () => {
      req = {
        body: {
          name: "Valid Name",
          role: "Valid Role",
          bio: "Too short",
          imageUrl: "https://example.com/avatar.jpg",
        },
      };

      await teamController.createTeamMember(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/Bio is required/i),
        })
      );
    });

    test("rejects dangerous javascript: URLs in social links", async () => {
      req = {
        body: {
          name: "Valid Name",
          role: "Valid Role",
          bio: "This is a completely valid team member description.",
          imageUrl: "https://example.com/avatar.jpg",
          socialLinks: {
            linkedin: "javascript:alert('xss')",
          },
        },
      };

      await teamController.createTeamMember(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid LinkedIn URL",
      });
    });

    test("sanitizes HTML tags from member name and bio", async () => {
      req = {
        body: {
          name: "Test <script>alert(1)</script> User",
          role: "Lead Architect",
          bio: "Safe <b>bold</b> text that contains <img src=x onerror=alert(1)> tags to strip.",
          imageUrl: "https://example.com/avatar.jpg",
        },
      };

      const mockSave = jest.fn().mockResolvedValue({});
      TeamMember.mockImplementation((data) => ({
        ...data,
        save: mockSave,
      }));
      TeamMember.findOne = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ displayOrder: 2 }),
        }),
      });

      await teamController.createTeamMember(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockSave).toHaveBeenCalled();
      // Verify sanitized content
      const savedInstance = TeamMember.mock.calls[0][0];
      expect(savedInstance.name).not.toContain("<script>");
      expect(savedInstance.bio).not.toContain("<img");
      expect(savedInstance.bio).not.toContain("<b>");
    });
  });

  describe("PUT /api/team/reorder", () => {
    test("reorders members based on array of IDs", async () => {
      TeamMember.bulkWrite = jest.fn().mockResolvedValue({});
      TeamMember.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: "id2", displayOrder: 0 },
            { _id: "id1", displayOrder: 1 },
          ]),
        }),
      });

      req = {
        body: {
          orderIds: ["id2", "id1"],
        },
      };

      await teamController.reorderTeamMembers(req, res);

      expect(TeamMember.bulkWrite).toHaveBeenCalledWith([
        { updateOne: { filter: { _id: "id2" }, update: { $set: { displayOrder: 0 } } } },
        { updateOne: { filter: { _id: "id1" }, update: { $set: { displayOrder: 1 } } } },
      ]);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Team members reordered successfully",
        })
      );
    });

    test("rejects invalid reorder payload", async () => {
      req = {
        body: {
          invalidKey: "wrong",
        },
      };

      await teamController.reorderTeamMembers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/Invalid reorder payload/i),
        })
      );
    });
  });

  describe("DELETE /api/team/:id", () => {
    test("deletes member and cleans up Cloudinary image if present", async () => {
      const { deleteFromCloudinary } = require("../../src/common/utilities/cloudinaryConfig");
      const mockMember = {
        _id: "mem1",
        name: "Test",
        imagePublicId: "team/test_123",
      };
      TeamMember.findById = jest.fn().mockResolvedValue(mockMember);
      TeamMember.findByIdAndDelete = jest.fn().mockResolvedValue({});

      req = { params: { id: "mem1" } };
      await teamController.deleteTeamMember(req, res);

      expect(deleteFromCloudinary).toHaveBeenCalledWith("team/test_123");
      expect(TeamMember.findByIdAndDelete).toHaveBeenCalledWith("mem1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Team member deleted successfully",
      });
    });

    test("returns 404 if member does not exist", async () => {
      TeamMember.findById = jest.fn().mockResolvedValue(null);

      req = { params: { id: "nonexistent" } };
      await teamController.deleteTeamMember(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Team member not found",
      });
    });
  });
});
