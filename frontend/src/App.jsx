import React from 'react';
// 1. Mude a importação aqui
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { CssBaseline, Container } from '@mui/material';

import Navbar from './components/Navbar';
import ListaLivros from './pages/ListaLivros';
import FormLivro from './pages/FormLivro';
import TelaVenda from './pages/TelaVenda';
import RelatorioVendas from './pages/RelatorioVendas';

function App() {
  return (
    // 2. E mude o nome do componente aqui
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
          </Routes>
        </Container>
      </main>
    </Router>
  );
}

export default App;