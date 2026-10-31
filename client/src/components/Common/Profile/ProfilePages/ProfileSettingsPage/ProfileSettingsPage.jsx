import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  Save,
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Key,
  Lock,
  Copy,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import toast from "react-hot-toast";
import { CountrySelector } from "../../../../ui/CountrySelector";
import authService from "../../../../../services/authService";
import axiosWithAuth from "../../../../../redux/slices/axiosWithAuth";
import { setUser as setAuthUser } from "../../../../../features/auth/state/authSlice";
import { fetchCsrfToken } from "../../../../../redux/slices/csrfSecuritySlice";
import { store } from "../../../../../app/store/store";

const ProfileSettingsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const auth = useSelector((state) => state.auth);
  const currentUser = auth?.user;
  const userEmail = currentUser?.email || auth?.user?.user?.email;

  const [formData, setFormData] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    address: currentUser?.address || "",
    phoneNo: currentUser?.phoneNo || "",
    alternativePhoneNo: currentUser?.alternativePhoneNo || "",
    gender: currentUser?.gender || "",
    dateOfBirth: currentUser?.dateOfBirth || "",
    city: currentUser?.city || "",
    state: currentUser?.state || "",
    country: currentUser?.country || "",
    pinCode: currentUser?.pinCode || "",
    profilePicture: null,
  });

  const [previewUrl, setPreviewUrl] = useState(
    currentUser?.profilePic?.[0]?.secure_url ||
      currentUser?.googlePhoto ||
      "/default-profile.png"
  );
  const [activeTab, setActiveTab] = useState("personal");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!currentUser);

  // 2FA State
  const [twoFactorStatus, setTwoFactorStatus] = useState({
    enabled: false,
    confirmedAt: null,
    emailOtpEnabled: false,
    hasPassword: undefined,
    isOAuthUser: undefined,
  });

  // Authoritative provider check: an account is Google-only if marked OAuth user and has no local password
  const isGoogleOnly = Boolean(
    (currentUser?.isOAuthUser || twoFactorStatus?.isOAuthUser) &&
    (currentUser?.hasPassword === false || twoFactorStatus?.hasPassword === false)
  );

  const [showEnableModal, setShowEnableModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [showDisableEmailOtpModal, setShowDisableEmailOtpModal] = useState(false);
  const [disableEmailOtpPassword, setDisableEmailOtpPassword] = useState("");
  const [isTogglingEmailOtp, setIsTogglingEmailOtp] = useState(false);

  // 2FA Enrollment State
  const [setupData, setSetupData] = useState(null); // { secret, qrCodeDataUrl, manualEntryKey }
  const [verificationCode, setVerificationCode] = useState("");
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [generatedRecoveryCodes, setGeneratedRecoveryCodes] = useState(null);

  // 2FA Disablement State
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableUseRecovery, setDisableUseRecovery] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  // 2FA Regenerate State
  const [regeneratePassword, setRegeneratePassword] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Password Change State
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Fetch CSRF token proactively on component mount
  useEffect(() => {
    dispatch(fetchCsrfToken());
  }, [dispatch]);

  // Keep form data synced with current Redux user state
  useEffect(() => {
    if (currentUser) {
      setFormData((prev) => ({
        ...prev,
        name: currentUser.name || prev.name || "",
        email: currentUser.email || prev.email || "",
        address: currentUser.address || prev.address || "",
        phoneNo: currentUser.phoneNo || prev.phoneNo || "",
        alternativePhoneNo:
          currentUser.alternativePhoneNo || prev.alternativePhoneNo || "",
        gender: currentUser.gender || prev.gender || "",
        dateOfBirth: currentUser.dateOfBirth || prev.dateOfBirth || "",
        city: currentUser.city || prev.city || "",
        state: currentUser.state || prev.state || "",
        country: currentUser.country || prev.country || "",
        pinCode: currentUser.pinCode || prev.pinCode || "",
      }));

      if (
        currentUser.profilePic &&
        currentUser.profilePic.length > 0 &&
        currentUser.profilePic[0]?.secure_url
      ) {
        setPreviewUrl(currentUser.profilePic[0].secure_url);
      } else if (currentUser.googlePhoto) {
        setPreviewUrl(currentUser.googlePhoto);
      }
    }
  }, [currentUser]);

  const fetchUserData = useCallback(
    async (targetEmail) => {
      const emailToFetch =
        targetEmail || userEmail || store.getState()?.auth?.user?.email;
      if (!emailToFetch) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await axiosWithAuth.get(
          `/auth/user/user/${encodeURIComponent(emailToFetch)}`
        );
        const userData = response.data;

        if (userData) {
          setFormData({
            name: userData.name || "",
            email: userData.email || "",
            address: userData.address || "",
            phoneNo: userData.phoneNo || "",
            alternativePhoneNo: userData.alternativePhoneNo || "",
            gender: userData.gender || "",
            dateOfBirth: userData.dateOfBirth || "",
            city: userData.city || "",
            state: userData.state || "",
            country: userData.country || "",
            pinCode: userData.pinCode || "",
            profilePicture: null,
          });

          if (
            userData.profilePic &&
            userData.profilePic.length > 0 &&
            userData.profilePic[0]?.secure_url
          ) {
            setPreviewUrl(userData.profilePic[0].secure_url);
          } else if (userData.googlePhoto) {
            setPreviewUrl(userData.googlePhoto);
          }

          // Merge with authoritative Redux store state without re-creating callback
          const currentStoreUser = store.getState()?.auth?.user || {};
          dispatch(
            setAuthUser({
              ...currentStoreUser,
              ...userData,
              profilePic: userData.profilePic || currentStoreUser.profilePic,
              googlePhoto: userData.googlePhoto || currentStoreUser.googlePhoto,
              selectedAvatar:
                userData.selectedAvatar || currentStoreUser.selectedAvatar,
            })
          );
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        if (!store.getState()?.auth?.user?.name) {
          toast.error("Error loading user profile");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [userEmail, dispatch]
  );

  // Fetch 2FA Status
  const fetch2faStatus = useCallback(async () => {
    try {
      const data = await authService.get2faStatus();
      setTwoFactorStatus({
        enabled: Boolean(data.twoFactorEnabled),
        confirmedAt: data.twoFactorConfirmedAt || null,
        emailOtpEnabled: Boolean(data.emailOtpLoginEnabled),
        hasPassword: data.hasPassword,
        isOAuthUser: data.isOAuthUser,
      });
    } catch (error) {
      console.error("Failed to load 2FA status:", error);
    }
  }, []);

  // Main initial load & session resolution effect
  useEffect(() => {
    let isMounted = true;

    const initUserData = async () => {
      // 1. If email is already present in Redux state
      if (userEmail) {
        try {
          await Promise.allSettled([fetchUserData(userEmail), fetch2faStatus()]);
        } finally {
          if (isMounted) setIsLoading(false);
        }
        return;
      }

      // 2. If userEmail is not in Redux yet (direct URL navigation/refresh), verify session with backend
      try {
        const checkRes = await authService.checkAuth();
        if (!isMounted) return;

        if (checkRes.authenticated && checkRes.user?.email) {
          dispatch(setAuthUser(checkRes.user));
          await Promise.allSettled([
            fetchUserData(checkRes.user.email),
            fetch2faStatus(),
          ]);
        } else {
          // Explicitly unauthenticated
          setIsLoading(false);
          toast.error("Please log in to view profile settings");
          navigate("/login");
        }
      } catch (err) {
        console.error("Session verification failed in ProfileSettingsPage:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initUserData();

    // Safety timeout: guaranteed unblock after 3.5s under any circumstance
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    }, 3500);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [userEmail, fetchUserData, fetch2faStatus, dispatch, navigate]);

  // Listen to profile updates dispatched by other components (e.g. AvatarSelector)
  useEffect(() => {
    const handleProfileUpdated = (e) => {
      const targetEmail = e.detail?.email || userEmail;
      if (targetEmail) {
        fetchUserData(targetEmail);
      }
    };
    window.addEventListener("profile-updated", handleProfileUpdated);
    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
  }, [fetchUserData, userEmail]);

  const updateUserProfile = async (profileData, email) => {
    try {
      const response = await axiosWithAuth.patch(
        `/auth/updateUserProfile/${encodeURIComponent(email)}`,
        profileData
      );
      const updatedUser = response.data?.user || response.data;
      if (updatedUser) {
        const currentStoreUser = store.getState()?.auth?.user || {};
        dispatch(
          setAuthUser({
            ...currentStoreUser,
            ...updatedUser,
          })
        );
        window.dispatchEvent(
          new CustomEvent("profile-updated", { detail: updatedUser })
        );
      }
      return response.data;
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  };

  const uploadProfilePicture = async (file, email) => {
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("profilePic", file);
      uploadFormData.append("email", email);

      const response = await axiosWithAuth.post(
        "/auth/upload-profile-pic",
        uploadFormData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      const updatedUser = response.data?.user || response.data;
      if (updatedUser) {
        const currentStoreUser = store.getState()?.auth?.user || {};
        dispatch(
          setAuthUser({
            ...currentStoreUser,
            ...updatedUser,
            profilePic: response.data.profilePic || updatedUser.profilePic,
          })
        );
        window.dispatchEvent(
          new CustomEvent("profile-updated", { detail: updatedUser })
        );
      }
      return response.data;
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      throw error;
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }

      if (!file.type.startsWith("image/")) {
        toast.error("Please select a valid image file");
        return;
      }

      try {
        const fileUrl = URL.createObjectURL(file);
        setPreviewUrl(fileUrl);
        setIsSaving(true);
        await uploadProfilePicture(file, userEmail);
        toast.success("Profile picture updated successfully!");
      } catch {
        toast.error("Error uploading profile picture");
        await fetchUserData();
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await updateUserProfile(formData, userEmail);
      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (error) {
      const msg = error.response?.data?.message || "Error updating profile";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------- 2FA Flow Handlers ----------------

  const handleStartEnable2fa = async () => {
    try {
      setIsEnrolling(true);
      const data = await authService.setup2fa();
      setSetupData(data);
      setVerificationCode("");
      setGeneratedRecoveryCodes(null);
      setShowEnableModal(true);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to initiate 2FA setup";
      toast.error(msg);
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleConfirm2fa = async (e) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }

    try {
      setIsEnrolling(true);
      const res = await authService.confirm2fa(verificationCode.trim());
      setGeneratedRecoveryCodes(res.recoveryCodes || []);
      setTwoFactorStatus({
        enabled: true,
        confirmedAt: new Date().toISOString(),
      });
      toast.success("Two-Factor Authentication successfully enabled!");
    } catch (err) {
      const msg = err.response?.data?.message || "Invalid authenticator code. Please try again.";
      toast.error(msg);
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleDisable2fa = async (e) => {
    e.preventDefault();
    if (!isGoogleOnly && !disablePassword) {
      toast.error("Account password is required");
      return;
    }

    try {
      setIsDisabling(true);
      await authService.disable2fa({
        password: isGoogleOnly ? undefined : disablePassword,
        code: disableUseRecovery ? undefined : disableCode.trim(),
        recoveryCode: disableUseRecovery ? disableCode.trim() : undefined,
      });

      setTwoFactorStatus((prev) => ({ ...prev, enabled: false, confirmedAt: null }));
      setShowDisableModal(false);
      setDisablePassword("");
      setDisableCode("");
      toast.success("Two-Factor Authentication disabled");
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to disable 2FA";
      toast.error(msg);
    } finally {
      setIsDisabling(false);
    }
  };

  const handleRegenerateCodes = async (e) => {
    e.preventDefault();
    if (!isGoogleOnly && !regeneratePassword) {
      toast.error("Account password is required");
      return;
    }

    try {
      setIsRegenerating(true);
      const res = await authService.regenerateRecoveryCodes(isGoogleOnly ? undefined : regeneratePassword);
      setGeneratedRecoveryCodes(res.recoveryCodes || []);
      setRegeneratePassword("");
      setShowRegenerateModal(false);
      setShowEnableModal(true); // Re-use codes display
      toast.success("Fresh recovery codes generated successfully!");
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to regenerate recovery codes";
      toast.error(msg);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleEnableEmailOtp = async () => {
    try {
      setIsTogglingEmailOtp(true);
      await authService.enableEmailOtp();
      setTwoFactorStatus((prev) => ({ ...prev, emailOtpEnabled: true }));
      toast.success("Email OTP verification enabled for login!");
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to enable email OTP";
      toast.error(msg);
    } finally {
      setIsTogglingEmailOtp(false);
    }
  };

  const handleDisableEmailOtp = async (e) => {
    e.preventDefault();
    if (!disableEmailOtpPassword) {
      toast.error("Account password is required");
      return;
    }

    try {
      setIsTogglingEmailOtp(true);
      await authService.disableEmailOtp({ password: disableEmailOtpPassword });
      setTwoFactorStatus((prev) => ({ ...prev, emailOtpEnabled: false }));
      setShowDisableEmailOtpModal(false);
      setDisableEmailOtpPassword("");
      toast.success("Email OTP verification has been disabled.");
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to disable email OTP";
      toast.error(msg);
    } finally {
      setIsTogglingEmailOtp(false);
    }
  };

  const handleCopyCodes = (codes) => {
    if (!codes || codes.length === 0) return;
    navigator.clipboard.writeText(codes.join("\n"));
    toast.success("Recovery codes copied to clipboard");
  };

  const handleDownloadCodes = (codes) => {
    if (!codes || codes.length === 0) return;
    const content = `AUCTIONX - ACCOUNT RECOVERY CODES\nGenerated: ${new Date().toISOString()}\nAccount: ${userEmail}\n\nKeep these single-use codes secure:\n${codes.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nEach code can only be used once.`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `AuctionX-Recovery-Codes-${userEmail}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Recovery codes downloaded");
  };

  // ---------------- Password Update Handler ----------------

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (isGoogleOnly) {
      toast.error("Password management is unavailable for Google sign-in accounts.");
      return;
    }
    const { currentPassword, newPassword, confirmPassword } = passwordData;

    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long");
      return;
    }

    if (newPassword === currentPassword) {
      toast.error("New password must be different from current password");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    try {
      setIsChangingPassword(true);
      const res = await authService.updatePassword({ currentPassword, newPassword });
      toast.success(res.message || "Password updated successfully!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to update password";
      toast.error(msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading && !formData.email) {
    return (
      <div className="bg-canvas min-h-screen flex items-center justify-center text-foreground transition-colors">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-action-primary border-t-transparent"></div>
          <span className="text-foreground-secondary text-sm font-medium">Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-canvas min-h-screen text-foreground transition-colors duration-200">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary-700 via-primary-600 to-primary-800 text-white shadow-warm-sm">
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
          <h1 className="text-2xl md:text-3xl font-bold font-display">Profile Settings</h1>
          <p className="mt-1.5 opacity-90 text-sm md:text-base">
            Manage your personal information, address, and account security
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar - Profile Summary & Nav */}
          <div className="w-full md:w-1/3 lg:w-1/4">
            <div className="bg-surface rounded-2xl shadow-warm-sm border border-border-default overflow-hidden">
              <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 px-6 py-8 text-white text-center">
                <div className="relative mx-auto w-24 h-24 mb-4">
                  <img
                    src={previewUrl}
                    alt="Profile"
                    className="rounded-full object-cover w-full h-full border-4 border-surface shadow-warm-md"
                  />
                  <label className="absolute bottom-0 right-0 bg-surface p-2 rounded-full shadow-warm-xs cursor-pointer hover:bg-canvas-subtle transition-colors">
                    <Camera size={16} className="text-action-primary" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <h2 className="text-xl font-bold font-display">
                  {formData.name || "User Name"}
                </h2>
                <p className="opacity-90 text-xs mt-1 truncate">{formData.email}</p>
              </div>

              <div className="p-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-4">
                  Account Summary
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center text-foreground-secondary">
                    <MapPin size={16} className="mr-2.5 text-action-primary flex-shrink-0" />
                    <span className="text-sm truncate">
                      {formData.city && formData.state
                        ? `${formData.city}, ${formData.state}`
                        : "Location not set"}
                    </span>
                  </div>
                  <div className="flex items-center text-foreground-secondary">
                    <Phone size={16} className="mr-2.5 text-action-primary flex-shrink-0" />
                    <span className="text-sm truncate">
                      {formData.phoneNo || "Phone not set"}
                    </span>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                      isEditing
                        ? "bg-surface-subtle text-foreground border border-border-default hover:bg-canvas-subtle"
                        : "bg-action-primary text-white hover:bg-action-primary-hover shadow-warm-xs"
                    }`}
                  >
                    {isEditing ? "Cancel Editing" : "Edit Profile"}
                  </button>
                </div>
              </div>
            </div>

            {/* Navigation Tabs (Desktop) */}
            <div className="bg-surface rounded-2xl shadow-warm-sm border border-border-default overflow-hidden mt-6 hidden md:block">
              <div className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-2 px-2">
                  Settings Menu
                </h3>
                <nav className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("personal")}
                    className={`flex items-center w-full px-3.5 py-2.5 text-sm rounded-xl transition-colors cursor-pointer ${
                      activeTab === "personal"
                        ? "bg-action-primary/10 text-action-primary font-bold"
                        : "text-foreground-secondary hover:text-foreground hover:bg-canvas-subtle"
                    }`}
                  >
                    <User size={18} className="mr-2.5" />
                    Personal Information
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("account")}
                    className={`flex items-center justify-between w-full px-3.5 py-2.5 text-sm rounded-xl transition-colors cursor-pointer ${
                      activeTab === "account"
                        ? "bg-action-primary/10 text-action-primary font-bold"
                        : "text-foreground-secondary hover:text-foreground hover:bg-canvas-subtle"
                    }`}
                  >
                    <div className="flex items-center">
                      <Settings size={18} className="mr-2.5" />
                      Account & Security
                    </div>
                    {twoFactorStatus.enabled && (
                      <span className="w-2 h-2 rounded-full bg-status-success"></span>
                    )}
                  </button>
                </nav>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="w-full md:w-2/3 lg:w-3/4">
            <div className="bg-surface rounded-2xl shadow-warm-sm border border-border-default overflow-hidden">
              {/* Tab Navigation (Mobile) */}
              <div className="flex border-b border-border-default md:hidden">
                <button
                  type="button"
                  onClick={() => setActiveTab("personal")}
                  className={`flex-1 py-3 px-4 text-center text-sm font-medium transition-colors ${
                    activeTab === "personal"
                      ? "border-b-2 border-action-primary text-action-primary font-bold bg-surface"
                      : "text-foreground-secondary bg-surface-subtle"
                  }`}
                >
                  Personal Info
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("account")}
                  className={`flex-1 py-3 px-4 text-center text-sm font-medium transition-colors ${
                    activeTab === "account"
                      ? "border-b-2 border-action-primary text-action-primary font-bold bg-surface"
                      : "text-foreground-secondary bg-surface-subtle"
                  }`}
                >
                  Account & Security
                </button>
              </div>

              {/* ---------------- Tab 1: Personal Information Form ---------------- */}
              {activeTab === "personal" && (
                <div className="p-6 md:p-8">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-bold font-display text-foreground">
                        Personal Information
                      </h2>
                      <p className="text-xs text-foreground-muted mt-0.5">
                        Update your public profile and shipping address details
                      </p>
                    </div>
                    {isEditing && (
                      <span className="text-xs bg-action-primary/15 text-action-primary font-semibold px-2.5 py-1 rounded-full">
                        Editing Active
                      </span>
                    )}
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Full Name */}
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                        Full Name
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <User size={17} className="text-foreground-muted" />
                        </div>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          required
                          className={`pl-10 block w-full rounded-lg py-2.5 text-sm transition-colors ${
                            !isEditing
                              ? "bg-surface-subtle text-foreground-secondary border border-border-subtle cursor-not-allowed opacity-80"
                              : "bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Email (Read-Only) */}
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                        Email Address
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Mail size={17} className="text-foreground-muted" />
                        </div>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          disabled={true}
                          className="pl-10 block w-full rounded-lg py-2.5 text-sm bg-surface-subtle text-foreground-secondary border border-border-subtle cursor-not-allowed opacity-80"
                        />
                      </div>
                      <p className="mt-1 text-xs text-foreground-muted">
                        Primary account email is verified and cannot be changed directly.
                      </p>
                    </div>

                    {/* Date of Birth & Gender */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                          Date of Birth
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Calendar size={17} className="text-foreground-muted" />
                          </div>
                          <input
                            type="date"
                            name="dateOfBirth"
                            value={formData.dateOfBirth}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                            className={`pl-10 block w-full rounded-lg py-2.5 text-sm transition-colors ${
                              !isEditing
                                ? "bg-surface-subtle text-foreground-secondary border border-border-subtle cursor-not-allowed opacity-80"
                                : "bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                            }`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                          Gender (Optional)
                        </label>
                        <select
                          name="gender"
                          value={formData.gender}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`block w-full rounded-lg py-2.5 px-3.5 text-sm transition-colors ${
                            !isEditing
                              ? "bg-surface-subtle text-foreground-secondary border border-border-subtle cursor-not-allowed opacity-80"
                              : "bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                          }`}
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                        Street Address
                      </label>
                      <div className="relative">
                        <div className="absolute top-3 left-3.5 pointer-events-none">
                          <MapPin size={17} className="text-foreground-muted" />
                        </div>
                        <textarea
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          rows="3"
                          className={`pl-10 block w-full rounded-lg p-2.5 text-sm transition-colors ${
                            !isEditing
                              ? "bg-surface-subtle text-foreground-secondary border border-border-subtle cursor-not-allowed opacity-80"
                              : "bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Global Country Selector (Replaces legacy text input) */}
                    <div>
                      <CountrySelector
                        id="user-profile-country"
                        name="country"
                        label="Country"
                        value={formData.country}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        placeholder="Select Country"
                      />
                    </div>

                    {/* City, State, Pin Code */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                          City
                        </label>
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`block w-full rounded-lg py-2.5 px-3.5 text-sm transition-colors ${
                            !isEditing
                              ? "bg-surface-subtle text-foreground-secondary border border-border-subtle cursor-not-allowed opacity-80"
                              : "bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                          State / Province
                        </label>
                        <input
                          type="text"
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`block w-full rounded-lg py-2.5 px-3.5 text-sm transition-colors ${
                            !isEditing
                              ? "bg-surface-subtle text-foreground-secondary border border-border-subtle cursor-not-allowed opacity-80"
                              : "bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                          Pin / Postal Code
                        </label>
                        <input
                          type="text"
                          name="pinCode"
                          value={formData.pinCode}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`block w-full rounded-lg py-2.5 px-3.5 text-sm transition-colors ${
                            !isEditing
                              ? "bg-surface-subtle text-foreground-secondary border border-border-subtle cursor-not-allowed opacity-80"
                              : "bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Phone Numbers */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                          Phone Number
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Phone size={17} className="text-foreground-muted" />
                          </div>
                          <input
                            type="tel"
                            name="phoneNo"
                            value={formData.phoneNo}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                            className={`pl-10 block w-full rounded-lg py-2.5 text-sm transition-colors ${
                              !isEditing
                                ? "bg-surface-subtle text-foreground-secondary border border-border-subtle cursor-not-allowed opacity-80"
                                : "bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                            }`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                          Alternative Phone (Optional)
                        </label>
                        <input
                          type="tel"
                          name="alternativePhoneNo"
                          value={formData.alternativePhoneNo}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`block w-full rounded-lg py-2.5 px-3.5 text-sm transition-colors ${
                            !isEditing
                              ? "bg-surface-subtle text-foreground-secondary border border-border-subtle cursor-not-allowed opacity-80"
                              : "bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Save Changes Button */}
                    {isEditing && (
                      <div className="flex justify-end pt-4 border-t border-border-subtle">
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="flex items-center px-6 py-2.5 bg-action-primary text-white font-semibold rounded-xl hover:bg-action-primary-hover shadow-warm-xs disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
                        >
                          {isSaving ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                              Saving Profile...
                            </>
                          ) : (
                            <>
                              <Save size={18} className="mr-2" />
                              Save Changes
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              )}

              {/* ---------------- Tab 2: Account & Security Settings ---------------- */}
              {activeTab === "account" && (
                <div className="p-6 md:p-8 space-y-8">
                  <div>
                    <h2 className="text-xl font-bold font-display text-foreground">
                      Account Security & Preferences
                    </h2>
                    <p className="text-xs text-foreground-muted mt-0.5">
                      Configure multi-factor authentication and manage your account password
                    </p>
                  </div>

                  {/* --- 2FA Section --- */}
                  <div className="bg-surface-subtle/60 rounded-xl border border-border-default p-5 md:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
                      <div className="flex items-start sm:items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            twoFactorStatus.enabled
                              ? "bg-status-success-bg text-status-success"
                              : "bg-action-primary/10 text-action-primary"
                          }`}
                        >
                          {twoFactorStatus.enabled ? (
                            <ShieldCheck size={24} />
                          ) : (
                            <ShieldAlert size={24} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground text-base">
                              Two-Factor Authentication (2FA)
                            </h3>
                            <span
                              className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                                twoFactorStatus.enabled
                                  ? "bg-status-success-bg text-status-success"
                                  : "bg-surface border border-border-default text-foreground-muted"
                              }`}
                            >
                              {twoFactorStatus.enabled ? "Active" : "Disabled"}
                            </span>
                          </div>
                          <p className="text-xs text-foreground-secondary mt-1">
                            {twoFactorStatus.enabled
                              ? "Your account is protected by standard RFC 6238 TOTP authentication."
                              : "Add an extra layer of defense using Google Authenticator, Authy, or 1Password."}
                          </p>
                        </div>
                      </div>

                      {/* 2FA Action Buttons */}
                      <div className="flex items-center gap-2.5">
                        {twoFactorStatus.enabled ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setShowRegenerateModal(true)}
                              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-border-default text-foreground hover:bg-canvas-subtle transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <RefreshCw size={14} />
                              New Recovery Codes
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowDisableModal(true)}
                              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-action-destructive/10 text-action-destructive hover:bg-action-destructive/20 transition-colors cursor-pointer"
                            >
                              Disable 2FA
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={handleStartEnable2fa}
                            disabled={isEnrolling}
                            className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-action-primary text-white hover:bg-action-primary-hover shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-60"
                          >
                            {isEnrolling ? (
                              <>
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Generating...
                              </>
                            ) : (
                              <>
                                <Key size={14} />
                                Enable 2FA
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 text-xs text-foreground-muted space-y-1">
                      <p>
                        • When enabled, logging in requires entering a one-time 6-digit code after password verification.
                      </p>
                      <p>
                        • Replay attack prevention rejects repeated submission of expired or used codes.
                      </p>
                    </div>
                  </div>

                  {/* --- Email OTP on Login Section (Hidden for Google-only accounts) --- */}
                  {!isGoogleOnly && (
                    <div className="bg-surface-subtle/60 rounded-xl border border-border-default p-5 md:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
                        <div className="flex items-start sm:items-center gap-3">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              twoFactorStatus.emailOtpEnabled
                                ? "bg-status-success-bg text-status-success"
                                : "bg-blue-500/10 text-blue-500"
                            }`}
                          >
                            <Mail size={24} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground text-base">
                                Email OTP on Password Login
                              </h3>
                              <span
                                className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                                  twoFactorStatus.emailOtpEnabled
                                    ? "bg-status-success-bg text-status-success"
                                    : "bg-surface border border-border-default text-foreground-muted"
                                }`}
                              >
                                {twoFactorStatus.emailOtpEnabled ? "Active" : "Disabled"}
                              </span>
                            </div>
                            <p className="text-xs text-foreground-secondary mt-1">
                              {twoFactorStatus.emailOtpEnabled
                                ? "A 6-digit one-time code will be dispatched to your registered email upon password verification."
                                : "Require an extra one-time email code when signing in with your password."}
                            </p>
                          </div>
                        </div>

                        {/* Email OTP Action Buttons */}
                        <div className="flex items-center gap-2.5">
                          {twoFactorStatus.emailOtpEnabled ? (
                            <button
                              type="button"
                              onClick={() => setShowDisableEmailOtpModal(true)}
                              disabled={isTogglingEmailOtp}
                              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-action-destructive/10 text-action-destructive hover:bg-action-destructive/20 transition-colors cursor-pointer"
                            >
                              Disable Email OTP
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleEnableEmailOtp}
                              disabled={isTogglingEmailOtp}
                              className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-60"
                            >
                              {isTogglingEmailOtp ? (
                                <>
                                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                  Enabling...
                                </>
                              ) : (
                                <>
                                  <Mail size={14} />
                                  Enable Email OTP
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 text-xs text-foreground-muted space-y-1">
                        <p>
                          • If both Authenticator 2FA and Email OTP are enabled, you will verify TOTP first, followed by Email OTP.
                        </p>
                        <p>
                          • Google OAuth logins are deliberately exempt from application TOTP/Email OTP.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* --- Password Change Section or Google Sign-In Account Notice --- */}
                  {isGoogleOnly ? (
                    <div className="bg-surface-subtle/60 rounded-xl border border-border-default p-5 md:p-6">
                      <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                          </svg>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground text-base">
                              Google Sign-In Account
                            </h3>
                            <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                              OAuth Provider
                            </span>
                          </div>
                          <p className="text-xs text-foreground-secondary leading-relaxed">
                            This account uses Google sign-in and does not have a local password set. Password changes and password-based login settings are unavailable.
                          </p>
                          <p className="text-xs text-foreground-muted pt-1">
                            Your credentials and primary sign-in security are managed through your Google Account. You can still configure application-level Authenticator 2FA above.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-surface-subtle/60 rounded-xl border border-border-default p-5 md:p-6">
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border-subtle">
                        <div className="w-10 h-10 rounded-xl bg-action-primary/10 text-action-primary flex items-center justify-center flex-shrink-0">
                          <Lock size={20} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground text-base">
                            Change Account Password
                          </h3>
                          <p className="text-xs text-foreground-muted">
                            Choose a strong, unique password of at least 8 characters
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handlePasswordChange} className="space-y-4 max-w-xl">
                        {/* Current Password */}
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                            Current Password
                          </label>
                          <div className="relative">
                            <input
                              type={showCurrentPassword ? "text" : "password"}
                              value={passwordData.currentPassword}
                              onChange={(e) =>
                                setPasswordData({
                                  ...passwordData,
                                  currentPassword: e.target.value,
                                })
                              }
                              required
                              placeholder="Enter your current password"
                              className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-lg bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground cursor-pointer"
                            >
                              {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>

                        {/* New Password */}
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                            New Password
                          </label>
                          <div className="relative">
                            <input
                              type={showNewPassword ? "text" : "password"}
                              value={passwordData.newPassword}
                              onChange={(e) =>
                                setPasswordData({
                                  ...passwordData,
                                  newPassword: e.target.value,
                                })
                              }
                              required
                              placeholder="Minimum 8 characters"
                              className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-lg bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground cursor-pointer"
                            >
                              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>

                        {/* Confirm New Password */}
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                            Confirm New Password
                          </label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              value={passwordData.confirmPassword}
                              onChange={(e) =>
                                setPasswordData({
                                  ...passwordData,
                                  confirmPassword: e.target.value,
                                })
                              }
                              required
                              placeholder="Repeat new password"
                              className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-lg bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground cursor-pointer"
                            >
                              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>

                        <div className="pt-2">
                          <button
                            type="submit"
                            disabled={isChangingPassword}
                            className="px-5 py-2.5 bg-action-primary text-white font-semibold rounded-lg hover:bg-action-primary-hover shadow-xs transition-colors cursor-pointer text-xs disabled:opacity-60 flex items-center gap-2"
                          >
                            {isChangingPassword ? (
                              <>
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Updating Password...
                              </>
                            ) : (
                              "Update Password"
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ---------------- 2FA Setup & Enrollment Modal ---------------- */}
      {showEnableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-surface text-foreground rounded-2xl border border-border-default shadow-2xl p-6 sm:p-8 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-action-primary/10 text-action-primary flex items-center justify-center flex-shrink-0">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-display text-foreground">
                    {generatedRecoveryCodes ? "2FA Setup Complete!" : "Set Up Two-Factor Authentication"}
                  </h3>
                  <p className="text-xs text-foreground-muted">RFC 6238 Authenticator App</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEnableModal(false);
                  setSetupData(null);
                  setGeneratedRecoveryCodes(null);
                  fetch2faStatus();
                }}
                className="text-foreground-muted hover:text-foreground p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Step 3: Show Recovery Codes once enabled */}
            {generatedRecoveryCodes ? (
              <div className="space-y-4">
                <div className="bg-status-success-bg border border-status-success/30 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-status-success flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-foreground leading-relaxed">
                    <span className="font-bold block text-sm mb-1 text-status-success">
                      Save your single-use recovery codes
                    </span>
                    If you lose access to your phone or authenticator app, these emergency codes are the only way to sign in. Each code can be used exactly once.
                  </div>
                </div>

                <div className="bg-surface-subtle border border-border-default rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-2.5 font-mono text-sm text-center">
                    {generatedRecoveryCodes.map((code, idx) => (
                      <div
                        key={idx}
                        className="py-1.5 px-2 bg-surface rounded-md border border-border-subtle tracking-wider font-semibold"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => handleCopyCodes(generatedRecoveryCodes)}
                    className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg border border-border-default bg-surface hover:bg-canvas-subtle transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Copy size={14} />
                    Copy All Codes
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadCodes(generatedRecoveryCodes)}
                    className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg border border-border-default bg-surface hover:bg-canvas-subtle transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download size={14} />
                    Download (.txt)
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEnableModal(false);
                      setSetupData(null);
                      setGeneratedRecoveryCodes(null);
                      fetch2faStatus();
                    }}
                    className="w-full py-2.5 bg-action-primary text-white text-xs font-semibold rounded-lg hover:bg-action-primary-hover transition-colors cursor-pointer"
                  >
                    I Have Safely Saved My Codes
                  </button>
                </div>
              </div>
            ) : setupData ? (
              /* Steps 1 & 2: QR Code & Verification Input */
              <div className="space-y-5">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-action-primary block mb-1">
                    Step 1: Scan with Authenticator App
                  </span>
                  <p className="text-xs text-foreground-secondary mb-3">
                    Open Google Authenticator, Authy, or your password manager and scan this QR code:
                  </p>
                  <div className="flex justify-center p-4 bg-white rounded-xl border border-border-default shadow-xs max-w-xs mx-auto">
                    <img
                      src={setupData.qrCodeDataUrl || setupData.qrCode}
                      alt="TOTP QR Code"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground-secondary block mb-1">
                    Can&apos;t scan? Enter key manually
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={setupData.manualEntryKey || setupData.secret}
                      className="w-full px-3 py-1.5 text-xs font-mono bg-surface-subtle border border-border-subtle rounded-md text-foreground select-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(setupData.manualEntryKey || setupData.secret);
                        toast.success("Secret key copied!");
                      }}
                      className="p-1.5 text-xs rounded-md border border-border-default hover:bg-canvas-subtle text-foreground cursor-pointer flex-shrink-0"
                      title="Copy Key"
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleConfirm2fa} className="space-y-4 pt-2 border-t border-border-subtle">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-action-primary block mb-1">
                      Step 2: Enter 6-Digit Verification Code
                    </span>
                    <p className="text-xs text-foreground-secondary mb-2">
                      Enter the 6-digit code displayed in your authenticator app to verify setup:
                    </p>
                    <input
                      type="text"
                      autoFocus
                      autoComplete="one-time-code"
                      placeholder="123456"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-center text-lg tracking-widest font-mono bg-surface text-foreground border border-border-default rounded-lg focus:outline-none focus:border-action-primary focus:ring-2 focus:ring-ring-focus"
                      required
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowEnableModal(false)}
                      className="flex-1 py-2.5 text-xs font-semibold rounded-lg border border-border-default hover:bg-canvas-subtle cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isEnrolling || verificationCode.length < 6}
                      className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-action-primary text-white hover:bg-action-primary-hover disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isEnrolling ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Verifying...
                        </>
                      ) : (
                        "Confirm & Enable"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ---------------- 2FA Disablement Modal ---------------- */}
      {showDisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-surface text-foreground rounded-2xl border border-border-default shadow-2xl p-6 sm:p-8 animate-scale-in">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-action-destructive/10 text-action-destructive flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-display text-foreground">
                    Disable Two-Factor Authentication
                  </h3>
                  <p className="text-xs text-foreground-muted">Security Verification Required</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDisableModal(false)}
                className="text-foreground-muted hover:text-foreground p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-foreground-secondary mb-4 leading-relaxed">
              {isGoogleOnly
                ? "Disabling 2FA decreases your account security. To proceed, please enter your current authenticator code or a recovery code."
                : "Disabling 2FA decreases your account security. To proceed, please confirm your account password and a valid code."}
            </p>

            <form onSubmit={handleDisable2fa} className="space-y-4">
              {!isGoogleOnly && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                    Account Password
                  </label>
                  <input
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                  />
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
                    {disableUseRecovery ? "Single-Use Recovery Code" : "Authenticator Code"}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setDisableUseRecovery(!disableUseRecovery);
                      setDisableCode("");
                    }}
                    className="text-[11px] text-action-primary hover:underline cursor-pointer"
                  >
                    {disableUseRecovery ? "Use 6-digit code" : "Use recovery code"}
                  </button>
                </div>
                <input
                  type="text"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder={disableUseRecovery ? "XXXX-XXXX" : "123456"}
                  maxLength={disableUseRecovery ? 10 : 6}
                  required
                  className="w-full px-3.5 py-2.5 text-center font-mono tracking-widest text-sm rounded-lg bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisableModal(false)}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-lg border border-border-default hover:bg-canvas-subtle transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDisabling || !disablePassword || !disableCode}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-action-destructive text-white hover:bg-action-destructive/90 disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  {isDisabling ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Disabling...
                    </>
                  ) : (
                    "Confirm Disable"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- 2FA Regenerate Recovery Codes Modal ---------------- */}
      {showRegenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-surface text-foreground rounded-2xl border border-border-default shadow-2xl p-6 sm:p-8 animate-scale-in">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-action-primary/10 text-action-primary flex items-center justify-center flex-shrink-0">
                  <RefreshCw size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-display text-foreground">
                    Regenerate Recovery Codes
                  </h3>
                  <p className="text-xs text-foreground-muted">Invalidates All Prior Codes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRegenerateModal(false)}
                className="text-foreground-muted hover:text-foreground p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-foreground-secondary mb-4 leading-relaxed">
              {isGoogleOnly
                ? "Generating new recovery codes will instantly invalidate all previous recovery codes."
                : "Generating new recovery codes will instantly invalidate all previous recovery codes. Please confirm your account password."}
            </p>

            <form onSubmit={handleRegenerateCodes} className="space-y-4">
              {!isGoogleOnly && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                    Account Password
                  </label>
                  <input
                    type="password"
                    value={regeneratePassword}
                    onChange={(e) => setRegeneratePassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegenerateModal(false)}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-lg border border-border-default hover:bg-canvas-subtle transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRegenerating || (!isGoogleOnly && !regeneratePassword)}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-action-primary text-white hover:bg-action-primary-hover disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  {isRegenerating ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Generating...
                    </>
                  ) : (
                    "Generate Codes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- Disable Email OTP Modal ---------------- */}
      {showDisableEmailOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-surface text-foreground rounded-2xl border border-border-default shadow-2xl p-6 sm:p-8 animate-scale-in">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-action-destructive/10 text-action-destructive flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-display text-foreground">
                    Disable Email OTP
                  </h3>
                  <p className="text-xs text-foreground-muted">Password Confirmation Required</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDisableEmailOtpModal(false);
                  setDisableEmailOtpPassword("");
                }}
                className="text-foreground-muted hover:text-foreground p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-foreground-secondary mb-4 leading-relaxed">
              Disabling Email OTP removes the secondary email verification requirement from your password login. Enter your password to confirm.
            </p>

            <form onSubmit={handleDisableEmailOtp} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary mb-1.5 block">
                  Account Password
                </label>
                <input
                  type="password"
                  value={disableEmailOtpPassword}
                  onChange={(e) => setDisableEmailOtpPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-surface text-foreground border border-border-default focus:border-action-primary focus:ring-2 focus:ring-ring-focus outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDisableEmailOtpModal(false);
                    setDisableEmailOtpPassword("");
                  }}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-lg border border-border-default hover:bg-canvas-subtle transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTogglingEmailOtp || !disableEmailOtpPassword}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-action-destructive text-white hover:bg-action-destructive-hover disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  {isTogglingEmailOtp ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Disabling...
                    </>
                  ) : (
                    "Confirm Disable"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-surface/80 border-t border-border-default mt-12 transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="text-center text-foreground-muted text-xs font-medium">
            &copy; {new Date().getFullYear()} AuctionX. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ProfileSettingsPage;
