// src/components/Navbar.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import PasswordPrompt from './PasswordPrompt';
import { useNotification } from '../context/NotificationContext';
import PixQrStatic from './PixQrStatic';

function Navbar() {
  const { isAdmin, login, logout } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { showNotification } = useNotification();
  const [pixOpen, setPixOpen] = useState(false);

  const handleLogin = async (password) => {
    const success = await login(password);
    if (!success) {
      showNotification('Senha incorreta!', 'error');
    } else {
      showNotification('Login bem-sucedido!', 'success');
    }
  };

  return (
    <>
      <AppBar position="static" color="primary" sx={{ boxShadow: 2 }}>
        <Toolbar sx={{ display: 'flex', alignItems: 'center' }}>
          {/* LOGO + NOME (NÃO OCUPARÁ TODO O ESPAÇO) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <img
              src="/Logo2.png"
              alt="Logo"
              style={{
                height: 40,
                width: 'auto',
                cursor: 'pointer',
                display: 'block',
              }}
              onClick={() => (window.location.href = '/')}
            />
            <Typography
              variant="h6"
              component={Link}
              to="/"
              sx={{
                color: 'inherit',
                textDecoration: 'none',
                fontWeight: 'bold',
                display: 'inline-flex', // evita que ocupe largura total
                alignItems: 'center',
              }}
            >
              Livraria - CEPAL
            </Typography>
          </Box>

          {/* BOTÕES: empurra para a direita com ml: 'auto' — sem sobreposição */}
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button color="inherit" component={Link} to="/">Inventário</Button>
            <Button color="inherit" component={Link} to="/vender">Vender</Button>
            <Button color="inherit" component={Link} to="/relatorio">Relatório</Button>

            <Box
              component="span"
              sx={{
                mx: 1,
                borderRight: '1px solid rgba(255,255,255,0.12)',
                height: 32,
              }}
            />

            <Button color="inherit" onClick={() => setPixOpen(true)}>
              QRCode Pix
            </Button>

            {isAdmin ? (
              <Button color="inherit" onClick={logout} variant="outlined">
                Sair do Modo Admin
              </Button>
            ) : (
              <Button color="inherit" onClick={() => setDialogOpen(true)} variant="outlined">
                Administrar
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <PasswordPrompt
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleLogin}
      />
      <PixQrStatic open={pixOpen} onClose={() => setPixOpen(false)} />
    </>
  );
}

export default Navbar;
