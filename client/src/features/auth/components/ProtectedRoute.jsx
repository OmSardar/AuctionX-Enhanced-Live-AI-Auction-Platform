import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

/**
 * Enterprise ProtectedRoute component enforcing client-side role guards.
 * Defense-in-depth complement to server-side adminAuthMiddleware.
 * Unauthorized requests are redirected immediately without exposing admin data.
 */
const ProtectedRoute = ({
  element,
  children,
  requiredRole = null,
  requiredRoles = null,
  redirectTo = "/login",
}) => {
  const location = useLocation();
  const auth = useSelector((state) => state.auth);

  const isAuthenticated = Boolean(auth.isAuthenticated || auth.user);
  const activeRole = auth.role || auth.user?.role || null;

  // 1. Unauthenticated users -> redirect to login preserving intent
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // 2. Role authorization check
  const allowedRoles = requiredRoles
    ? requiredRoles
    : requiredRole === "admin"
    ? ["admin", "super-admin"]
    : requiredRole
    ? [requiredRole]
    : null;

  if (allowedRoles && (!activeRole || !allowedRoles.includes(activeRole))) {
    // Authenticated ordinary users or sellers attempting admin routes -> redirect to home
    return <Navigate to="/" replace />;
  }

  return element || children || <Outlet />;
};

export default ProtectedRoute;
