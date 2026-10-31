import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { State, isValidCity, normalizeCity } from "../../../utils/geoData";
import { toast } from "react-toastify";
import validator from "validator";
import { isPossiblePhoneNumber } from "libphonenumber-js";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css"; // Optional: for default styling
import { CountrySelector } from "../../../components/ui/CountrySelector";
const API_URL = import.meta.env.VITE_API_URL;
import { fetchCsrfToken } from "../../../redux/slices/csrfSecuritySlice";
import { setUser } from "../../../features/auth/state/authSlice";

const VerifyProfilePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Get user data from Redux
  const auth = useSelector((state) => state.auth);
  const userData = auth.user;
  const isUserVerified = auth.user?.isVerified;

  // Redirect verified users to homepage only if their profile is already complete
  useEffect(() => {
    if (isUserVerified && (!userData?.isNewUser || (userData?.phoneNo && userData?.address))) {
      navigate("/");
    }
  }, [isUserVerified, userData, navigate]);

  // Get URL parameters
  const urlParams = new URLSearchParams(location.search);
  const loginType = urlParams.get("loginType") || auth.loginType;

  // Determine if this is a Google login or regular login
  const isGoogleLogin = loginType === "google";

  // Get user data from Redux, location state, or URL params
  const name = userData?.name || location.state?.name || urlParams.get("name");
  const email = userData?.email || location.state?.email || urlParams.get("email");

  // Form state
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [alternativePhoneNo, setAlternativePhoneNo] = useState("");

  // Component state
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Form validation errors
  const [formErrors, setFormErrors] = useState({
    phone: "",
    alternativePhoneNo: "",
    pinCode: "",
    state: "",
    city: "",
    country: "",
  });

  // Lists for dropdowns
  const [states, setStates] = useState([]);

  //------------------------------------testing-----------------------------------//
  const { token: csrfToken } = useSelector((state) => state.csrf);

  useEffect(() => {
    if (!csrfToken && !loading) {
      dispatch(fetchCsrfToken());
    }
  }, [dispatch, csrfToken, loading]);

  // Load states when country changes
  useEffect(() => {
    if (country) {
      const countryStates = State.getStatesOfCountry(country);
      setStates(countryStates);
      setState(""); // Reset state when country changes
      setCity(""); // Reset city when country changes
    } else {
      setStates([]);
      setState("");
      setCity("");
    }
  }, [country]);

  // Reset city when state changes
  useEffect(() => {
    setCity("");
  }, [state]);

  // Check if name or email is missing
  useEffect(() => {
    if (!name || !email) {
      const missingFields = [];
      if (!name) missingFields.push("name");
      if (!email) missingFields.push("email");

      console.error(`Missing data: ${missingFields.join(", ")}`);
      setError(`Required data is missing: ${missingFields.join(", ")}`);
    } else {
      setError(""); // Reset error if all data is present
    }
  }, [name, email, location]);

  // Clean up object URL when component unmounts or new file is selected
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Validation functions
  const validateMobileNumber = (phoneNumber) => {
    if (!phoneNumber) return false;
    return isPossiblePhoneNumber(phoneNumber);
  };

  const validateAlternativeMobileNumber = (altNumber, primaryNumber) => {
    if (!altNumber) return true; // Optional field

    // Check if same as primary number
    if (altNumber === primaryNumber) {
      return "same";
    }

    // Advanced validation
    return isPossiblePhoneNumber(altNumber) ? true : false;
  };

  const validatePinCode = (pinCode) => {
    return validator.isPostalCode(pinCode, "any");
  };

  const validateForm = () => {
    let isValid = true;
    const errors = {
      phone: "",
      alternativePhoneNo: "",
      pinCode: "",
      state: "",
      city: "",
      country: "",
    };

    // Validate phone number
    if (!validateMobileNumber(phone)) {
      errors.phone = "Please enter a valid mobile number";
      isValid = false;
    }

    // Validate alternative phone number if provided
    if (alternativePhoneNo) {
      const altPhoneValidation = validateAlternativeMobileNumber(
        alternativePhoneNo,
        phone
      );

      if (altPhoneValidation === "same") {
        errors.alternativePhoneNo =
          "Alternative number cannot be the same as primary number";
        isValid = false;
      } else if (altPhoneValidation === false) {
        errors.alternativePhoneNo =
          "Please enter a valid alternative mobile number";
        isValid = false;
      }
    }

    // Validate PIN code
    if (!validatePinCode(pinCode)) {
      errors.pinCode = "Please enter a valid PIN code";
      isValid = false;
    }

    // Validate country, state, city
    if (!country) {
      errors.country = "Please select a country";
      isValid = false;
    }

    if (!state) {
      errors.state = "Please select a state";
      isValid = false;
    }

    if (!isValidCity(city)) {
      errors.city = "Please enter a valid city name";
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Clear previous preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      // Create new preview URL
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
      setFile(selectedFile);
    }
  };

  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!csrfToken) {
      console.error("CSRF token not available yet");
      return;
    }

    // Validate form before submission
    if (!validateForm()) {
      toast.error("Please correct the errors in the form before submitting.");
      return;
    }

    // Check if the user has confirmed the details
    if (!isConfirmed) {
      toast.error("Please confirm your details before submitting.");
      return;
    }

    // Set loading state
    setLoading(true);
    setUploadProgress(0); // Reset upload progress

    try {
      let profileImage = null;

      // Upload file with progress tracking if a file is selected
      if (file) {
        const uploadFormData = new FormData();
        uploadFormData.append("profilePic", file);
        uploadFormData.append("email", email);

        const uploadUrl = API_URL
          ? `${API_URL}/api/auth/user/upload-profile-pic`
          : "/api/auth/user/upload-profile-pic";

        const response = await axios.post(
          uploadUrl,
          uploadFormData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
              ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
            },
            withCredentials: true,
            onUploadProgress: (progressEvent) => {
              const { loaded, total } = progressEvent;
              if (total) {
                const percentCompleted = Math.floor((loaded * 100) / total);
                setUploadProgress(percentCompleted);
              }
            },
          }
        );

        const uploadedAsset = response.data?.image || response.data?.profilePic?.[0];
        if (!uploadedAsset?.secure_url) {
          throw new Error(response.data?.message || "Failed to upload profile picture");
        }

        profileImage = {
          secure_url: uploadedAsset.secure_url,
          public_id: uploadedAsset.public_id || "",
        };
      }

      // Create payload for backend
      const payload = {
        address,
        phoneNo: phone, // Full phone number with country code from PhoneInput
        gender,
        pinCode,
        country,
        state,
        city: normalizeCity(city),
        alternativePhoneNo: alternativePhoneNo || "",
        profilePic: profileImage ? [profileImage] : [],
        email,
        name,
      };

      // Submit profile update to backend
      const profileUpdateResponse = await axios.patch(
        `${API_URL}/api/auth/user/updateProfile`,
        payload,
        {
          headers: {
            "X-CSRF-Token": csrfToken, // ✅ Add CSRF token here
          },
          withCredentials: true, // Ensure cookies are sent
        }
      );

      // Dispatch action to update user in Redux store
      dispatch(
        setUser({
          ...userData,
          ...profileUpdateResponse.data.user,
        })
      );

      setSuccess("Profile updated successfully!");

      // Check if user authenticated via Google OAuth (email already verified by Google)
      const isGoogleAuthUser =
        isGoogleLogin ||
        location.state?.from === "googleLogin" ||
        Boolean(userData?.googlePhoto) ||
        Boolean(profileUpdateResponse.data?.user?.googlePhoto);

      if (isGoogleAuthUser) {
        toast.success("Profile setup complete! Welcome to AuctionX.");
        navigate("/", { replace: true });
        return;
      }

      // Send OTP request before navigating for non-OAuth users
      await axios.post(
        `${API_URL}/api/auth/user/send-otp`,
        { email },
        {
          headers: {
            "X-CSRF-Token": csrfToken, // ✅ Add CSRF token here
          },
          withCredentials: true, // Ensure cookies are sent
        }
      );

      // Navigate to the OTP page with email as a query parameter and source information
      navigate("/OTPverification", {
        state: {
          email,
          from: "verifyProfile", // Add source information
        },
      });
    } catch (error) {
      console.error(
        "Error:",
        error.response ? error.response.data : error.message
      );
      setError(
        error.response
          ? error.response.data.message
          : "An error occurred while updating the profile."
      );
    } finally {
      setLoading(false); // Reset loading state
      setUploadProgress(0); // Reset upload progress after submission
    }
  };

  return (
    <div className="bg-canvas min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 text-foreground transition-colors duration-200">
      <div className="bg-surface p-8 rounded-2xl shadow-card border border-border-subtle w-full max-w-2xl space-y-8">
        <div>
          <h2 className="text-center text-3xl font-display font-bold tracking-tight text-foreground">
            Verify Your Profile
          </h2>
          {error && (
            <p className="mt-2 text-center text-sm text-status-error">{error}</p>
          )}
          {success && (
            <p className="mt-2 text-center text-sm text-status-success">{success}</p>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-foreground-secondary"
              >
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={name || ""}
                disabled
                className="mt-1 block w-full rounded-lg border border-border-subtle bg-surface-subtle py-2.5 px-3.5 text-foreground-muted shadow-xs"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground-secondary"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email || ""}
                disabled
                className="mt-1 block w-full rounded-lg border border-border-subtle bg-surface-subtle py-2.5 px-3.5 text-foreground-muted shadow-xs"
              />
            </div>

            <div>
              <label
                htmlFor="address"
                className="block text-sm font-medium text-foreground-secondary"
              >
                Address
              </label>
              <input
                id="address"
                type="text"
                placeholder="Enter your address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-border-subtle bg-surface py-2.5 px-3.5 text-foreground shadow-xs focus:border-action-primary focus:ring-1 focus:ring-ring-focus outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-foreground-secondary"
              >
                Phone Number
              </label>
              <div className="mt-1">
                <PhoneInput
                  international
                  countryCallingCodeEditable={false}
                  defaultCountry="IN"
                  value={phone}
                  onChange={setPhone}
                  className="w-full flex rounded-lg border border-border-subtle bg-surface py-2.5 px-3.5 text-foreground shadow-xs focus:border-action-primary focus:ring-1 focus:ring-ring-focus outline-none"
                  required
                />
              </div>
              {formErrors.phone && (
                <p className="mt-1 text-sm text-status-error">{formErrors.phone}</p>
              )}
            </div>

            <div>
              <CountrySelector
                id="country"
                name="country"
                label="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
                error={formErrors.country}
              />
            </div>

            <div>
              <label
                htmlFor="state"
                className="block text-sm font-medium text-foreground-secondary"
              >
                State
              </label>
              <select
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                disabled={!country}
                className="mt-1 block w-full rounded-lg border border-border-subtle bg-surface py-2.5 px-3.5 text-foreground shadow-xs focus:border-action-primary focus:ring-1 focus:ring-ring-focus outline-none disabled:bg-surface-subtle disabled:text-foreground-muted"
              >
                <option value="">Select State</option>
                {states.map((stateItem) => (
                  <option key={stateItem.isoCode} value={stateItem.isoCode}>
                    {stateItem.name}
                  </option>
                ))}
              </select>
              {formErrors.state && (
                <p className="mt-1 text-sm text-status-error">{formErrors.state}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="city"
                className="block text-sm font-medium text-foreground-secondary"
              >
                City
              </label>
              <input
                id="city"
                type="text"
                placeholder="Enter your city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                disabled={!state}
                className="mt-1 block w-full rounded-lg border border-border-subtle bg-surface py-2.5 px-3.5 text-foreground shadow-xs focus:border-action-primary focus:ring-1 focus:ring-ring-focus outline-none disabled:bg-surface-subtle disabled:text-foreground-muted"
              />
              {formErrors.city && (
                <p className="mt-1 text-sm text-status-error">{formErrors.city}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="pinCode"
                className="block text-sm font-medium text-foreground-secondary"
              >
                PIN Code
              </label>
              <input
                id="pinCode"
                type="text"
                placeholder="Enter your PIN code"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-border-subtle bg-surface py-2.5 px-3.5 text-foreground shadow-xs focus:border-action-primary focus:ring-1 focus:ring-ring-focus outline-none"
              />
              {formErrors.pinCode && (
                <p className="mt-1 text-sm text-status-error">
                  {formErrors.pinCode}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="alternativePhoneNo"
                className="block text-sm font-medium text-foreground-secondary"
              >
                Alternative Phone No (Optional)
              </label>
              <div className="mt-1">
                <PhoneInput
                  international
                  countryCallingCodeEditable={false}
                  defaultCountry="IN"
                  value={alternativePhoneNo}
                  onChange={setAlternativePhoneNo}
                  className="w-full flex rounded-lg border border-border-subtle bg-surface py-2.5 px-3.5 text-foreground shadow-xs focus:border-action-primary focus:ring-1 focus:ring-ring-focus outline-none"
                />
              </div>
              {formErrors.alternativePhoneNo && (
                <p className="mt-1 text-sm text-status-error">
                  {formErrors.alternativePhoneNo}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="gender"
                className="block text-sm font-medium text-foreground-secondary"
              >
                Gender (Optional)
              </label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-border-subtle bg-surface py-2.5 px-3.5 text-foreground shadow-xs focus:border-action-primary focus:ring-1 focus:ring-ring-focus outline-none"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            {!isGoogleLogin && (
              <div>
                <label
                  htmlFor="file"
                  className="block text-sm font-medium text-foreground-secondary"
                >
                  Profile Picture
                </label>
                <input
                  type="file"
                  id="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="mt-1 block w-full rounded-lg border border-border-subtle py-2 px-3 text-sm text-foreground shadow-xs file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-action-primary hover:file:bg-primary-100"
                />

                {previewUrl && (
                  <div className="mt-2 flex items-center space-x-2">
                    <div className="h-12 w-12 rounded-full overflow-hidden border border-border-subtle">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="h-full w-full object-cover cursor-pointer"
                        onClick={togglePreview}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={togglePreview}
                      className="text-sm font-medium text-action-primary hover:text-action-primary-hover transition-colors cursor-pointer"
                    >
                      {showPreview ? "Hide Preview" : "View Full Size"}
                    </button>
                  </div>
                )}

                {uploadProgress > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-foreground-muted">
                      Upload Progress: {uploadProgress}%
                    </div>
                    <div className="h-2 w-full bg-surface-subtle border border-border-subtle rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-2 bg-action-primary rounded-full transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="confirmation"
              checked={isConfirmed}
              onChange={(e) => setIsConfirmed(e.target.checked)}
              className="h-4 w-4 text-action-primary focus:ring-ring-focus border-border-default rounded"
            />
            <label
              htmlFor="confirmation"
              className="ml-2 block text-sm text-foreground"
            >
              I confirm that the details provided are correct.
            </label>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !isConfirmed}
              className="group relative flex w-full justify-center rounded-lg border border-transparent bg-action-primary hover:bg-action-primary-hover py-3 px-4 text-sm font-semibold text-white shadow-xs focus:outline-none focus:ring-2 focus:ring-ring-focus focus:ring-offset-2 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? "Submitting..." : "Verify"}
            </button>
          </div>
        </form>
      </div>

      {/* Image Preview Modal */}
      {showPreview && previewUrl && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 shadow-2xl"
          onClick={togglePreview}
        >
          <div
            className="relative shadow-2xl bg-surface p-4 rounded-xl border border-border-subtle max-w-3xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-2 right-2 text-foreground-muted hover:text-foreground p-1 transition-colors cursor-pointer"
              onClick={togglePreview}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div className="mt-4">
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full h-auto max-h-[70vh] rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerifyProfilePage;
