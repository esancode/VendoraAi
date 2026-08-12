import axios from 'axios';

let envUrl = import.meta.env.VITE_API_URL || '';
if (envUrl && !envUrl.endsWith('/api/v1')) {
  envUrl = envUrl.replace(/\/$/, '') + '/api/v1';
}
export const baseURL = envUrl || '/api/v1';

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

let inMemoryToken: string | null = null;
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string | null) => void; reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const setAccessToken = (token: string | null) => {
  inMemoryToken = token;
};

export const getAccessToken = () => inMemoryToken;

api.interceptors.request.use(
  (config) => {
    if (inMemoryToken) {
      config.headers['Authorization'] = `Bearer ${inMemoryToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Reject immediately if it's the login or refresh route to avoid loops
    if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token) {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Use a separate axios instance or plain axios to avoid interceptor loops
        const { data } = await axios.post(`${baseURL}/auth/refresh`, {}, {
          withCredentials: true,
        });
        
        const newToken = data.accessToken;
        setAccessToken(newToken);
        
        processQueue(null, newToken);
        
        // Notify AuthContext to update React state
        window.dispatchEvent(new CustomEvent('token_refreshed', { detail: data }));
        
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);
        window.dispatchEvent(new Event('session_expired'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
