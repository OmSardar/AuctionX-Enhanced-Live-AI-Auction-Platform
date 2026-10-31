import { useEffect, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useDispatch } from "react-redux";
import authService from "./services/authService";
import { setUser } from "./features/auth/state/authSlice";

// Shared Eager Application Shell Primitives
import GlobalLoading from "./shared/components/feedback/GlobalLoading";
import ProfileHeader from "./components/Common/Profile/ProfileHeader";
import UserLayout from "./layouts/UserLayout";
import SellerLayout from "./layouts/SellerLayout";
import ProtectedRoute from "./features/auth/components/ProtectedRoute";
import { RouteLoadingFallback, RouteErrorBoundary, ScrollRestoration, SmoothScrollProvider } from "./components/ui";

// Helper for lazy loading with chunk-retry resilience
const lazyRetry = (importer) =>
  lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      // If a dynamic import fails (e.g. stale deployment cache), retry once after brief delay
      console.warn("Retrying chunk import after failure:", error);
      return await importer();
    }
  });

/////////////////////////////////////////////////////////--> Lazy Route Pages <--///////////////////////////////////////////////////////////

// User Home & Core Pages
const Home = lazyRetry(() => import("./pages/User/Home"));
const CategoryList = lazyRetry(() => import("./pages/User/CategoryList/CategoryList"));
const SearchAndPostDetail = lazyRetry(() => import("./pages/User/SearchAndPostDetail/SearchAndPostDetail"));
const ProductDetails = lazyRetry(() => import("./pages/User/ProductDetails/ProductDetails"));
const BidAnItem = lazyRetry(() => import("./pages/User/BidAnItem/BidAnItem"));
const TodayBid = lazyRetry(() => import("./components/User/TodayBid/TodayBid"));
const TomorrowBid = lazyRetry(() => import("./components/User/TomorrowBid/TomorrowBid"));
const SellerProfileView = lazyRetry(() => import("./components/User/SellerProfileView/SellerProfileView"));
const ScheduledBids = lazyRetry(() => import("./pages/User/Dropdown/ScheduledBids/ScheduledBids"));
const OrdersPage = lazyRetry(() => import("./pages/User/Dropdown/OrderHistory/OrdersPage"));
const DetailedOrderPage = lazyRetry(() => import("./pages/User/Dropdown/OrderHistory/DetailedOrderPage"));
const PaymentPage = lazyRetry(() => import("./pages/User/Dropdown/PaymentPage/PaymentPage"));

// User Authentication Pages
const Login = lazyRetry(() => import("./pages/User/UserLogin/Login"));
const SellerLogin = lazyRetry(() => import("./pages/Seller/SellerLogin/SellerLogin"));
const VerifyProfilePage = lazyRetry(() => import("./pages/User/UserLogin/VerifyProfilePage"));
const VerifySellerProfilePage = lazyRetry(() => import("./pages/User/UserLogin/VerifySellerProfilePage"));
const PasswordResetFlow = lazyRetry(() => import("./pages/User/UserLogin/PasswordResetFlow"));
const OtpVerification = lazyRetry(() => import("./pages/User/UserLogin/OtpVerification"));
const VerifyTwoFactorPage = lazyRetry(() => import("./pages/User/UserLogin/VerifyTwoFactorPage"));
const VerifyLoginEmailOtpPage = lazyRetry(() => import("./pages/User/UserLogin/VerifyLoginEmailOtpPage"));

// User Profile Sub-Pages
const Profile = lazyRetry(() => import("./components/Common/Profile/Profile"));
const ProfilePage = lazyRetry(() => import("./components/Common/Profile/ProfilePage"));
const FeedbackForm = lazyRetry(() => import("./components/Common/Profile/ProfilePages/FeedbackForm/FeedbackForm"));
const HelpAndSupportPage = lazyRetry(() => import("./components/Common/Profile/ProfilePages/HelpAndSupportPage/HelpAndSupportPage"));
const BiddingGuidePage = lazyRetry(() => import("./components/Common/Profile/ProfilePages/BiddingGuidePage/BiddingGuidePage"));
const ProfileSettingsPage = lazyRetry(() => import("./components/Common/Profile/ProfilePages/ProfileSettingsPage/ProfileSettingsPage"));
const FanbookPage = lazyRetry(() => import("./components/Common/Profile/ProfilePages/FanBook/FanBook"));
const DailyChallengesPage = lazyRetry(() => import("./components/Common/Profile/ProfilePages/DailyChallengesPage/DailyChallengesPage"));

