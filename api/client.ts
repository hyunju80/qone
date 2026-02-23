import axios from 'axios';

// Backend URL - defaults to localhost:8001
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Add Token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            console.log(`[API] Attaching token to ${config.url}:`, token.substring(0, 10) + '...');
            config.headers.Authorization = `Bearer ${token}`; // Explicitly set it again just in case
        } else {
            console.warn(`[API] No token found for ${config.url}`);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle 401
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            localStorage.removeItem('access_token');
            // Optional: Redirect to login or reload to trigger app-level auth check
            // window.location.href = '/login'; 
        }
        return Promise.reject(error);
    }
);

export default api;
