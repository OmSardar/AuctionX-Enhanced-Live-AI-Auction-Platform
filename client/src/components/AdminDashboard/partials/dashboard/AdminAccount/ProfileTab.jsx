import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import axiosWithAuth from "../../../../../redux/slices/axiosWithAuth";
import { setUser } from "@/features/auth/state/authSlice";
import { FaCamera, FaUser, FaCheckCircle, FaTimesCircle } from "react-icons/fa";

function ProfileTab({
  profile,
  onUpdateProfile,
  API_BASE_URL,
  showStatusMessage,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [imgError, setImgError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.auth.user);

  const handleEditProfile = () => {
    setEditedProfile({ ...profile });
    setIsEditing(true);
  };

  const handleProfileChange = (e) => {
    setEditedProfile({
      ...editedProfile,
      [e.target.name]: e.target.value,
    });
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("profilePic", file);
    formData.append("email", profile.email);

    try {
      setIsUploading(true);
      const response = await axiosWithAuth.post(
        `${API_BASE_URL}/api/auth/user/upload-profile-pic`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const updatedPic = response.data.profilePic;
      const updatedProfile = {
        ...profile,
        profilePic: updatedPic,
      };

      onUpdateProfile(updatedProfile);
      setEditedProfile(updatedProfile);
      setImgError(false);

      if (currentUser) {
        dispatch(setUser({ ...currentUser, profilePic: updatedPic }));
      }
      window.dispatchEvent(new Event("profile-updated"));

      showStatusMessage("Profile picture updated successfully", "success");
    } catch (error) {
      console.error("Error uploading profile picture:", error?.response || error);
      showStatusMessage(
        error?.response?.data?.message || "Failed to upload profile picture",
        "error"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const response = await axiosWithAuth.patch(
        `${API_BASE_URL}/api/auth/user/updateUserProfile/${profile.email}`,
        editedProfile
      );

      const updatedUser = response.data?.user || editedProfile;
      onUpdateProfile(updatedUser);
      setIsEditing(false);

      if (currentUser) {
        dispatch(setUser({ ...currentUser, ...updatedUser }));
      }
      window.dispatchEvent(new Event("profile-updated"));

      showStatusMessage("Profile updated successfully", "success");
    } catch (error) {
      console.error("Error updating profile:", error);
      showStatusMessage(
        error?.response?.data?.message || "Failed to update profile",
        "error"
      );
    }
  };

  const getProfilePicUrl = () => {
    const pic = isEditing ? editedProfile.profilePic : profile.profilePic;
    if (Array.isArray(pic) && pic.length > 0) {
      return pic[0]?.secure_url || pic[0]?.url || (typeof pic[0] === "string" ? pic[0] : null);
    }
    if (typeof pic === "string" && pic) return pic;
    if (pic && typeof pic === "object") return pic.secure_url || pic.url || null;
    return null;
  };

  const picUrl = getProfilePicUrl();
  const initials = (profile.name || profile.firstName || "Admin")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-8">
      {/* Profile Header Card */}
      <div className="bg-surface-subtle border border-border-default rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="w-20 h-20 rounded-2xl relative shrink-0 overflow-hidden shadow-xs border-2 border-border-default">
            {picUrl && !imgError ? (
              <img
                src={picUrl}
                alt={profile.name || "Admin"}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-amber-600 via-action-primary to-amber-800 flex items-center justify-center text-white font-bold text-2xl tracking-wider">
                {initials || "A"}
              </div>
            )}

            {/* Avatar Upload Overlay */}
            <label
              className="absolute inset-0 bg-black/40 hover:bg-black/60 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer text-white"
              title="Click to update profile photo"
            >
              <FaCamera className="text-lg mb-0.5" />
              <span className="text-[10px] font-semibold">Change</span>
              <input
                type="file"
                className="hidden"
                onChange={handleAvatarChange}
                accept="image/*"
                disabled={isUploading}
              />
            </label>
            {isUploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-bold text-foreground font-display">
                {profile.name || "Administrator"}
              </h3>
              {profile.isVerified ? (
                <FaCheckCircle className="text-status-success text-sm" title="Verified Account" />
              ) : (
                <FaTimesCircle className="text-foreground-muted text-sm" title="Unverified" />
              )}
            </div>
            <p className="text-xs sm:text-sm text-action-primary font-mono font-medium">
              {profile.email}
            </p>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-action-primary/10 text-action-primary border border-action-primary/20">
                {profile.role === "admin" ? "Super Administrator" : profile.role || "Admin"}
              </span>
              <span className="text-[11px] text-foreground-muted">
                Member since {new Date(profile.createdAt || Date.now()).getFullYear()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center">
          {!isEditing ? (
            <button
              type="button"
              onClick={handleEditProfile}
              className="px-4 py-2 bg-action-primary text-white hover:bg-action-primary-hover rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              Edit Profile
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-border-default bg-surface hover:bg-surface-subtle text-foreground rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-action-primary text-white hover:bg-action-primary-hover rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Details Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5 uppercase tracking-wide">
            Full Name
          </label>
          {isEditing ? (
            <input
              type="text"
              name="name"
              value={editedProfile.name || ""}
              onChange={handleProfileChange}
              className="w-full px-3.5 py-2.5 border border-border-default rounded-xl bg-surface-subtle text-foreground text-sm focus:outline-hidden focus:border-action-primary transition-colors"
            />
          ) : (
            <div className="text-sm font-medium text-foreground bg-surface-subtle/50 px-3.5 py-2.5 rounded-xl border border-border-subtle">
              {profile.name || "N/A"}
            </div>
          )}
        </div>

        {/* Email Address */}
        <div>
          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5 uppercase tracking-wide">
            Email Address (Primary Identity)
          </label>
          <div className="text-sm font-mono text-foreground-secondary bg-surface-subtle/50 px-3.5 py-2.5 rounded-xl border border-border-subtle flex items-center justify-between">
            <span>{profile.email}</span>
            <span className="text-[11px] font-sans text-foreground-muted">Non-editable</span>
          </div>
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5 uppercase tracking-wide">
            Phone Number
          </label>
          {isEditing ? (
            <input
              type="tel"
              name="phoneNo"
              value={editedProfile.phoneNo || ""}
              onChange={handleProfileChange}
              placeholder="+91 98765 43210"
              className="w-full px-3.5 py-2.5 border border-border-default rounded-xl bg-surface-subtle text-foreground text-sm focus:outline-hidden focus:border-action-primary transition-colors"
            />
          ) : (
            <div className="text-sm font-medium text-foreground bg-surface-subtle/50 px-3.5 py-2.5 rounded-xl border border-border-subtle">
              {profile.phoneNo || "Not provided"}
            </div>
          )}
        </div>

        {/* Alternative Phone Number */}
        <div>
          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5 uppercase tracking-wide">
            Alternative Phone Number
          </label>
          {isEditing ? (
            <input
              type="tel"
              name="alternativePhoneNo"
              value={editedProfile.alternativePhoneNo || ""}
              onChange={handleProfileChange}
              placeholder="+91 98765 43210"
              className="w-full px-3.5 py-2.5 border border-border-default rounded-xl bg-surface-subtle text-foreground text-sm focus:outline-hidden focus:border-action-primary transition-colors"
            />
          ) : (
            <div className="text-sm font-medium text-foreground bg-surface-subtle/50 px-3.5 py-2.5 rounded-xl border border-border-subtle">
              {profile.alternativePhoneNo || "Not provided"}
            </div>
          )}
        </div>

        {/* Gender */}
        <div>
          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5 uppercase tracking-wide">
            Gender
          </label>
          {isEditing ? (
            <select
              name="gender"
              value={editedProfile.gender || ""}
              onChange={handleProfileChange}
              className="w-full px-3.5 py-2.5 border border-border-default rounded-xl bg-surface-subtle text-foreground text-sm focus:outline-hidden focus:border-action-primary transition-colors"
            >
              <option value="">Not specified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          ) : (
            <div className="text-sm font-medium text-foreground bg-surface-subtle/50 px-3.5 py-2.5 rounded-xl border border-border-subtle capitalize">
              {profile.gender || "Not specified"}
            </div>
          )}
        </div>

        {/* Address */}
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5 uppercase tracking-wide">
            Street Address
          </label>
          {isEditing ? (
            <input
              type="text"
              name="address"
              value={editedProfile.address || ""}
              onChange={handleProfileChange}
              placeholder="e.g. 123 Tech Park, Phase 1"
              className="w-full px-3.5 py-2.5 border border-border-default rounded-xl bg-surface-subtle text-foreground text-sm focus:outline-hidden focus:border-action-primary transition-colors"
            />
          ) : (
            <div className="text-sm font-medium text-foreground bg-surface-subtle/50 px-3.5 py-2.5 rounded-xl border border-border-subtle">
              {profile.address || "Not provided"}
            </div>
          )}
        </div>

        {/* City */}
        <div>
          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5 uppercase tracking-wide">
            City
          </label>
          {isEditing ? (
            <input
              type="text"
              name="city"
              value={editedProfile.city || ""}
              onChange={handleProfileChange}
              className="w-full px-3.5 py-2.5 border border-border-default rounded-xl bg-surface-subtle text-foreground text-sm focus:outline-hidden focus:border-action-primary transition-colors"
            />
          ) : (
            <div className="text-sm font-medium text-foreground bg-surface-subtle/50 px-3.5 py-2.5 rounded-xl border border-border-subtle">
              {profile.city || "Not provided"}
            </div>
          )}
        </div>

        {/* State */}
        <div>
          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5 uppercase tracking-wide">
            State / Province
          </label>
          {isEditing ? (
            <input
              type="text"
              name="state"
              value={editedProfile.state || ""}
              onChange={handleProfileChange}
              className="w-full px-3.5 py-2.5 border border-border-default rounded-xl bg-surface-subtle text-foreground text-sm focus:outline-hidden focus:border-action-primary transition-colors"
            />
          ) : (
            <div className="text-sm font-medium text-foreground bg-surface-subtle/50 px-3.5 py-2.5 rounded-xl border border-border-subtle">
              {profile.state || "Not provided"}
            </div>
          )}
        </div>

        {/* Country */}
        <div>
          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5 uppercase tracking-wide">
            Country
          </label>
          {isEditing ? (
            <input
              type="text"
              name="country"
              value={editedProfile.country || ""}
              onChange={handleProfileChange}
              className="w-full px-3.5 py-2.5 border border-border-default rounded-xl bg-surface-subtle text-foreground text-sm focus:outline-hidden focus:border-action-primary transition-colors"
            />
          ) : (
            <div className="text-sm font-medium text-foreground bg-surface-subtle/50 px-3.5 py-2.5 rounded-xl border border-border-subtle">
              {profile.country || "Not provided"}
            </div>
          )}
        </div>

        {/* Pin Code */}
        <div>
          <label className="block text-xs font-semibold text-foreground-secondary mb-1.5 uppercase tracking-wide">
            Postal / Pin Code
          </label>
          {isEditing ? (
            <input
              type="text"
              name="pinCode"
              value={editedProfile.pinCode || ""}
              onChange={handleProfileChange}
              className="w-full px-3.5 py-2.5 border border-border-default rounded-xl bg-surface-subtle text-foreground text-sm focus:outline-hidden focus:border-action-primary transition-colors"
            />
          ) : (
            <div className="text-sm font-medium text-foreground bg-surface-subtle/50 px-3.5 py-2.5 rounded-xl border border-border-subtle font-mono">
              {profile.pinCode || "Not provided"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfileTab;
