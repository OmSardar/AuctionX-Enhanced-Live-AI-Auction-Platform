import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { fetchCsrfToken } from "../../../../redux/slices/csrfSecuritySlice";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLinkedin, faGithub, faTwitter } from "@fortawesome/free-brands-svg-icons";
import { faEnvelope, faTrash, faEdit, faArrowUp, faArrowDown, faPlus, faCheck, faTimes } from "@fortawesome/free-solid-svg-icons";

const EMPTY_MEMBER = {
  name: "",
  role: "",
  bio: "",
  imageUrl: "",
  socialLinks: {
    linkedin: "",
    github: "",
    email: "",
    twitter: "",
  },
  displayOrder: 0,
  isActive: true,
};

export default function ManageTeamPage() {
  const dispatch = useDispatch();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_MEMBER);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState("");

  // Delete confirmation modal state
  const [deletingMember, setDeletingMember] = useState(null);

  // Load team members
  const fetchMembers = async () => {
    setLoading(true);
    try {
      const response = await axiosWithAuth.get("/team/admin");
      if (response.data?.success && Array.isArray(response.data.data)) {
        setMembers(response.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch team members:", err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to load team members from server.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    dispatch(fetchCsrfToken());
    fetchMembers();
  }, [dispatch]);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      ...EMPTY_MEMBER,
      displayOrder: members.length,
    });
    setSelectedFile(null);
    setFilePreview("");
    setIsModalOpen(true);
  };

  const openEditModal = (member) => {
    setEditingId(member._id);
    setFormData({
      name: member.name || "",
      role: member.role || "",
      bio: member.bio || "",
      imageUrl: member.imageUrl || "",
      socialLinks: {
        linkedin: member.socialLinks?.linkedin || "",
        github: member.socialLinks?.github || "",
        email: member.socialLinks?.email || "",
        twitter: member.socialLinks?.twitter || "",
      },
      displayOrder: member.displayOrder ?? 0,
      isActive: member.isActive ?? true,
    });
    setSelectedFile(null);
    setFilePreview(member.imageUrl || "");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setSelectedFile(null);
    setFilePreview("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: "error", text: "Selected file exceeds maximum size of 5MB." });
        return;
      }
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: "", type: "" });

    // Client-side validation
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setMessage({ type: "error", text: "Name must be at least 2 characters long." });
      return;
    }
    if (!formData.role.trim() || formData.role.trim().length < 2) {
      setMessage({ type: "error", text: "Role must be at least 2 characters long." });
      return;
    }
    if (!formData.bio.trim() || formData.bio.trim().length < 10) {
      setMessage({ type: "error", text: "Bio must be at least 10 characters long." });
      return;
    }
    if (!selectedFile && !formData.imageUrl.trim()) {
      setMessage({ type: "error", text: "Please provide a photograph or image URL for this member." });
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append("name", formData.name.trim());
      payload.append("role", formData.role.trim());
      payload.append("bio", formData.bio.trim());
      payload.append("displayOrder", formData.displayOrder);
      payload.append("isActive", formData.isActive);

      if (selectedFile) {
        payload.append("image", selectedFile);
      } else if (formData.imageUrl.trim()) {
        payload.append("imageUrl", formData.imageUrl.trim());
      }

      payload.append("socialLinks[linkedin]", formData.socialLinks.linkedin.trim());
      payload.append("socialLinks[github]", formData.socialLinks.github.trim());
      payload.append("socialLinks[email]", formData.socialLinks.email.trim());
      payload.append("socialLinks[twitter]", formData.socialLinks.twitter.trim());

      let res;
      if (editingId) {
        res = await axiosWithAuth.put(`/team/${editingId}`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage({ type: "success", text: "Team member updated successfully." });
      } else {
        res = await axiosWithAuth.post("/team", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage({ type: "success", text: "Team member created successfully." });
      }

      closeModal();
      await fetchMembers();
    } catch (err) {
      console.error("Failed to save team member:", err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to save team member.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id) => {
    try {
      const res = await axiosWithAuth.patch(`/team/${id}/toggle-active`);
      if (res.data?.success) {
        setMembers((prev) =>
          prev.map((m) => (m._id === id ? { ...m, isActive: !m.isActive } : m))
        );
        setMessage({
          type: "success",
          text: res.data.message || "Visibility updated.",
        });
      }
    } catch (err) {
      console.error("Failed to toggle visibility:", err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to toggle visibility.",
      });
    }
  };

  const handleDeleteMember = async () => {
    if (!deletingMember) return;
    try {
      await axiosWithAuth.delete(`/team/${deletingMember._id}`);
      setMessage({ type: "success", text: `Removed ${deletingMember.name} successfully.` });
      setDeletingMember(null);
      await fetchMembers();
    } catch (err) {
      console.error("Failed to delete member:", err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to delete team member.",
      });
    }
  };

  const handleMoveOrder = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= members.length) return;

    const newMembers = [...members];
    const [moved] = newMembers.splice(index, 1);
    newMembers.splice(targetIndex, 0, moved);

    const orderIds = newMembers.map((m) => m._id);
    setMembers(newMembers);

    try {
      await axiosWithAuth.put("/team/reorder", { orderIds });
      setMessage({ type: "success", text: "Display order updated." });
    } catch (err) {
      console.error("Failed to reorder:", err);
      setMessage({ type: "error", text: "Failed to persist new order." });
      fetchMembers();
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert / Toast Messages */}
      {message.text && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between border ${
            message.type === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300"
              : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
          }`}
          role="alert"
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage({ text: "", type: "" })}
            className="text-muted hover:text-foreground ml-4"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface border border-border-subtle p-6 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-xl font-bold font-display text-foreground">
            About Us Team Management
          </h2>
          <p className="text-sm text-foreground-secondary mt-1">
            Manage public team profiles, biographies, display priority, and visibility on the About page.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-action-primary hover:bg-action-primary-hover text-white text-sm font-semibold shadow-warm-xs transition-all duration-200 cursor-pointer shrink-0"
        >
          <FontAwesomeIcon icon={faPlus} />
          Add Member
        </button>
      </div>

      {/* Team Member Cards / List */}
      {loading ? (
        <div className="text-center py-16 text-foreground-secondary">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-action-primary mb-3"></div>
          <p>Loading team members...</p>
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-border-subtle rounded-2xl text-foreground-secondary">
          <p className="text-base font-semibold">No team members found.</p>
          <p className="text-sm mt-1">Click "Add Member" to create your first team profile.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.map((member, index) => (
            <div
              key={member._id}
              className={`bg-surface border rounded-2xl p-6 flex flex-col justify-between shadow-xs transition-all duration-200 ${
                member.isActive
                  ? "border-border-subtle hover:border-action-primary/40"
                  : "border-border-subtle/40 opacity-70 bg-surface/50"
              }`}
            >
              <div>
                {/* Card Top: Order & Status */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-surface-subtle text-foreground-secondary border border-border-subtle">
                    #{index + 1} &bull; Order {member.displayOrder ?? index}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(member._id)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                      member.isActive
                        ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
                        : "bg-gray-500/10 border-gray-500/30 text-gray-500"
                    }`}
                  >
                    {member.isActive ? "● Active / Visible" : "○ Hidden"}
                  </button>
                </div>

                {/* Avatar & Core Info */}
                <div className="flex items-center gap-4 mb-4">
                  <img
                    src={member.imageUrl || "/assets/images/FooterElements/AboutUs/OmSardar.jpg"}
                    alt={member.name}
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-action-primary/20 shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-foreground truncate">
                      {member.name}
                    </h3>
                    <p className="text-xs font-semibold text-action-primary truncate">
                      {member.role}
                    </p>
                  </div>
                </div>

                {/* Bio Snippet */}
                <p className="text-xs text-foreground-secondary line-clamp-3 mb-4 leading-relaxed">
                  {member.bio}
                </p>

                {/* Social Badges */}
                <div className="flex items-center gap-2 pt-3 border-t border-border-subtle text-xs text-foreground-secondary">
                  {member.socialLinks?.linkedin && (
                    <span title="LinkedIn linked" className="text-blue-500"><FontAwesomeIcon icon={faLinkedin} /></span>
                  )}
                  {member.socialLinks?.github && (
                    <span title="GitHub linked"><FontAwesomeIcon icon={faGithub} /></span>
                  )}
                  {member.socialLinks?.twitter && (
                    <span title="Twitter/X linked" className="text-sky-500"><FontAwesomeIcon icon={faTwitter} /></span>
                  )}
                  {member.socialLinks?.email && (
                    <span title={member.socialLinks.email} className="text-action-primary"><FontAwesomeIcon icon={faEnvelope} /></span>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 mt-4 border-t border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveOrder(index, -1)}
                    disabled={index === 0}
                    className="p-1.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed text-xs text-foreground"
                    title="Move up"
                  >
                    <FontAwesomeIcon icon={faArrowUp} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveOrder(index, 1)}
                    disabled={index === members.length - 1}
                    className="p-1.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed text-xs text-foreground"
                    title="Move down"
                  >
                    <FontAwesomeIcon icon={faArrowDown} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(member)}
                    className="px-3 py-1.5 rounded-lg border border-border-subtle hover:border-action-primary/50 text-xs font-semibold text-foreground hover:text-action-primary transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faEdit} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingMember(member)}
                    className="px-3 py-1.5 rounded-lg border border-red-500/30 hover:border-red-500 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal with Real-time Card Preview */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-surface border border-border-subtle rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-warm-lg my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-6">
              <h3 className="text-xl font-bold font-display text-foreground">
                {editingId ? "Edit Team Member" : "Add New Team Member"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-surface-subtle hover:bg-surface border border-border-subtle flex items-center justify-center text-foreground cursor-pointer"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Form Column */}
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Kunal Sarkar"
                    maxLength={100}
                    className="w-full px-4 py-2.5 rounded-xl border border-border-subtle bg-surface-subtle text-foreground text-sm focus:border-action-primary focus:outline-none transition-colors"
                  />
                  <div className="text-[11px] text-foreground-secondary text-right mt-1">
                    {formData.name.length} / 100
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground mb-1">
                    Role / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g. Lead Developer / Technical Strategist"
                    maxLength={120}
                    className="w-full px-4 py-2.5 rounded-xl border border-border-subtle bg-surface-subtle text-foreground text-sm focus:border-action-primary focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground mb-1">
                    Bio / Description *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Provide a concise description of responsibilities and technical expertise (plain text only)..."
                    maxLength={600}
                    className="w-full px-4 py-2.5 rounded-xl border border-border-subtle bg-surface-subtle text-foreground text-sm focus:border-action-primary focus:outline-none transition-colors resize-none"
                  />
                  <div className="flex justify-between text-[11px] text-foreground-secondary mt-1">
                    <span>No HTML tags allowed</span>
                    <span>{formData.bio.length} / 600</span>
                  </div>
                </div>

                {/* Photo Upload & URL */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground mb-1">
                    Photograph (File Upload or URL) *
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="w-full text-xs text-foreground-secondary file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-action-primary/10 file:text-action-primary hover:file:bg-action-primary/20 mb-2 cursor-pointer"
                  />
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => {
                      setFormData({ ...formData, imageUrl: e.target.value });
                      if (!selectedFile) setFilePreview(e.target.value);
                    }}
                    placeholder="Or enter existing https:// image URL"
                    className="w-full px-4 py-2 rounded-xl border border-border-subtle bg-surface-subtle text-foreground text-xs focus:border-action-primary focus:outline-none transition-colors"
                  />
                </div>

                {/* Social Links */}
                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                    Social Links (Optional)
                  </span>

                  <input
                    type="url"
                    value={formData.socialLinks.linkedin}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        socialLinks: { ...formData.socialLinks, linkedin: e.target.value },
                      })
                    }
                    placeholder="LinkedIn URL (https://linkedin.com/in/...)"
                    className="w-full px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-subtle text-foreground text-xs focus:border-action-primary focus:outline-none"
                  />

                  <input
                    type="url"
                    value={formData.socialLinks.github}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        socialLinks: { ...formData.socialLinks, github: e.target.value },
                      })
                    }
                    placeholder="GitHub URL (https://github.com/...)"
                    className="w-full px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-subtle text-foreground text-xs focus:border-action-primary focus:outline-none"
                  />

                  <input
                    type="url"
                    value={formData.socialLinks.twitter}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        socialLinks: { ...formData.socialLinks, twitter: e.target.value },
                      })
                    }
                    placeholder="Twitter/X URL (https://x.com/...)"
                    className="w-full px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-subtle text-foreground text-xs focus:border-action-primary focus:outline-none"
                  />

                  <input
                    type="text"
                    value={formData.socialLinks.email}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        socialLinks: { ...formData.socialLinks, email: e.target.value },
                      })
                    }
                    placeholder="Email address (e.g. name@domain.com)"
                    className="w-full px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-subtle text-foreground text-xs focus:border-action-primary focus:outline-none"
                  />
                </div>

                {/* Display Order & Active Checkbox */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActiveToggle"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 rounded text-action-primary focus:ring-action-primary cursor-pointer"
                    />
                    <label htmlFor="isActiveToggle" className="text-xs font-semibold text-foreground cursor-pointer">
                      Publish profile on public About page
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-foreground-secondary">
                      Priority Order:
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.displayOrder}
                      onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                      className="w-16 px-2 py-1 rounded-lg border border-border-subtle bg-surface-subtle text-foreground text-xs text-center"
                    />
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-border-subtle">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 rounded-xl border border-border-subtle bg-surface hover:bg-surface-subtle text-sm text-foreground transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 rounded-xl bg-action-primary hover:bg-action-primary-hover text-white text-sm font-semibold shadow-warm-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : editingId ? "Update Member" : "Create Member"}
                  </button>
                </div>
              </form>

              {/* Real-Time Live Profile Card Preview */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-action-primary mb-3">
                  Live About Page Card Preview
                </span>

                <div className="w-full max-w-[340px] bg-surface-subtle border border-border-subtle rounded-2xl p-6 shadow-warm-xs text-center flex flex-col justify-between">
                  <div>
                    <div className="relative inline-block mb-4">
                      <img
                        src={
                          filePreview ||
                          formData.imageUrl ||
                          "/assets/images/FooterElements/AboutUs/OmSardar.jpg"
                        }
                        alt="Preview"
                        className="w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-action-primary/20 shadow-warm-sm"
                        onError={(e) => {
                          e.target.src = "/assets/images/FooterElements/AboutUs/OmSardar.jpg";
                        }}
                      />
                    </div>
                    <h4 className="text-lg font-bold font-display text-foreground">
                      {formData.name || "Member Name"}
                    </h4>
                    <p className="text-xs font-semibold text-action-primary uppercase tracking-wider mb-3">
                      {formData.role || "Role Title"}
                    </p>
                    <p className="text-xs text-foreground-secondary leading-relaxed mb-6">
                      {formData.bio || "Member bio and contributions will appear here..."}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border-subtle flex justify-center items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-foreground-secondary">
                      <FontAwesomeIcon icon={faLinkedin} className="text-xs" />
                    </span>
                    <span className="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-foreground-secondary">
                      <FontAwesomeIcon icon={faGithub} className="text-xs" />
                    </span>
                    <span className="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-foreground-secondary">
                      <FontAwesomeIcon icon={faEnvelope} className="text-xs" />
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-foreground-secondary text-center mt-4 max-w-xs">
                  This card reflects exactly how visitors will see the profile on the public About page.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Step Modal */}
      {deletingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface border border-border-subtle rounded-3xl max-w-md w-full p-6 shadow-warm-lg">
            <h3 className="text-lg font-bold font-display text-foreground mb-2">
              Confirm Profile Deletion
            </h3>
            <p className="text-sm text-foreground-secondary mb-6 leading-relaxed">
              Are you sure you want to remove <strong className="text-foreground">{deletingMember.name}</strong> from the team? This action will remove their public profile and clean up any associated hosted image assets.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingMember(null)}
                className="px-4 py-2 rounded-xl border border-border-subtle bg-surface hover:bg-surface-subtle text-sm text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteMember}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Yes, Delete Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
