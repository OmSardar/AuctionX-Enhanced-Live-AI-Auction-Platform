import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import AvatarSelector from "./AvatarSelector";
import FAQList from "../FAQ/FAQ";
// import axios from "axios";
import { completeLogout } from "../../../redux/slices/authThunks";
import { setUser as setAuthUser } from "../../../features/auth/state/authSlice";
import axios from "../../../utils/axiosConfig";
const API_URL = import.meta.env.VITE_API_URL;
const ProfilePage = () => {
  const dispatch = useDispatch();
  const auth = useSelector((state) => state.auth); // Get auth state from Redux
  const [isModalOpen, setIsModalOpen] = useState(false);

  const DefaultProfilePicture = "/default-profile.png";

  // Get user data including email directly from Redux
  const userData = auth.user;
  const email = userData?.email;

  const [user, setUser] = useState({
    name: "",
    email: email || "", // Use email from Redux only
    address: "",
    phoneNo: "",
    pinCode: "",
    state: "",
    city: "",
    alternativePhoneNo: "",
    gender: "",
    profilePic: [{ secure_url: "" }],
  });
  const [profilePicUrl, setProfilePicUrl] = useState("");
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(completeLogout());
    // Optionally navigate to home/login page
    navigate("/login");
  };
  // Fetch user data and profile picture on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (!email) return;

      try {
        const userResponse = await axios.get(
          `${API_URL}/api/auth/user/user/${email}`,
          {
            withCredentials: true,
            showGlobalLoading: true, // Enable loading
            loadingMessage: "Loading profile...", // Custom message
          }
        );

        if (userResponse.data) {
          const freshData = {
            ...userResponse.data,
            pinCode: userResponse.data.pinCode || "",
            state: userResponse.data.state || "",
            city: userResponse.data.city || "",
            alternativePhoneNo: userResponse.data.alternativePhoneNo || "",
          };
          setUser(freshData);

          let resolvedPic = "";
          if (
            userResponse.data.profilePic &&
            userResponse.data.profilePic.length > 0
          ) {
            resolvedPic = userResponse.data.profilePic[0].secure_url;
            setProfilePicUrl(resolvedPic);
          } else {
            const picResponse = await axios.get(
              `${API_URL}/api/auth/user/profile-pic?email=${email}`
            );
            if (
              picResponse.data &&
              picResponse.data.profilePic &&
              picResponse.data.profilePic.length > 0
            ) {
              resolvedPic = picResponse.data.profilePic[0].secure_url;
              setProfilePicUrl(resolvedPic);
            }
          }

          // Keep Redux auth state in sync with fresh profile data
          dispatch(
            setAuthUser({
              ...auth.user,
              ...freshData,
              profilePic: userResponse.data.profilePic || auth.user?.profilePic,
              googlePhoto: userResponse.data.googlePhoto || auth.user?.googlePhoto,
              selectedAvatar: userResponse.data.selectedAvatar || auth.user?.selectedAvatar,
            })
          );
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();

    // ✅ Listen to profile update events from AvatarSelector
    const handleProfileUpdated = () => {
      fetchUserData(); // re-fetch when image is updated
    };

    window.addEventListener("profile-updated", handleProfileUpdated);

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
  }, [email]);

  // Prevent body scrolling and handle Escape key when modal is open
  useEffect(() => {
    if (isModalOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";

      const handleKeyDown = (e) => {
        if (e.key === "Escape") {
          closeModal();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = originalStyle;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isModalOpen]);

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSectionClick = (route) => {
    navigate(route);
  };

  // Color schemes for profile details cards
  const colorSchemes = [
    "bg-surface border-l-4 border-primary shadow-warm-xs",
    "bg-canvas-subtle border-l-4 border-primary-600 shadow-warm-xs",
    "bg-surface border-l-4 border-primary-400 shadow-warm-xs",
    "bg-canvas-subtle border-l-4 border-accent shadow-warm-xs",
    "bg-surface border-l-4 border-primary-700 shadow-warm-xs",
    "bg-canvas-subtle border-l-4 border-primary-500 shadow-warm-xs",
    "bg-surface border-l-4 border-primary-800 shadow-warm-xs",
    "bg-canvas-subtle border-l-4 border-accent-dark shadow-warm-xs",
    "bg-surface border-l-4 border-primary shadow-warm-xs",
  ];

  return (
    <div className="min-h-screen bg-canvas text-foreground p-4 sm:p-8">
      {/* Profile Header with Background Gradient */}
      <div
        className="relative h-48 sm:h-64 md:h-80 w-full rounded-2xl bg-gradient-to-r from-primary-600/20 via-surface to-primary-400/20 border border-border shadow-warm-sm overflow-visible"
      >
        {/* Profile Picture */}
        <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
          <div className="relative">
            <img
              src={profilePicUrl || DefaultProfilePicture}
              alt="Profile"
              referrerPolicy="no-referrer"
              className="w-32 h-32 sm:w-44 sm:h-44 object-cover rounded-full border-4 border-surface shadow-warm-md bg-canvas-subtle"
              onError={(e) =>
                (e.target.src = "/default-profile.png")
              }
            />
            {/* Plus Button to Open Modal */}
            <div
              className="absolute bottom-1 right-1 bg-primary rounded-full w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-white border-2 border-surface cursor-pointer hover:bg-primary-hover shadow-warm-sm transition-transform hover:scale-105"
              onClick={openModal}
            >
              <span className="text-xl font-bold">+</span>
            </div>
          </div>
        </div>
      </div>

      {/* Avatar Selection Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs bg-slate-950/70 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            className="bg-surface p-5 sm:p-7 rounded-2xl shadow-xl max-w-3xl w-full relative border border-border-default max-h-[92vh] overflow-y-auto"
            aria-modal="true"
            role="dialog"
            aria-labelledby="change-avatar-title"
          >
            <button
              className="absolute top-4 right-4 text-foreground-muted hover:text-foreground text-lg p-1.5 rounded-lg hover:bg-surface-subtle transition-colors z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus cursor-pointer"
              onClick={closeModal}
              aria-label="Close modal"
            >
              ✕
            </button>
            <AvatarSelector
              onClose={closeModal}
              user={user}
              activeProfilePic={profilePicUrl}
            />
          </div>
        </div>
      )}

      {/* User Details */}
      <div className="bg-surface p-6 rounded-2xl shadow-warm-sm border border-border mt-20 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold font-display text-foreground">User Details</h2>
          {email && (
            <button
              onClick={handleLogout}
              className="bg-destructive hover:bg-destructive/90 text-white px-4 py-2 rounded-xl transition-colors cursor-pointer text-sm font-semibold shadow-warm-xs flex items-center"
            >
              <i className="fas fa-sign-out-alt mr-2"></i>
              Logout
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {[
            { label: "Full Name", value: user.name },
            { label: "Email", value: user.email },
            { label: "Address", value: user.address },
            { label: "Phone Number", value: user.phoneNo },
            { label: "Pin Code", value: user.pinCode },
            { label: "State", value: user.state },
            { label: "City", value: user.city },
            { label: "Alternative Phone No", value: user.alternativePhoneNo },
            {
              label: "Gender",
              value: user.gender
                ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1)
                : "",
            },
          ].map((field, index) => (
            <div
              key={field.label}
              className={`p-3.5 rounded-xl border transition-all hover:shadow-warm-xs ${
                colorSchemes[index % colorSchemes.length]
              }`}
            >
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">
                {field.label}
              </p>
              <p
                className="font-semibold text-foreground truncate"
                title={field.value || "Not specified"}
              >
                {field.value || "Not specified"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Sections Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-8">
        {[
          { name: "My Bids", icon: "fa-box", route: "/bids" },
          { name: "My Payments", icon: "fa-credit-card", route: "/balance" },
          { name: "My Wallet", icon: "fa-wallet", route: "/balance" },
          {
            name: "Scheduled Bids",
            icon: "fa-map-marker-alt",
            route: "/scheduledbids",
          },
          {
            name: "Profile Settings",
            icon: "fa-user",
            route: "/profilesettings",
          },
          { name: "Help & Support", icon: "fa-life-ring", route: "/support" },
          { name: "Our Story", icon: "fa-book-open", route: "/our-story" },
          { name: "Feedback", icon: "fa-heart", route: "/feedback" },
          { name: "FanBook", icon: "fa-heart", route: "/fanbook" },
          {
            name: "Daily Challenges",
            icon: "fa-flag-checkered",
            route: "/daily-challenges",
          },
        ].map((section) => (
          <div
            key={section.name}
            className="bg-surface p-5 sm:p-6 rounded-2xl shadow-warm-xs hover:shadow-warm-md border border-border hover:border-primary/40 transition-all duration-300 text-center cursor-pointer group"
            onClick={() => handleSectionClick(section.route)}
          >
            <div className="flex flex-col items-center mb-3">
              <i
                className={`fas ${section.icon} text-3xl text-primary group-hover:scale-110 transition-transform mb-2`}
              ></i>
              <h2 className="text-lg font-bold font-display text-foreground group-hover:text-primary transition-colors">
                {section.name}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Details about {section.name.toLowerCase()} go here...
            </p>
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <FAQList />
    </div>
  );
};

export default ProfilePage;
