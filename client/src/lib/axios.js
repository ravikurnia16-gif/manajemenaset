import axios from 'axios';
import { Capacitor } from '@capacitor/core';

const API_URL = Capacitor.isNativePlatform() 
    ? 'https://manajemen-aset-sarpras.ltdh6w.easypanel.host/api' 
    : '/api';

const api = axios.create({
    baseURL: API_URL, // Works with our Docker proxy/serve setup
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
            const path = window.location.pathname;
            const isPublicPage = path.startsWith('/public') || 
                                 path.startsWith('/login') || 
                                 path.startsWith('/pesan-seragam') || 
                                 path.startsWith('/q/') || 
                                 path.startsWith('/verify');

            if (!isPublicPage) {
                // Token expired atau tidak valid pada halaman terproteksi
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
