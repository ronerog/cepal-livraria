// frontend/src/api.js
import axios from 'axios';

// Criamos uma instância do axios com uma configuração base
const api = axios.create({
  baseURL: 'http://10.1.11.135:5001/api',
  withCredentials: true
});

export default api;