// Informational & Footer Pages
const AboutUS = lazyRetry(() => import("./components/Layouts/Footer/AboutUs/AboutUs1/AboutUs1"));
const AboutUsTwo = lazyRetry(() => import("./components/Layouts/Footer/AboutUs/AboutUs2/AboutUs2"));
const ContactUs = lazyRetry(() => import("./components/Layouts/Footer/AboutUs/ContactUs/ContactUs"));
const WhyUs = lazyRetry(() => import("./components/Layouts/Footer/AboutUs/WhyUs/WhyUs"));
const OurStory = lazyRetry(() => import("./components/Layouts/Footer/AboutUs/OurStory/OurStory"));
const Privacy = lazyRetry(() => import("./components/Layouts/Footer/ConsumerPolicy/Privacy/Privacy"));
const Security = lazyRetry(() => import("./components/Layouts/Footer/ConsumerPolicy/Security/Security"));
const TermsAndConditions = lazyRetry(() => import("./components/Layouts/Footer/ConsumerPolicy/TermsAndConditions/TermsAndConditions"));
const FAQ = lazyRetry(() => import("./components/Layouts/Footer/Help/FAQ/FAQ"));
const Payment = lazyRetry(() => import("./components/Layouts/Footer/Help/Payment/Payment"));
const Report = lazyRetry(() => import("./components/Layouts/Footer/Help/Report/Report"));
const Shipping = lazyRetry(() => import("./components/Layouts/Footer/Help/Shipping/Shipping"));
const Feedback = lazyRetry(() => import("./components/Layouts/Footer/Help/Feedback/Feedback"));
const HelpSupport = lazyRetry(() => import("./components/Layouts/Footer/Help/HelpSupport/HelpSupport"));

// Seller Pages
const PendingBids = lazyRetry(() => import("./components/SellerDashboard/partials/dashboard/PendingBids/PendingBids"));
const SellerHome = lazyRetry(() => import("./pages/Seller/SellerHome"));
const SellerDashboard = lazyRetry(() => import("./components/SellerDashboard/pages/SellerDashboard"));
const SellerAnalytics = lazyRetry(() => import("./components/SellerDashboard/pages/SellerAnalytics"));
const SellerSales = lazyRetry(() => import("./components/SellerDashboard/pages/SellerSales"));
const SellerPendingBids = lazyRetry(() => import("./components/SellerDashboard/pages/SellerPendingBids"));
const SellerOrders = lazyRetry(() => import("./components/SellerDashboard/pages/SellerOrders"));
const SellerInvoice = lazyRetry(() => import("./components/SellerDashboard/pages/SellerInvoice"));
const SellerRevenue = lazyRetry(() => import("./components/SellerDashboard/pages/SellerOrderRevenue"));
const SellerSubscriptions = lazyRetry(() => import("./components/SellerDashboard/pages/SellerSubscriptions"));
const SellerAdminFeedback = lazyRetry(() => import("./components/SellerDashboard/pages/SellerFeedback"));
const SellerMyAccount = lazyRetry(() => import("./components/SellerDashboard/pages/SellerMyAccount"));
const SellerMyNotifications = lazyRetry(() => import("./components/SellerDashboard/pages/SellerMyNotifications"));
const SellerAddAdmins = lazyRetry(() => import("./components/SellerDashboard/pages/SellerAddAdmins"));
const SellerAdminLogs = lazyRetry(() => import("./components/SellerDashboard/pages/SellerAdminLogs"));
const SellerRoadmap = lazyRetry(() => import("./components/SellerDashboard/pages/SellerRoadmap"));
const SellerAdminFAQ = lazyRetry(() => import("./components/SellerDashboard/pages/SellerFAQ"));
const SellerDownloadDataExcel = lazyRetry(() => import("./components/SellerDashboard/pages/SellerDownloadDataExcel"));
const SellerGoodies = lazyRetry(() => import("./components/SellerDashboard/pages/Goodies/Goodies"));
const SellerManageUsers = lazyRetry(() => import("./components/SellerDashboard/pages/SellerManageUsers"));
const SellerDocumentation = lazyRetry(() => import("./components/SellerDashboard/pages/SellerDocumentation"));
const SellerSellItemPage = lazyRetry(() => import("./components/SellerDashboard/pages/SellerSellItemPage"));
const SellerUpdateItemPage = lazyRetry(() => import("./components/SellerDashboard/pages/SellerUpdateItemPage"));
const CustomAuction = lazyRetry(() => import("./components/SellerDashboard/pages/SellerCustomAuction"));

