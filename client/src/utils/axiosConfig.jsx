// src/utils/axiosConfig.js
import axios from 'axios';
import { store } from '../app/store/store';
import { showLoading, hideLoading } from '../shared/components/feedback/loadingSlice';

// Request interceptor
axios.interceptors.request.use(config => {
  if (config.showGlobalLoading !== false) {
    store.dispatch(showLoading({ 
      message: config.loadingMessage || 'Loading...' 
    }));
  }
  return config;
});

// Response interceptor
axios.interceptors.response.use(
  response => {
    if (response.config.showGlobalLoading !== false) {
      store.dispatch(hideLoading());
    }
    return response;
  },
  error => {
    if (error.config?.showGlobalLoading !== false) {
      store.dispatch(hideLoading());
    }
    return Promise.reject(error);
  }
);

export default axios;