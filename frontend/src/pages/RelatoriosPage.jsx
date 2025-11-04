import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  Box, Typography, Paper, Stack, Button, MenuItem, Select, FormControl, InputLabel,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer
} from '@mui/material';
import { PictureAsPdf as PdfIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function RelatoriosPage() {
  const [report, setReport] = useState('top-livros');
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    setData([]);
    setMeta(null);

    try {
      if (report === 'top-livros') {
        const res = await api.get('/relatorios/top-livros');
        setData(res.data);
      } else if (report === 'por-pagamento') {
        const res = await api.get('/relatorios/por-pagamento');
        setMeta({ tipo: res.data.tipo || 'string' });
        setData(res.data.rows || []);
      }
    } catch (err) {
      console.error('Erro ao buscar relatório:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao buscar relatório');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!data || data.length === 0) return;

    const doc = new jsPDF('landscape');
    const title = report === 'top-livros'
      ? 'Relatório - Top Livros'
      : 'Relatório - Vendas por Forma de Pagamento';

    doc.setFontSize(18);
    doc.text(title, doc.internal.pageSize.getWidth() / 2, 14, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 22);

    // Cria tabela
    let head = [];
    let body = [];

    if (report === 'top-livros') {
      head = [['Posição', 'Título', 'Quantidade Vendida']];
      body = data.map((r, i) => [i + 1, r.titulo, r.total_vendido]);
    } else if (report === 'por-pagamento') {
      if (meta?.tipo === 'json') {
        head = [['Forma', 'Número de Vendas', 'Valor Total Contribuído']];
        body = data.map(r => [r.forma, r.num_vendas, Number(r.valor_total_contribuido || 0).toFixed(2)]);
      } else {
        head = [['Forma', 'Número de Vendas']];
        body = data.map(r => [r.forma, r.num_vendas]);
      }
    }

    autoTable(doc, {
      startY: 28,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [44, 62, 80], textColor: '#fff', fontStyle: 'bold' },
      styles: { fontSize: 10 },
    });

    doc.save(`${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h4" gutterBottom>Relatórios — Painel</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Escolha o relatório e clique em "Buscar" para visualizar os dados e exportar em PDF.
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <FormControl sx={{ minWidth: 250 }}>
            <InputLabel id="select-report-label">Escolha o Relatório</InputLabel>
            <Select
              labelId="select-report-label"
              value={report}
              label="Escolha o Relatório"
              onChange={(e) => setReport(e.target.value)}
            >
              <MenuItem value="top-livros">Top livros (quantidade)</MenuItem>
              <MenuItem value="por-pagamento">Vendas por Forma de Pagamento</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ flex: 1 }} />

          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={() => fetchReport()}
            disabled={loading}
          >
            {loading ? 'Carregando...' : 'Buscar'}
          </Button>

          <Button
            variant="outlined"
            startIcon={<PdfIcon />}
            onClick={downloadPDF}
            disabled={!data || data.length === 0}
          >
            Exportar PDF
          </Button>
        </Stack>
      </Paper>

      {error && (
        <Paper sx={{ p: 2, mb: 2, backgroundColor: '#fdecea' }}>
          <Typography color="error">{String(error)}</Typography>
        </Paper>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>Tabela de dados</Typography>

      {/* TABELA TOP LIVROS */}
      {report === 'top-livros' && data.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Posição</TableCell>
                <TableCell>Título</TableCell>
                <TableCell align="right">Quantidade Vendida</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((r, i) => (
                <TableRow key={r.id || i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{r.titulo}</TableCell>
                  <TableCell align="right">{r.total_vendido}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* TABELA POR PAGAMENTO */}
      {report === 'por-pagamento' && data.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Forma</TableCell>
                <TableCell align="right">Número de Vendas</TableCell>
                {meta?.tipo === 'json' && (
                  <TableCell align="right">Valor Total Contribuído</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((r, i) => (
                <TableRow key={r.forma || i}>
                  <TableCell>{r.forma}</TableCell>
                  <TableCell align="right">{r.num_vendas}</TableCell>
                  {meta?.tipo === 'json' && (
                    <TableCell align="right">
                      {Number(r.valor_total_contribuido || 0).toFixed(2)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {data.length === 0 && !loading && (
        <Typography sx={{ mt: 2 }}>Nenhum dado disponível.</Typography>
      )}
    </Box>
  );
}