// Admin Dashboard Pages
const Dashboard = lazyRetry(() => import("./components/AdminDashboard/pages/AdminDashboard"));
const Analytics = lazyRetry(() => import("./components/AdminDashboard/pages/AdminAnalytics"));
const Sales = lazyRetry(() => import("./components/AdminDashboard/pages/AdminSales"));
const Customers = lazyRetry(() => import("./components/AdminDashboard/pages/AdminCustomers"));
const Inventory = lazyRetry(() => import("./components/AdminDashboard/pages/AdminInventory"));
const Orders = lazyRetry(() => import("./components/AdminDashboard/pages/AdminOrders"));
const Invoice = lazyRetry(() => import("./components/AdminDashboard/pages/AdminInvoice"));
const Transactions = lazyRetry(() => import("./components/AdminDashboard/pages/AdminTransactions"));
const Withdraw = lazyRetry(() => import("./components/AdminDashboard/pages/AdminWithdraw"));
const Deposite = lazyRetry(() => import("./components/AdminDashboard/pages/AdminDeposite"));
const Subscriptions = lazyRetry(() => import("./components/AdminDashboard/pages/AdminSubscriptions"));
const Reports = lazyRetry(() => import("./components/AdminDashboard/pages/AdminReports"));
const AdminFeedback = lazyRetry(() => import("./components/AdminDashboard/pages/AdminFeedback"));
const Seller = lazyRetry(() => import("./components/AdminDashboard/pages/AdminSeller"));
const SellerHistory = lazyRetry(() => import("./components/AdminDashboard/pages/AdminSellerHistory"));
const AddBanner = lazyRetry(() => import("./components/AdminDashboard/pages/AddBanner"));
const AdminTeam = lazyRetry(() => import("./components/AdminDashboard/pages/AdminTeam"));
const CustomEvents = lazyRetry(() => import("./components/AdminDashboard/pages/AdminCustomEvents"));
const Calender = lazyRetry(() => import("./components/AdminDashboard/pages/AdminCalender"));
const MyAccount = lazyRetry(() => import("./components/AdminDashboard/pages/AdminMyAccount"));
const MyNotifications = lazyRetry(() => import("./components/AdminDashboard/pages/AdminMyNotifications"));
const AddAdmins = lazyRetry(() => import("./components/AdminDashboard/pages/AddAdmins"));
const AdminLogs = lazyRetry(() => import("./components/AdminDashboard/pages/AdminAdminLogs"));
const Roadmap = lazyRetry(() => import("./components/AdminDashboard/pages/AdminRoadmap"));
const AdminFAQ = lazyRetry(() => import("./components/AdminDashboard/pages/AdminFAQ"));
const DownloadDataExcel = lazyRetry(() => import("./components/AdminDashboard/pages/AdminDownloadDataExcel"));
const Goodies = lazyRetry(() => import("./components/AdminDashboard/pages/Goodies/Goodies"));
const ManageUsers = lazyRetry(() => import("./components/AdminDashboard/pages/AdminManageUsers"));
const Documentation = lazyRetry(() => import("./components/AdminDashboard/pages/AdminDocumentation"));
const PrivacyRequest = lazyRetry(() => import("./components/AdminDashboard/pages/AdminPrivacyRequest"));
const AdminContactUS = lazyRetry(() => import("./components/AdminDashboard/pages/AdminContactUS"));
const AdminUsersPage = lazyRetry(() => import("./components/AdminDashboard/pages/AdminUsersPage"));
const AdminListingsPage = lazyRetry(() => import("./components/AdminDashboard/pages/AdminListingsPage"));
const AdminAuctionsPage = lazyRetry(() => import("./components/AdminDashboard/pages/AdminAuctionsPage"));
const AdminOrdersPage = lazyRetry(() => import("./components/AdminDashboard/pages/AdminOrdersPage"));
const AdminDisputesPage = lazyRetry(() => import("./components/AdminDashboard/pages/AdminDisputesPage"));
const AdminReconciliationPage = lazyRetry(() => import("./components/AdminDashboard/pages/AdminReconciliationPage"));
const AdminAuditExplorer = lazyRetry(() => import("./components/AdminDashboard/pages/AdminAuditExplorer"));

