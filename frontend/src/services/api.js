// frontend/src/services/api.js
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Interceptor de request: agrega el token JWT y empresa seleccionada por el superadmin
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Cuando el superadmin tiene una empresa seleccionada, enviarla en cada request
  // para que el backend aplique el filtro correcto de multi-tenancy
  const adminCompanyId = localStorage.getItem('ts-admin-company-id');
  if (adminCompanyId) config.headers['x-company-id'] = adminCompanyId;

  return config;
});

// Interceptor de response: maneja errores globalmente
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const msg = error.response?.data?.message || 'Error de conexión';

    if (error.response?.status === 401) {
      const hadToken = localStorage.getItem('token');
      localStorage.removeItem('token');
      if (hadToken && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    const richErr = new Error(msg);
    richErr.code   = error.response?.data?.code;
    richErr.status = error.response?.status;
    return Promise.reject(richErr);
  }
);

export default api;
