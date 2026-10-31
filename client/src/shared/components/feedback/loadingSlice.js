import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  isLoading: false,
  loadingMessage: "Loading...",
};

export const loadingSlice = createSlice({
  name: "loading",
  initialState,
  reducers: {
    showLoading: (state, action) => {
      state.isLoading = true;
      state.loadingMessage = action.payload?.message || "Loading...";
    },
    hideLoading: (state) => {
      state.isLoading = false;
    },
  },
});

export const { showLoading, hideLoading } = loadingSlice.actions;
export default loadingSlice.reducer;
