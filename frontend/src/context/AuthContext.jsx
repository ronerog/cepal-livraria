// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useContext } from 'react';
import api from '../api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);

  const login = async (password) => {
    try {
      await api.post('/login', { password });
      setIsAdmin(true);
      return true; // Sucesso
    } catch (error) {
      console.error("Falha no login:", error);
      setIsAdmin(false);
      return false; // Falha
    }
  };

  const logout = async () => {
    try {
      await api.post('/logout');
      setIsAdmin(false);
    } catch (error) {
      console.error("Falha no logout:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};