import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { CssBaseline, Container } from '@mui/material';

import Navbar from './components/Navbar';
import ListaLivros from './pages/ListaLivros';
import FormLivro from './pages/FormLivro';
import TelaVenda from './pages/TelaVenda';
import RelatorioVendas from './pages/RelatorioVendas';
import RelatoriosPage from './pages/RelatoriosPage';

function App() {
  return (
    <Router>
      <CssBaseline />
      <Navbar />
      <main>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Routes>
            <Route path="/" element={<ListaLivros />} />
            <Route path="/livro/adicionar" element={<FormLivro />} />
            <Route path="/livro/editar/:id" element={<FormLivro />} />
            <Route path="/vender" element={<TelaVenda />} />
            <Route path="/relatorio" element={<RelatorioVendas />} />
            <Route path="/lista-livros" element={<ListaLivros />} />
            <Route path="/relatorios" element={<RelatoriosPage />} />
          </Routes>
        </Container>
      </main>
    </Router>
  );
}

export default App;