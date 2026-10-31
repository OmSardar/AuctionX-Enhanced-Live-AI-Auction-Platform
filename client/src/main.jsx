import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux"; // Import Redux Provider
import { store, persistor } from "./app/store/store"; // Import your Redux store
import "./redux/slices/axiosWithAuth"; // Initialize global auth & CSRF interceptors
import { PersistGate } from "redux-persist/integration/react";
import "./index.css";
import ThemeProvider from "./app/providers/ThemeProvider.jsx";
import App from "./App.jsx";
import LoaderManager from "./shared/components/feedback/LoaderManager.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {/* Wrap your app with Provider */}
        <ThemeProvider>
          {/* <Loading /> */}
          <LoaderManager>
            <App />
          </LoaderManager>
          {/* <App />   */}
        </ThemeProvider>
      </PersistGate>
    </Provider>
  </StrictMode>
);
