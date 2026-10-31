import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";
import authReducer from "../../features/auth/state/authSlice";
import csrfReducer from "../../redux/slices/csrfSecuritySlice";
import loadingReducer from "../../shared/components/feedback/loadingSlice";

const authPersistConfig = {
  key: "auth",
  storage,
  whitelist: [
    "isAuthenticated",
    "isVerified",
    "verified",
    "user",
    "role",
    "profilePic",
    "isSeller",
    "loginType",
  ],
  blacklist: ["loading"],
};

export const store = configureStore({
  reducer: {
    auth: persistReducer(authPersistConfig, authReducer),
    csrf: csrfReducer,
    loading: loadingReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
        ignoredPaths: ["auth.user"],
      },
    }),
});

export const persistor = persistStore(store);

export default store;
