import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import { MdDelete } from "react-icons/md";
import { FaUserEdit, FaCheck, FaGoogle } from "react-icons/fa";
import { IoMdCloudDone } from "react-icons/io";
import { fetchCsrfToken } from "../../../redux/slices/csrfSecuritySlice";
import { setUser } from "../../../features/auth/state/authSlice";

// Predefined AuctionX original local vector avatars
const initialAvatars = [
  "/avatars/avatar-1.svg",
  "/avatars/avatar-2.svg",
  "/avatars/avatar-3.svg",
  "/avatars/avatar-4.svg",
  "/avatars/avatar-5.svg",
  "/avatars/avatar-6.svg",
  "/avatars/avatar-7.svg",
];

const DEFAULT_AVATAR = "/default-profile.png";

/**
 * Enterprise Change Avatar Modal Component
 * Fully theme-aware (supports dark and light modes using AuctionX design tokens).
 * Preserves Google profile photos separately from deliberate AuctionX avatar selections.
 */
const AvatarSelector = ({ onClose, activeProfilePic = null, user = null }) => {
  const auth = useSelector((state) => state.auth);
  const email = user?.email || auth.user?.email;
  const role = user?.role || auth.user?.role || auth.role;

  // Extract URL regardless of object or array format
  const normalizeAvatarUrl = (avatar) => {
    if (!avatar) return null;
    if (typeof avatar === "string") return avatar;
    if (avatar.secure_url) return avatar.secure_url;
    if (Array.isArray(avatar) && avatar[0]?.secure_url)
      return avatar[0].secure_url;
    return null;
  };

  // Immediate synchronous initialization from available props/Redux state
  const initialActive =
    activeProfilePic ||
    normalizeAvatarUrl(user?.profilePic) ||
    normalizeAvatarUrl(auth.user?.profilePic) ||
    user?.googlePhoto ||
    auth.user?.googlePhoto ||
    null;

  const [selectedAvatar, setSelectedAvatar] = useState(initialActive);
  const [currentAvatar, setCurrentAvatar] = useState(initialActive);
  const [googlePhoto, setGooglePhoto] = useState(
    user?.googlePhoto || auth.user?.googlePhoto || null
  );
  const [confirmed, setConfirmed] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [customImages, setCustomImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const { token: csrfToken } = useSelector((state) => state.csrf);
  const dispatch = useDispatch();
  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!csrfToken) {
      dispatch(fetchCsrfToken());
    }
  }, [dispatch, csrfToken]);

  // Helper function to validate avatar URLs (supports local relative paths, blob URLs, and HTTP/HTTPS)
  const isValidUrl = (url) => {
    if (!url || typeof url !== "string") return false;
    const trimmed = url.trim();
    if (initialAvatars.includes(trimmed) || trimmed === DEFAULT_AVATAR) {
      return true;
    }
    // Allow clean root-relative or relative paths, but disallow protocol-relative '//'
    if ((trimmed.startsWith("/") || trimmed.startsWith("./")) && !trimmed.startsWith("//")) {
      return true;
    }
    try {
      const parsed = new URL(trimmed);
      return (
        parsed.protocol === "http:" ||
        parsed.protocol === "https:" ||
        parsed.protocol === "blob:"
      );
    } catch {
      return false;
    }
  };

  // Fetch current user avatar and googlePhoto on mount
  useEffect(() => {
    let isMounted = true;
    const fetchUserData = async () => {
      if (!email) return;

      setIsLoading(true);
      setError(null);

      try {
        const endpoint =
          role === "seller"
            ? `/auth/seller/user/${email}`
            : `/auth/user/${email}`;

        let response;
        try {
          response = await axiosWithAuth.get(endpoint);
        } catch (apiErr) {
          if (API_URL) {
            response = await axiosWithAuth.get(`${API_URL}/api${endpoint}`);
          } else {
            throw apiErr;
          }
        }

        if (!isMounted) return;

        const userData = response.data?.user || response.data;
        const activePic = normalizeAvatarUrl(userData?.profilePic);
        const gPhoto =
          userData?.googlePhoto ||
          (activePic?.includes("googleusercontent.com") ? activePic : null) ||
          user?.googlePhoto ||
          auth.user?.googlePhoto ||
          null;

        const resolvedCurrent = activePic || gPhoto || initialActive || DEFAULT_AVATAR;

        setCurrentAvatar(resolvedCurrent);
        setSelectedAvatar((prev) => {
          if (!prev || prev === currentAvatar || prev === initialActive) {
            return resolvedCurrent;
          }
          return prev;
        });

        if (gPhoto) {
          setGooglePhoto(gPhoto);
        }

        // Add custom image if not part of predefined set
        if (
          activePic &&
          !initialAvatars.includes(activePic) &&
          activePic !== gPhoto &&
          activePic !== DEFAULT_AVATAR
        ) {
          setCustomImages((prev) => {
            const uniqueImages = new Set([...prev, activePic]);
            return Array.from(uniqueImages).slice(0, 5);
          });
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching user profile avatar:", err);
        if (!currentAvatar && !initialActive) {
          const fallback = DEFAULT_AVATAR;
          setCurrentAvatar(fallback);
          setSelectedAvatar(fallback);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchUserData();
    return () => {
      isMounted = false;
    };
  }, [email, role, API_URL, user]);

  const handleAvatarSelect = (avatar) => {
    if (!isValidUrl(avatar)) {
      setError("Invalid avatar URL");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    setSelectedAvatar(avatar);
    setConfirmed(false);
    setSuccessMessage("");
    setError(null);
  };

  const handleKeyDownAvatar = (e, avatar) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleAvatarSelect(avatar);
    }
  };

  const handleConfirmAvatar = async () => {
    if (isLoading || !selectedAvatar) return;
    if (!isValidUrl(selectedAvatar)) {
      setError("Please select a valid avatar image");
      return;
    }

    const currentUrl = normalizeAvatarUrl(currentAvatar);
    const selectedUrl = normalizeAvatarUrl(selectedAvatar);

    if (currentUrl === selectedUrl) {
      setError("Selected avatar is already your active profile picture.");
      return;
    }

    const isGoogleChoice =
      selectedUrl === googlePhoto || selectedAvatar === "google";
    const isDefaultChoice =
      selectedUrl === DEFAULT_AVATAR || selectedAvatar === "default";

    setIsLoading(true);
    setError(null);
    setSuccessMessage("");

    try {
      const patchEndpoint = `/auth/updateUserProfileImage/${email}`;
      const payload = {
        profilePic: [
          {
            secure_url: isGoogleChoice
              ? googlePhoto
              : isDefaultChoice
              ? DEFAULT_AVATAR
              : selectedUrl,
            public_id: "",
          },
        ],
        selectedAvatar: isGoogleChoice
          ? "google"
          : isDefaultChoice
          ? "default"
          : selectedUrl,
      };

      let response;
      try {
        response = await axiosWithAuth.patch(patchEndpoint, payload, {
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
          },
          withCredentials: true,
        });
      } catch (patchErr) {
        if (API_URL) {
          response = await axiosWithAuth.patch(
            `${API_URL}/api${patchEndpoint}`,
            payload,
            {
              headers: {
                "Content-Type": "application/json",
                ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
              },
              withCredentials: true,
            }
          );
        } else {
          throw patchErr;
        }
      }

      if (response.data?.success) {
        const finalUrl = isGoogleChoice
          ? googlePhoto
          : isDefaultChoice
          ? DEFAULT_AVATAR
          : selectedUrl;
        setCurrentAvatar(finalUrl);
        setSelectedAvatar(finalUrl);
        setConfirmed(true);
        setSuccessMessage("Avatar updated successfully!");

        // Synchronize Redux auth state immediately
        if (response.data.user) {
          dispatch(
            setUser({
              ...auth.user,
              ...response.data.user,
              profilePic: response.data.user.profilePic,
              selectedAvatar: response.data.user.selectedAvatar,
              googlePhoto: response.data.user.googlePhoto || googlePhoto,
            })
          );
        }

        window.dispatchEvent(new Event("profile-updated"));
        setTimeout(() => onClose?.(), 1200);
      } else {
        throw new Error(response.data?.message || "Failed to update avatar");
      }
    } catch (err) {
      console.error("Error updating avatar:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to update profile picture. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAvatar = async (e, avatar) => {
    e.stopPropagation();

    if (
      initialAvatars.includes(avatar) ||
      avatar === googlePhoto ||
      avatar === DEFAULT_AVATAR ||
      avatar?.includes("flaticon.com")
    ) {
      setError("Built-in avatars, default avatars, and Google photos cannot be removed.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedCustomImages = customImages.filter((img) => img !== avatar);
      setCustomImages(updatedCustomImages);

      if (selectedAvatar === avatar) {
        setSelectedAvatar(currentAvatar || googlePhoto || DEFAULT_AVATAR);
      }

      setSuccessMessage("Removed from recent selection list.");
      setTimeout(() => setSuccessMessage(""), 2500);
    } catch (err) {
      console.error("Error removing avatar:", err);
      setError("Failed to remove avatar from selection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetAvatar = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage("");

    try {
      // Call dedicated reset endpoint to persist default avatar choice without deleting Google photo
      const resetEndpoint = `/auth/resetProfileImage/${email}`;
      let response;
      try {
        response = await axiosWithAuth.patch(
          resetEndpoint,
          {},
          {
            headers: {
              ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
            },
            withCredentials: true,
          }
        );
      } catch (resetErr) {
        if (API_URL) {
          response = await axiosWithAuth.patch(
            `${API_URL}/api${resetEndpoint}`,
            {},
            {
              headers: {
                ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
              },
              withCredentials: true,
            }
          );
        } else {
          throw resetErr;
        }
      }

      if (response.data?.success) {
        const restoredAvatar =
          normalizeAvatarUrl(response.data.user?.profilePic) || DEFAULT_AVATAR;

        setCurrentAvatar(restoredAvatar);
        setSelectedAvatar(restoredAvatar);
        setConfirmed(true);
        setSuccessMessage("Avatar reset to default successfully!");

        // Synchronize Redux auth state immediately
        if (response.data.user) {
          dispatch(
            setUser({
              ...auth.user,
              ...response.data.user,
              profilePic: response.data.user.profilePic,
              selectedAvatar: "default",
              googlePhoto: response.data.user.googlePhoto || googlePhoto,
            })
          );
        }

        window.dispatchEvent(new Event("profile-updated"));
        setTimeout(() => onClose?.(), 1200);
      } else {
        throw new Error("Invalid response format from server");
      }
    } catch (err) {
      console.error("Reset avatar error:", err);
      setError(err.response?.data?.message || "Failed to reset avatar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      setError("Please upload a valid image (JPEG, PNG, GIF, or WEBP)");
      return;
    }

    if (file.size > maxSize) {
      setError("Image file size must be less than 5MB");
      return;
    }

    const formData = new FormData();
    formData.append("profilePic", file);
    formData.append("email", email);

    setIsLoading(true);
    setError(null);

    try {
      const uploadEndpoint = `/auth/upload-profile-pic`;
      let response;
      try {
        response = await axiosWithAuth.post(uploadEndpoint, formData, {
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
          },
          timeout: 60000,
        });
      } catch (uploadErr) {
        if (API_URL) {
          response = await axiosWithAuth.post(
            `${API_URL}/api${uploadEndpoint}`,
            formData,
            {
              withCredentials: true,
              headers: {
                "Content-Type": "multipart/form-data",
                ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
              },
              timeout: 60000,
            }
          );
        } else {
          throw uploadErr;
        }
      }

      const imageUrl = response.data?.image?.secure_url;
      if (!imageUrl) {
        throw new Error(response.data?.message || "Profile picture upload failed");
      }

      setSelectedAvatar(imageUrl);
      setCurrentAvatar(imageUrl);
      setConfirmed(false);

      // Synchronize Redux auth state immediately
      dispatch(
        setUser({
          ...auth.user,
          profilePic: [
            {
              secure_url: imageUrl,
              public_id: response.data?.image?.public_id || "",
            },
          ],
          selectedAvatar: imageUrl,
        })
      );

      window.dispatchEvent(new Event("profile-updated"));
      setSuccessMessage("Custom avatar uploaded and set successfully!");

      setCustomImages((prev) => {
        const updated = [imageUrl, ...prev.filter((img) => img !== imageUrl)];
        return updated.slice(0, 5);
      });
    } catch (err) {
      console.error("Error uploading profile picture:", err);
      setError(
        err.response?.data?.message ||
          "Failed to upload custom image. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const isCurrentSelection =
    normalizeAvatarUrl(selectedAvatar) === normalizeAvatarUrl(currentAvatar);

  return (
    <div className="w-full text-foreground relative flex flex-col">
      {/* Modal Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-border-subtle pr-8">
        <div>
          <h2
            id="change-avatar-title"
            className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight"
          >
            Change Avatar
          </h2>
          <p className="text-xs sm:text-sm text-foreground-muted mt-0.5">
            Choose a predefined avatar, your Google profile photo, or upload a custom image
          </p>
        </div>

        {/* Edit mode toggle for removing custom uploads */}
        {customImages.length > 0 && (
          <button
            type="button"
            onClick={() => setEditMode((prev) => !prev)}
            title={editMode ? "Done editing" : "Manage uploaded avatars"}
            aria-label={editMode ? "Done editing" : "Manage uploaded avatars"}
            className="p-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
          >
            {editMode ? (
              <IoMdCloudDone className="w-5 h-5 text-action-primary" />
            ) : (
              <FaUserEdit className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      {/* Status Alerts */}
      {error && (
        <div
          role="alert"
          className="mb-4 px-3.5 py-2.5 rounded-xl border border-action-destructive/40 bg-status-error-bg/30 text-action-destructive text-xs sm:text-sm font-medium flex items-center gap-2 animate-in fade-in duration-150"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-action-destructive shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="mb-4 px-3.5 py-2.5 rounded-xl border border-status-success/40 bg-status-success-bg/30 text-status-success text-xs sm:text-sm font-medium flex items-center gap-2 animate-in fade-in duration-150"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-status-success shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Column: Avatar Selection Grid */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Section: Google Profile Photo (if available) */}
          {googlePhoto && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider flex items-center gap-1.5">
                <FaGoogle className="w-3 h-3 text-action-primary" />
                <span>Google Profile Photo</span>
              </span>
              <div className="flex items-center gap-3">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleAvatarSelect(googlePhoto)}
                  onKeyDown={(e) => handleKeyDownAvatar(e, googlePhoto)}
                  aria-label="Select Google profile photo"
                  className={`relative group rounded-full cursor-pointer transition-all duration-200 select-none p-0.5 ${
                    normalizeAvatarUrl(selectedAvatar) === googlePhoto
                      ? "ring-2 ring-action-primary ring-offset-2 ring-offset-surface scale-105"
                      : "hover:scale-105 opacity-90 hover:opacity-100"
                  }`}
                >
                  <img
                    src={googlePhoto}
                    alt="Google Profile"
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-border-default bg-surface-subtle"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                  {normalizeAvatarUrl(selectedAvatar) === googlePhoto && (
                    <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-action-primary text-white flex items-center justify-center text-[10px] shadow-xs">
                      <FaCheck />
                    </span>
                  )}
                </div>
                <div className="text-xs text-foreground-secondary">
                  <p className="font-semibold text-foreground">Original Google Photo</p>
                  <p className="text-foreground-muted text-[11px]">
                    Preserved from Google OAuth authentication
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section: Predefined Avatars & Upload */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
              AuctionX Character Avatars
            </span>

            <div
              className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 gap-2.5 sm:gap-3.5 max-h-56 sm:max-h-64 overflow-y-auto p-1"
              style={{ scrollbarWidth: "thin" }}
            >
              {/* Custom Upload Tile */}
              <label
                htmlFor="customAvatarUpload"
                title="Upload custom image (Max 5MB)"
                className={`w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-full flex flex-col items-center justify-center cursor-pointer border-2 border-dashed transition-all duration-200 ${
                  previewUrl
                    ? "border-action-primary ring-2 ring-ring-focus"
                    : "border-border-default hover:border-action-primary bg-surface-subtle hover:bg-surface-raised"
                }`}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Uploaded preview"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-foreground-muted hover:text-action-primary">
                    <span className="text-lg sm:text-xl font-bold leading-none">+</span>
                    <span className="text-[9px] font-medium uppercase mt-0.5">Upload</span>
                  </div>
                )}
                <input
                  type="file"
                  id="customAvatarUpload"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleCustomImage}
                  disabled={isLoading}
                />
              </label>

              {/* Predefined Avatars */}
              {initialAvatars.map((avatar, index) => {
                const isSelected = normalizeAvatarUrl(selectedAvatar) === avatar;
                return (
                  <div
                    key={`default-${index}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleAvatarSelect(avatar)}
                    onKeyDown={(e) => handleKeyDownAvatar(e, avatar)}
                    aria-label={`AuctionX Avatar ${index + 1}`}
                    className={`relative rounded-full cursor-pointer transition-all duration-200 select-none p-0.5 ${
                      isSelected
                        ? "ring-2 ring-action-primary ring-offset-2 ring-offset-surface scale-105"
                        : "hover:scale-105 opacity-85 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={avatar}
                      alt={`Avatar ${index + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-full object-cover border-2 border-border-subtle bg-surface-subtle"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />
                    {isSelected && (
                      <span className="absolute bottom-0 right-0 w-4.5 h-4.5 rounded-full bg-action-primary text-white flex items-center justify-center text-[9px] shadow-xs">
                        <FaCheck />
                      </span>
                    )}
                  </div>
                );
              })}

              {/* User Custom Uploaded Images */}
              {customImages.map((avatar, index) => {
                const isSelected = normalizeAvatarUrl(selectedAvatar) === avatar;
                return (
                  <div
                    key={`custom-${index}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleAvatarSelect(avatar)}
                    onKeyDown={(e) => handleKeyDownAvatar(e, avatar)}
                    aria-label={`Uploaded Avatar ${index + 1}`}
                    className={`relative rounded-full cursor-pointer transition-all duration-200 select-none p-0.5 ${
                      isSelected
                        ? "ring-2 ring-action-primary ring-offset-2 ring-offset-surface scale-105"
                        : "hover:scale-105 opacity-90 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={avatar}
                      alt={`Custom Avatar ${index + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-full object-cover border-2 border-border-default bg-surface-subtle"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />
                    {isSelected && (
                      <span className="absolute bottom-0 right-0 w-4.5 h-4.5 rounded-full bg-action-primary text-white flex items-center justify-center text-[9px] shadow-xs">
                        <FaCheck />
                      </span>
                    )}
                    {editMode && (
                      <button
                        type="button"
                        aria-label="Remove uploaded image"
                        className="absolute -top-1 -right-1 bg-action-destructive text-white rounded-full p-1 hover:scale-110 shadow-xs z-10"
                        onClick={(e) => handleDeleteAvatar(e, avatar)}
                        disabled={isLoading}
                      >
                        <MdDelete className="text-xs" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Previews Area */}
        <div className="w-full md:w-56 shrink-0 flex flex-col items-center justify-center p-4 rounded-xl bg-surface-subtle/80 border border-border-subtle">
          <div className="flex flex-row md:flex-col items-center justify-around w-full gap-5">
            {/* Current Active Avatar */}
            <div className="flex flex-col items-center text-center">
              <span className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">
                Current Active
              </span>
              <img
                src={normalizeAvatarUrl(currentAvatar) || DEFAULT_AVATAR}
                alt="Current profile avatar"
                referrerPolicy="no-referrer"
                className="w-18 h-18 sm:w-20 sm:h-20 rounded-full border-2 border-border-default object-cover shadow-xs bg-surface"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = DEFAULT_AVATAR;
                }}
              />
            </div>

            {/* Selected Candidate Avatar Preview */}
            <div className="flex flex-col items-center text-center">
              <span className="text-[11px] font-semibold text-action-primary uppercase tracking-wider mb-1.5">
                Selected Preview
              </span>
              <div className="relative">
                <img
                  src={
                    previewUrl ||
                    normalizeAvatarUrl(selectedAvatar) ||
                    normalizeAvatarUrl(currentAvatar) ||
                    DEFAULT_AVATAR
                  }
                  alt="Candidate selected avatar"
                  referrerPolicy="no-referrer"
                  className="w-18 h-18 sm:w-20 sm:h-20 rounded-full border-2 border-action-primary ring-2 ring-ring-focus object-cover shadow-sm bg-surface"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />
              </div>

              {/* Status pill under preview */}
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full mt-2 border ${
                  isCurrentSelection
                    ? "bg-surface-subtle border-border-subtle text-foreground-muted"
                    : "bg-action-primary/10 border-action-primary/30 text-action-primary font-semibold animate-pulse"
                }`}
              >
                {isCurrentSelection ? "Active" : "New Selection"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Actions Footer */}
      <div className="mt-6 pt-4 border-t border-border-subtle flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
        {/* Reset to Default Button */}
        <button
          type="button"
          onClick={handleResetAvatar}
          disabled={isLoading}
          className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-border-default bg-surface-subtle hover:bg-surface text-foreground transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          Reset to Default
        </button>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-foreground-secondary hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmAvatar}
            disabled={isLoading || isCurrentSelection || confirmed}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus ${
              isLoading || isCurrentSelection
                ? "bg-surface-subtle text-foreground-muted border border-border-subtle cursor-not-allowed opacity-60"
                : confirmed
                ? "bg-status-success text-white cursor-default"
                : "bg-action-primary hover:bg-action-primary-hover text-white active:scale-95 cursor-pointer"
            }`}
          >
            {isLoading
              ? "Updating..."
              : confirmed
              ? "Updated!"
              : "Confirm Avatar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarSelector;
