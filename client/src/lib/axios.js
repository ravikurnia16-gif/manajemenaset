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

export default api;