// Page Not Found
const PageNotFound = lazyRetry(() => import("./shared/components/feedback/PageNotFound"));

const Layout = () => {
  const dispatch = useDispatch();

  // Check authentication status on app load (handles both regular and Google login)
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const res = await authService.checkAuth();
        if (res.authenticated && res.user) {
          dispatch(setUser(res.user));
        } else if (res.user) {
          dispatch(setUser(res.user));
        }
      } catch (_error) {
        // User is not authenticated, no action needed
      }
    };

    checkAuthStatus();
  }, [dispatch]);

  const location = useLocation();
  const currentPath = location.pathname;

  const hiddenPaths = [
    "/login",
    "/verifyprofile",
    "/verifyGprofile",
    "/forgetpassword",
    "/resetpassword",
  ];
  const showNavbarAndFooter = !hiddenPaths.includes(currentPath);
  const showProfileHeader = location.pathname.startsWith("/profile");

  return (
    <RouteErrorBoundary>
      <GlobalLoading />
      <Toaster
        position="top-right"
        toastOptions={{
          className: "auctionx-toast",
          style: {
            background: "var(--color-surface-raised, #ffffff)",
            color: "var(--color-foreground, #0f172a)",
            border: "1px solid var(--color-border-subtle, #e2e8f0)",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
          },
          success: {
            iconTheme: {
              primary: "var(--color-status-success, #10b981)",
              secondary: "var(--color-surface-raised, #ffffff)",
            },
          },
          error: {
            iconTheme: {
              primary: "var(--color-status-error, #ef4444)",
              secondary: "var(--color-surface-raised, #ffffff)",
            },
          },
        }}
      />
      {showProfileHeader && <ProfileHeader />} {/* Sub-Header */}
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {/* User Layout Route Group */}
          <Route
            element={<UserLayout showNavbarAndFooter={showNavbarAndFooter} />}
          >
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutUS />} />
            <Route path="about2" element={<AboutUsTwo />} />
            <Route path="/scheduledbids" element={<ScheduledBids />} />
            <Route path="/category/:category" element={<CategoryList />} />
            <Route path="/posts/:id" element={<SearchAndPostDetail />} />
            <Route path="/bid" element={<BidAnItem />} />
            <Route path="/todaybid" element={<TodayBid />} />
            <Route path="/tomorrowbid" element={<TomorrowBid />} />
            <Route path="/seller-profile-view" element={<SellerProfileView />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/security" element={<Security />} />
            <Route path="/terms" element={<TermsAndConditions />} />
            <Route path="/whyus" element={<WhyUs />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/report" element={<Report />} />
            <Route path="/shipping" element={<Shipping />} />
            <Route path="/helpsupport" element={<HelpSupport />} />
            <Route path="/our-story" element={<OurStory />} />
            <Route path="/support" element={<HelpAndSupportPage />} />
            <Route path="/feedback" element={<FeedbackForm />} />
            <Route path="/guide" element={<BiddingGuidePage />} />
            <Route path="/profilesettings" element={<ProfileSettingsPage />} />
            <Route path="/fanbook" element={<FanbookPage />} />
            <Route path="/daily-challenges" element={<DailyChallengesPage />} />
          </Route>

          {/* User Profile & Orders Group */}
          <Route
            element={<UserLayout showNavbarAndFooter={showNavbarAndFooter} />}
          >
            <Route path="/profile" element={<Profile />}>
              <Route path="myprofile" element={<ProfilePage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="balance" element={<PaymentPage />} />
              <Route path="feedback" element={<Feedback />} />
              <Route path="our-story" element={<OurStory />} />
              <Route path="helpsupport" element={<HelpSupport />} />
            </Route>
            <Route path="/pendingbids" element={<PendingBids />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/balance" element={<PaymentPage />} />
            <Route path="/order/:id" element={<DetailedOrderPage />} />
          </Route>

          {/* Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Login initialSignUp={true} />} />
          <Route path="/seller/login" element={<SellerLogin />} />
          <Route path="/seller/signup" element={<SellerLogin initialSignUp={true} />} />
          <Route path="/verify-2fa" element={<VerifyTwoFactorPage />} />
          <Route path="/verify-login-otp" element={<VerifyLoginEmailOtpPage />} />
          <Route path="/verifyprofile" element={<VerifyProfilePage />} />
          <Route
            path="/verifysellerprofile"
            element={<VerifySellerProfilePage />}
          />
          <Route
            path="/seller/verify-profile"
            element={<VerifySellerProfilePage />}
          />
          <Route path="/passwordforget" element={<PasswordResetFlow />} />
          <Route path="/OTPverification" element={<OtpVerification />} />

          {/* Seller Flow Routes */}
          <Route
            element={<SellerLayout showNavbarAndFooter={showNavbarAndFooter} />}
          >
            <Route exact path="/seller" element={<SellerHome />} />
            <Route path="/seller/how-it-works" element={<Navigate to="/seller#how-it-works" replace />} />
            <Route path="/seller/pricing" element={<Navigate to="/seller#pricing-fees" replace />} />
          </Route>
          {/* Seller Dashboard Protected Routes */}
          <Route element={<ProtectedRoute requiredRole="seller" redirectTo="/seller/login" />}>
            <Route exact path="/seller/dashboard" element={<SellerDashboard />} />
            <Route
              exact
              path="/seller/dashboard/Documentation"
              element={<SellerDocumentation />}
            />
            <Route
              exact
              path="/seller/dashboard/analytics"
              element={<SellerAnalytics />}
            />
            <Route exact path="/seller/dashboard/sales" element={<SellerSales />} />
            <Route
              exact
              path="/seller/dashboard/pendingbids"
              element={<SellerPendingBids />}
            />
            <Route
              exact
              path="/seller/dashboard/sell"
              element={<SellerSellItemPage />}
            />
            <Route
              exact
              path="/seller/dashboard/pendingbids/update/:id"
              element={<SellerUpdateItemPage />}
            />
            <Route
              exact
              path="/seller/dashboard/orders"
              element={<SellerOrders />}
            />
            <Route
              exact
              path="/seller/dashboard/invoice"
              element={<SellerInvoice />}
            />
            <Route
              exact
              path="/seller/dashboard/revenue"
              element={<SellerRevenue />}
            />
            <Route
              exact
              path="/seller/dashboard/subscriptions"
              element={<SellerSubscriptions />}
            />
            <Route
              exact
              path="/seller/dashboard/feedback"
              element={<SellerAdminFeedback />}
            />
            <Route
              exact
              path="/seller/dashboard/manageUsers"
              element={<SellerManageUsers />}
            />
            <Route
              exact
              path="/seller/dashboard/ourGoodies"
              element={<SellerGoodies />}
            />
            <Route
              exact
              path="/seller/dashboard/settings"
              element={<Navigate to="/seller/dashboard/settings/myAccount" replace />}
            />
            <Route
              exact
              path="/seller/dashboard/settings/myAccount"
              element={<SellerMyAccount />}
            />
            <Route
              exact
              path="/seller/dashboard/settings/myNotifications"
              element={<SellerMyNotifications />}
            />
            <Route
              exact
              path="/seller/dashboard/settings/addAdmin"
              element={<SellerAddAdmins />}
            />
            <Route
              exact
              path="/seller/dashboard/utility/adminLogs"
              element={<SellerAdminLogs />}
            />
            <Route
              exact
              path="/seller/dashboard/utility/roadmap"
              element={<SellerRoadmap />}
            />
            <Route
              exact
              path="/seller/dashboard/utility/faq"
              element={<SellerAdminFAQ />}
            />
            <Route
              exact
              path="/seller/dashboard/utility/downloadDataExcel"
              element={<SellerDownloadDataExcel />}
            />
            <Route
              exact
              path="/seller/custom-auction"
              element={<CustomAuction />}
            />
          </Route>

          {/* Admin Dashboard Protected Routes */}
          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route exact path="/admin/dashboard" element={<Dashboard />} />
            <Route
              exact
              path="/admin/users"
              element={<AdminUsersPage />}
            />
            <Route
              exact
              path="/admin/listings"
              element={<AdminListingsPage />}
            />
            <Route
              exact
              path="/admin/auctions"
              element={<AdminAuctionsPage />}
            />
            <Route
              exact
              path="/admin/orders"
              element={<AdminOrdersPage />}
            />
            <Route
              exact
              path="/admin/disputes"
              element={<AdminDisputesPage />}
            />
            <Route
              exact
              path="/admin/reconciliation"
              element={<AdminReconciliationPage />}
            />
            <Route
              exact
              path="/admin/audit-logs"
              element={<AdminAuditExplorer />}
            />
            <Route
              exact
              path="/admin/dashboard/audit-logs"
              element={<AdminAuditExplorer />}
            />
            <Route exact path="/admin/dashboard/users" element={<AdminUsersPage />} />
            <Route exact path="/admin/dashboard/listings" element={<AdminListingsPage />} />
            <Route exact path="/admin/dashboard/auctions" element={<AdminAuctionsPage />} />
            <Route exact path="/admin/dashboard/reconciliation" element={<AdminReconciliationPage />} />
            <Route
              exact
              path="/admin/dashboard/Documentation"
              element={<Documentation />}
            />
            <Route
              exact
              path="/admin/dashboard/analytics"
              element={<Analytics />}
            />
            <Route exact path="/admin/dashboard/sales" element={<Sales />} />
            <Route
              exact
              path="/admin/dashboard/customers"
              element={<Customers />}
            />
            <Route
              exact
              path="/admin/dashboard/inventory"
              element={<Inventory />}
            />
            <Route exact path="/admin/dashboard/orders" element={<AdminOrdersPage />} />
            <Route exact path="/admin/dashboard/invoice" element={<Invoice />} />
            <Route
              exact
              path="/admin/dashboard/transactions"
              element={<Transactions />}
            />
            <Route exact path="/admin/dashboard/withdrawn" element={<Withdraw />} />
            <Route exact path="/admin/dashboard/Withdrawn" element={<Withdraw />} />
            <Route exact path="/admin/dashboard/deposite" element={<Deposite />} />
            <Route exact path="/admin/dashboard/deposit" element={<Deposite />} />

            <Route
              exact
              path="/admin/dashboard/subscriptions"
              element={<Subscriptions />}
            />
            <Route exact path="/admin/dashboard/seller" element={<Seller />} />
            <Route
              exact
              path="/admin/dashboard/sellerHistory"
              element={<SellerHistory />}
            />
            <Route
              exact
              path="/admin/dashboard/addBanner"
              element={<AddBanner />}
            />
            <Route
              exact
              path="/admin/dashboard/team"
              element={<AdminTeam />}
            />
            <Route
              exact
              path="/admin/dashboard/customEvents"
              element={<CustomEvents />}
            />
            <Route exact path="/admin/dashboard/calender" element={<Calender />} />
            <Route
              exact
              path="/admin/dashboard/feedback"
              element={<AdminFeedback />}
            />
            <Route
              exact
              path="/admin/dashboard/contact-us"
              element={<AdminContactUS />}
            />
            <Route
              exact
              path="/admin/dashboard/privacy-requests"
              element={<PrivacyRequest />}
            />
            <Route exact path="/admin/dashboard/report" element={<AdminDisputesPage />} />
            <Route exact path="/admin/dashboard/disputes" element={<AdminDisputesPage />} />
            <Route
              exact
              path="/admin/dashboard/manageUsers"
              element={<ManageUsers />}
            />
            <Route exact path="/admin/dashboard/ourGoodies" element={<Goodies />} />
            <Route
              exact
              path="/admin/dashboard/settings/myAccount"
              element={<MyAccount />}
            />
            <Route
              exact
              path="/admin/dashboard/settings/myNotifications"
              element={<MyNotifications />}
            />
            <Route
              exact
              path="/admin/dashboard/settings/addAdmin"
              element={<AddAdmins />}
            />
            <Route
              exact
              path="/admin/dashboard/utility/adminLogs"
              element={<AdminLogs />}
            />
            <Route
              exact
              path="/admin/dashboard/utility/roadmap"
              element={<Roadmap />}
            />
            <Route
              exact
              path="/admin/dashboard/utility/faq"
              element={<AdminFAQ />}
            />
            <Route
              exact
              path="/admin/dashboard/utility/downloadDataExcel"
              element={<DownloadDataExcel />}
            />
          </Route>

          {/* Page Not Found Catch-All */}
          <Route path="/pagenotfound" element={<PageNotFound />} />
          <Route path="*" element={<Navigate to="/pagenotfound" replace />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
};

const App = () => {
  return (
    <Router>
      <ScrollRestoration />
      <SmoothScrollProvider>
        <Layout />
      </SmoothScrollProvider>
    </Router>
  );
};

export default App;
