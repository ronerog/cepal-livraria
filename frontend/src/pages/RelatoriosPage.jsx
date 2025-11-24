import React, { useState, useEffect, useMemo } from 'react';
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
  }, [report]);

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
      } else if (report === 'totais-gerais') {
        const res = await api.get('/relatorios/totais-gerais');
        setData([res.data || res]); // manter como array para consistência
      }
    } catch (err) {
      console.error('Erro ao buscar relatório:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao buscar relatório');
    } finally {
      setLoading(false);
    }
  };

  // ==== precompute cortesias e total antes do return (evita ReferenceError) ====
  const cortesias = (() => {
    const d = Array.isArray(data) && data.length > 0 ? data[0] : {};
    return Array.isArray(d.cortesias_por_livro) ? d.cortesias_por_livro : [];
  })();

  const totalCortesias = cortesias.reduce(
    (acc, item) => acc + Number(item?.quantidade_cortesia || 0),
    0
  );
  // =======================================================================

  const downloadPDF = () => {
    if (!data || data.length === 0) return;

    const doc = new jsPDF('landscape');
    let title = 'Relatório';
    if (report === 'top-livros') title = 'Relatório - Top Livros';
    if (report === 'por-pagamento') title = 'Relatório - Vendas por Forma de Pagamento';
    if (report === 'totais-gerais') title = 'Relatório - Totais Gerais';

    doc.setFontSize(18);
    doc.text(title, doc.internal.pageSize.getWidth() / 2, 14, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 22);

    // montar head/body conforme report
    let head = [], body = [];
    const d = data[0] || {};

    if (report === 'top-livros') {
      head = [['Posição', 'Título', 'Quantidade Vendida']];
      body = data.map((r, i) => [i + 1, r.titulo, r.total_vendido]);
    } else if (report === 'por-pagamento') {
      if (meta?.tipo === 'json') {
        head = [['Forma', 'Número de Vendas', 'Valor Total (R$)']];
        body = data.map(r => [r.forma, Number(r.num_vendas || 0), (Number(r.valor_total || 0)).toFixed(2)]);
      } else {
        head = [['Forma', 'Número de Vendas']];
        body = data.map(r => [r.forma, Number(r.num_vendas || 0)]);
      }
    } else if (report === 'totais-gerais') {
      head = [['Métrica', 'Incl. Cortesias', 'Sem Cortesias']];
      body = [
        ['Vendas', d.total_vendas_incl_cortesia || 0, d.total_vendas_sem_cortesia || 0],
        ['Livros vendidos', d.total_livros_incl_cortesia || 0, d.total_livros_sem_cortesia || 0]
      ];
    }

    // tabela principal
    autoTable(doc, {
      startY: 28,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [44, 62, 80], textColor: '#fff', fontStyle: 'bold' },
      styles: { fontSize: 10 },
    });

    // se for totais-gerais, adicionar a tabela de cortesias (se houver) e linha TOTAL
    if (report === 'totais-gerais') {
      // cortesias já precomputado acima: cortesias, totalCortesias
      if (cortesias.length > 0) {
        const startY = doc.previousAutoTable ? (doc.previousAutoTable.finalY || 0) + 8 : 28 + 30;
        doc.setFontSize(12);
        doc.text('Livros (Cortesias)', 14, startY);

        // head e body das cortesias
        const cortesiasHead = [['Título', 'Quantidade (cortesias)']];
        const cortesiasBody = cortesias.map(c => [String(c.titulo || ''), Number(c.quantidade_cortesia || 0)]);

        // adiciona as linhas de cortesias
        autoTable(doc, {
          startY: startY + 4,
          head: cortesiasHead,
          body: cortesiasBody,
          theme: 'striped',
          headStyles: { fillColor: [44, 62, 80], textColor: '#fff', fontStyle: 'bold' },
          styles: { fontSize: 9 },
          margin: { left: 14, right: 14 }
        });

        // após a última tabela, inserir a linha TOTAL (usando previousAutoTable.finalY)
        const afterY = doc.previousAutoTable ? (doc.previousAutoTable.finalY || 0) + 6 : startY + 4 + (cortesiasBody.length + 2) * 6;
        doc.setFontSize(10);
        doc.text(`Total cortesias: ${totalCortesias}`, 14, afterY);
      } else {
        // se não houver cortesias, ainda assim escrever Total = 0
        const afterY = doc.previousAutoTable ? (doc.previousAutoTable.finalY || 0) + 8 : 28 + 40;
        doc.setFontSize(10);
        doc.text('Total cortesias: 0', 14, afterY);
      }
    }

    // salva o PDF
    doc.save(`${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h4" gutterBottom>Relatórios — Painel</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Escolha o relatório. A página carrega automaticamente ao selecionar.
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel id="select-report-label">Escolha o Relatório</InputLabel>
            <Select
              labelId="select-report-label"
              value={report}
              label="Escolha o Relatório"
              onChange={(e) => setReport(e.target.value)}
            >
              <MenuItem value="top-livros">Top livros (quantidade)</MenuItem>
              <MenuItem value="por-pagamento">Vendas por Forma de Pagamento</MenuItem>
              <MenuItem value="totais-gerais">Totais — vendas & livros (incl/excl cortesias)</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ flex: 1 }} />

          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={() => fetchReport()}
            disabled={loading}
          >
            {loading ? 'Carregando...' : 'Atualizar'}
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
        <h1>Em andamento</h1>
      )}

      {/* TABELA + GRÁFICO: TOTAIS GERAIS */}
      {report === 'totais-gerais' && data.length > 0 && (
        <>
          {/* Tabela de totais */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Métrica</TableCell>
                    <TableCell align="right">Inclui Cortesias</TableCell>
                    <TableCell align="right">Sem Cortesias</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    const d = data[0] || {};
                    return ([
                      <TableRow key="vendas">
                        <TableCell>Total de Vendas</TableCell>
                        <TableCell align="right">{Number(d.total_vendas_incl_cortesia || 0)}</TableCell>
                        <TableCell align="right">{Number(d.total_vendas_sem_cortesia || 0)}</TableCell>
                      </TableRow>,
                      <TableRow key="livros">
                        <TableCell>Total de Livros Vendidos</TableCell>
                        <TableCell align="right">{Number(d.total_livros_incl_cortesia || 0)}</TableCell>
                        <TableCell align="right">{Number(d.total_livros_sem_cortesia || 0)}</TableCell>
                      </TableRow>
                    ]);
                  })()}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Tabela de cortesias por livro (se houver) */}
          {cortesias.length > 0 && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Livros que foram cortesias</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Título</TableCell>
                      <TableCell align="right">Quantidade (cortesias)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cortesias.map((c, i) => (
                      <TableRow key={c.livro_id || i}>
                        <TableCell>{c.titulo}</TableCell>
                        <TableCell align="right">{Number(c.quantidade_cortesia || 0)}</TableCell>
                      </TableRow>
                    ))}

                    {/* LINHA FINAL — TOTAL DE CORTESIAS */}
                    <TableRow sx={{ backgroundColor: '#f1f1f1' }}>
                      <TableCell><strong>Total cortesias</strong></TableCell>
                      <TableCell align="right">
                        <strong>{totalCortesias}</strong>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </>
      )}

      {data.length === 0 && !loading && (
        <Typography sx={{ mt: 2 }}>Nenhum dado disponível.</Typography>
      )}
    </Box>
  );
}
