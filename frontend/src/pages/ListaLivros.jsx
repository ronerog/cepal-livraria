import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext'; // 1. Importa o hook de autenticação
import { useNotification } from '../context/NotificationContext'; // Importe o hook de notificação

import {
  Typography, Button, Box, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, TablePagination, TextField
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function ListaLivros() {
  const { isAdmin } = useAuth(); // 2. Pega o estado de admin do contexto
  const [livros, setLivros] = useState([]);
  const { showNotification } = useNotification(); // 3. Pega a função de notificação do contexto
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filtroNome, setFiltroNome] = useState('');

  const carregarLivros = () => {
    api.get('/livros')
      .then(response => setLivros(response.data))
      .catch(error => console.error("Erro ao buscar livros:", error));
  };

  useEffect(() => {
    carregarLivros();
  }, []);

  const handleDelete = (id) => {
    if (window.confirm('Tem certeza que deseja deletar este livro?')) {
      // O cookie de autenticação é enviado automaticamente pelo navegador
      api.delete(`/livros/${id}`)
        .then(() => {
          showNotification('Livro deletado com sucesso!');
          carregarLivros(); // Recarrega a lista
        })
        .catch(error => {
          showNotification(`Erro ao deletar livro: ${error.response?.data?.error || error.message}`, 'error');
        });
    }
  };

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const removerAcentos = (texto) =>
    texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const livrosFiltrados = livros.filter(livro => {
    const filtro = removerAcentos(filtroNome.toLowerCase());
    const titulo = removerAcentos(livro.titulo?.toLowerCase() || '');
    const autor = removerAcentos(livro.autor?.toLowerCase() || '');
    return titulo.includes(filtro) || autor.includes(filtro);
  });

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1">
          Inventário de Livros
        </Typography>
        {/* 4. Botão de Adicionar só aparece se for admin */}
        {isAdmin && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            component={Link}
            to="/livro/adicionar"
          >
            Adicionar Livro
          </Button>
        )}
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          label="Pesquisar por Título ou Autor"
          value={filtroNome}
          onChange={(e) => {
            setFiltroNome(e.target.value);
            setPage(0);
          }}
        />
      </Box>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Título</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Autor</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Preço</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Estoque</TableCell>
                {/* 5. Coluna de Ações só aparece se for admin */}
                {isAdmin && <TableCell align="right" sx={{ fontWeight: 'bold' }}>Ações</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {livrosFiltrados
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((livro) => (
                  <TableRow key={livro.id} hover>
                    <TableCell>{livro.titulo}</TableCell>
                    <TableCell>{livro.autor || 'N/A'}</TableCell>
                    <TableCell>R$ {parseFloat(livro.preco).toFixed(2).replace('.', ',')}</TableCell>
                    <TableCell>{livro.estoque}</TableCell>
                    {/* 6. Célula de Ações só aparece se for admin */}
                    {isAdmin && (
                      <TableCell align="right">
                        <IconButton title="Editar" color="primary" component={Link} to={`/livro/editar/${livro.id}`}>
                          <EditIcon />
                        </IconButton>
                        <IconButton title="Excluir" color="error" onClick={() => handleDelete(livro.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={livrosFiltrados.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Itens por página:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
      </Paper>
    </>
  );
}
export default ListaLivros;