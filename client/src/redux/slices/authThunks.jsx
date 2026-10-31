import { persistor } from "../../app/store/store";
import { logout } from "../../features/auth/state/authSlice";
import authService from "../../services/authService";
import { clearApiCache } from "./axiosWithAuth";

export const completeLogout = () => async (dispatch) => {
  try {
    // 0. Explicitly flush API cache on logout
    clearApiCache();

    // 1. Call backend logout endpoint (handles CSRF & cookies)
    try {
      await authService.logout();
    } catch (apiError) {
      console.warn("Backend logout warning:", apiError);
    }

    // 2. Clear persisted state
    try {
      await persistor.purge();
      localStorage.removeItem("persist:auth");
    } catch (e) {
      localStorage.removeItem("persist:auth");
    }

    // 3. Dispatch logout action
    dispatch(logout());

    // 4. Redirect to login
    window.location.href = "/login";
  } catch (error) {
    console.error("Logout error:", error);
    try {
      await persistor.purge();
      localStorage.removeItem("persist:auth");
    } catch (e) {
      localStorage.removeItem("persist:auth");
    }
    dispatch(logout());
    window.location.href = "/login";
  }
};
