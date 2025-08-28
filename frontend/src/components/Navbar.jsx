import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useAuth } from '../context/AuthContext'; // Importa o hook para acessar o contexto
import PasswordPrompt from './PasswordPrompt';     // Importa o pop-up de senha
import { useNotification } from '../context/NotificationContext'; // Importe o hook de notificação

function Navbar() {
  const { isAdmin, login, logout } = useAuth(); // Pega o estado (isAdmin) e as funções do contexto
  const [dialogOpen, setDialogOpen] = useState(false); // Estado para controlar o pop-up
  const { showNotification } = useNotification(); // Pega a função de notificação do contexto

  // Função que será chamada pelo pop-up ao confirmar a senha
  const handleLogin = async (password) => {
    const success = await login(password);
    if (!success) {
      showNotification("Senha incorreta!", 'error');
    } else {
      showNotification("Login bem-sucedido!", 'success');
    }
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component={Link} to="/" sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none' }}>
            Livraria
          </Typography>
          <Box>
            {/* Botões de navegação normais */}
            <Button color="inherit" component={Link} to="/">Inventário</Button>
            <Button color="inherit" component={Link} to="/vender">Vender</Button>
            <Button color="inherit" component={Link} to="/relatorio">Relatório</Button>
            
            {/* Divisória visual (opcional) */}
            <Box component="span" sx={{ mx: 1, borderRight: '1px solid rgba(255,255,255,0.12)', height: '32px' }} />

            {/* Botão condicional de Login/Logout */}
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
      
      {/* O componente de pop-up que fica escondido até ser chamado */}
      <PasswordPrompt
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleLogin}
      />
    </>
  );
}

export default Navbar;