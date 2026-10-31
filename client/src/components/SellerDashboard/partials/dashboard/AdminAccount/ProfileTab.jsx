import React, { useState } from "react";
import axios from "axios";
import { formatCurrency } from "../../../../../lib/utils";

function ProfileTab({ 
  profile, 
  onUpdateProfile, 
  csrfToken, 
  API_BASE_URL, 
  getRequestConfig,
  showStatusMessage 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});

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
      const config = {
        ...getRequestConfig(),
        headers: {
          ...getRequestConfig().headers,
          "Content-Type": "multipart/form-data",
        }
      };

      const response = await axios.post(
        `${API_BASE_URL}/api/auth/seller/upload-profile-pic`,
        formData,
        config
      );
      
      const updatedProfile = {
        ...profile,
        profilePic: [response.data.image]
      };
      
      onUpdateProfile(updatedProfile);
      setEditedProfile(updatedProfile);
      
      showStatusMessage("Profile picture uploaded successfully", "success");
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      showStatusMessage("Failed to upload profile picture", "error");
    }
  };

  const handleSaveProfile = async () => {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/auth/seller/updateUserProfile/${profile.email}`,
        editedProfile,
        getRequestConfig()
      );
      
      onUpdateProfile(response.data.user);
      setIsEditing(false);
      showStatusMessage("Profile updated successfully", "success");
    } catch (error) {
      console.error("Error updating profile:", error);
      showStatusMessage("Failed to update profile", "error");
    }
  };

  const getProfilePicUrl = () => {
    if (isEditing && editedProfile.profilePic?.length > 0) {
      return editedProfile.profilePic[0].secure_url;
    }
    if (profile.profilePic?.length > 0) {
      return profile.profilePic[0].secure_url;
    }
    return "/assets/default-avatar.png";
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 relative">
            <img
              src={getProfilePicUrl()}
              alt="User Profile"
              className="rounded-full w-full h-full object-cover border-2 border-gray-200 dark:border-gray-700"
            />
            {isEditing && (
              <label className="absolute bottom-0 right-0 bg-blue-500 p-1 rounded-full cursor-pointer">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleAvatarChange}
                  accept="image/*"
                />
              </label>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {profile.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {profile.role}
            </p>
          </div>
        </div>

        {!isEditing ? (
          <button
            onClick={handleEditProfile}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
          >
            Edit Profile
          </button>
        ) : (
          <div className="space-x-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProfile}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Full Name
          </label>
          {isEditing ? (
            <input
              type="text"
              name="name"
              value={editedProfile.name || ""}
              onChange={handleProfileChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          ) : (
            <p className="text-gray-800 dark:text-gray-100">
              {profile.name}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email Address
          </label>
          <p className="text-gray-800 dark:text-gray-100">
            {profile.email}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Phone Number
          </label>
          {isEditing ? (
            <input
              type="tel"
              name="phoneNo"
              value={editedProfile.phoneNo || ""}
              onChange={handleProfileChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          ) : (
            <p className="text-gray-800 dark:text-gray-100">
              {profile.phoneNo || "Not provided"}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Alternative Phone Number
          </label>
          {isEditing ? (
            <input
              type="tel"
              name="alternativePhoneNo"
              value={editedProfile.alternativePhoneNo || ""}
              onChange={handleProfileChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          ) : (
            <p className="text-gray-800 dark:text-gray-100">
              {profile.alternativePhoneNo || "Not provided"}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Gender
          </label>
          {isEditing ? (
            <select
              name="gender"
              value={editedProfile.gender || ""}
              onChange={handleProfileChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">Not specified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          ) : (
            <p className="text-gray-800 dark:text-gray-100">
              {profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : "Not specified"}
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Address
          </label>
          {isEditing ? (
            <input
              type="text"
              name="address"
              value={editedProfile.address || ""}
              onChange={handleProfileChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          ) : (
            <p className="text-gray-800 dark:text-gray-100">
              {profile.address || "Not provided"}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            City
          </label>
          {isEditing ? (
            <input
              type="text"
              name="city"
              value={editedProfile.city || ""}
              onChange={handleProfileChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          ) : (
            <p className="text-gray-800 dark:text-gray-100">
              {profile.city || "Not provided"}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            State
          </label>
          {isEditing ? (
            <input
              type="text"
              name="state"
              value={editedProfile.state || ""}
              onChange={handleProfileChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          ) : (
            <p className="text-gray-800 dark:text-gray-100">
              {profile.state || "Not provided"}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Country
          </label>
          {isEditing ? (
            <input
              type="text"
              name="country"
              value={editedProfile.country || ""}
              onChange={handleProfileChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          ) : (
            <p className="text-gray-800 dark:text-gray-100">
              {profile.country || "Not provided"}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Pin Code
          </label>
          {isEditing ? (
            <input
              type="text"
              name="pinCode"
              value={editedProfile.pinCode || ""}
              onChange={handleProfileChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          ) : (
            <p className="text-gray-800 dark:text-gray-100">
              {profile.pinCode || "Not provided"}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Role
          </label>
          <p className="text-gray-800 dark:text-gray-100">
            {profile.role === "admin" ? "Administrator" : "User"}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Verification Status
          </label>
          <p className="text-gray-800 dark:text-gray-100">
            {profile.isVerified ? "Verified" : "Not Verified"}
          </p>
        </div>

        {profile.amount !== undefined && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount
            </label>
            <p className="text-gray-800 dark:text-gray-100">
              {formatCurrency(profile.amount || 0)}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Account Created
          </label>
          <p className="text-gray-800 dark:text-gray-100">
            {new Date(profile.createdAt).toLocaleDateString()}
          </p>
        </div>

        {profile.updatedAt && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Last Updated
            </label>
            <p className="text-gray-800 dark:text-gray-100">
              {new Date(profile.updatedAt).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfileTab;