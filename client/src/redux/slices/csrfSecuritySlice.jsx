import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
const API_URL = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");

// Async action to fetch CSRF token
export const fetchCsrfToken = createAsyncThunk(
  "csrf/fetchToken",
  async (_, { rejectWithValue }) => {
    try {
      const endpoint = API_URL ? `${API_URL}/api/csrf-token` : "/api/csrf-token";
      const response = await axios.get(endpoint, {
        withCredentials: true,
      });
      const token = response.data?.csrfToken;
      if (typeof token !== "string" || !token.trim()) {
        return rejectWithValue(
          response.data || "CSRF token missing or invalid in server response"
        );
      }
      return token;
    } catch (error) {
      return rejectWithValue(
        error.response?.data || error.message || "Failed to fetch CSRF token"
      );
    }
  }
);

const csrfSlice = createSlice({
  name: "csrf",
  initialState: {
    token: null,
    loading: false,
    error: null,
  },
  reducers: {
    resetCsrf: (state) => {
      state.token = null;
      state.error = null;
    },
    setCsrfToken: (state, action) => {
      state.token = action.payload;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCsrfToken.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCsrfToken.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload;
      })
      .addCase(fetchCsrfToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { resetCsrf, setCsrfToken } = csrfSlice.actions;
export default csrfSlice.reducer;
