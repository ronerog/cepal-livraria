import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { Typography, TextField, Button, Box, Paper, Stack } from '@mui/material';
import { useNotification } from '../context/NotificationContext'; // Importe o hook de notificação

function FormLivro() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification(); 
  const [livro, setLivro] = useState({ titulo: '', autor: '', preco: '', estoque: '', codigo_barras: '' });
  const isEditing = Boolean(id);

  useEffect(() => {
    if (isEditing) {
      api.get(`/livros/${id}`).then(response => setLivro(response.data));
    }
  }, [id, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLivro(prevState => ({ ...prevState, [name]: value }));
  };

const handleSubmit = (e) => {
    e.preventDefault();
    const method = id ? 'put' : 'post';
    const url = id ? `/livros/${id}` : '/livros';

    const dadosParaEnviar = {
      ...livro,
      preco: parseFloat(livro.preco),
      estoque: parseInt(livro.estoque, 10),
    };

    api[method](url, dadosParaEnviar)
      .then(() => {
        navigate('/lista-livros');
      })
      .catch(error => {
        console.error("Erro ao salvar o livro!", error);
        // Adicione um feedback para o usuário aqui
      });
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {isEditing ? 'Editar Livro' : 'Adicionar Novo Livro'}
      </Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <TextField label="Título" name="titulo" value={livro.titulo} onChange={handleChange} fullWidth required />
          <TextField label="Autor" name="autor" value={livro.autor || ''} onChange={handleChange} fullWidth />
          <TextField label="Código de Barras" name="codigo_barras" value={livro.codigo_barras || ''} onChange={handleChange} fullWidth required />
          <TextField label="Preço" name="preco" type="number" value={livro.preco} onChange={handleChange} fullWidth required inputProps={{ step: "0.01" }} />
          <TextField label="Estoque" name="estoque" type="number" value={livro.estoque} onChange={handleChange} fullWidth required />
          <Box>
            <Button type="submit" variant="contained" color="primary">Salvar</Button>
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
}

export default FormLivro;