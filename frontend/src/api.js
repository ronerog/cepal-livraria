// frontend/src/api.js
import axios from 'axios';

// Criamos uma instância do axios com uma configuração base
const api = axios.create({
  baseURL: 'http://localhost:5001/api',
  withCredentials: true
});

export default api;