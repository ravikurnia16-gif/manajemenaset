import axios from 'axios';

const api = axios.create({
    baseURL: '/api', // Works with our Docker proxy/serve setup
});

// Otomatis masukkan token ke setiap request jika ada
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Interceptor untuk handle response error (401/403 -> Auto Logout)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            // Token expired atau tidak valid
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Redirect ke login jika bukan di halaman login
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
