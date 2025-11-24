import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
  Typography,
  Box,
  Button,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  List,
  ListItem,
  ListItemText,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function RelatorioVendas() {
  const [vendas, setVendas] = useState([]);
  const [dataSelecionada, setDataSelecionada] = useState(''); // '' = todas
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/vendas').then(response => setVendas(response.data));
  }, []);

  const formatarData = (dataISO) => new Date(dataISO).toLocaleDateString('pt-BR');
  const formatarHora = (dataISO) => new Date(dataISO).toLocaleTimeString('pt-BR');

  const formatarMoeda = (valor) => {
    const numero = parseFloat(valor);
    if (isNaN(numero)) return 'R$ 0,00';
    return `R$ ${numero.toFixed(2).replace('.', ',')}`;
  };

  const formatarFormaPagamento = (formaPagamento) => {
    if (formaPagamento === null || formaPagamento === undefined) return 'N/A';
    try {
      const arr = Array.isArray(formaPagamento) ? formaPagamento : JSON.parse(formaPagamento);
      if (!Array.isArray(arr)) return String(formaPagamento);
      return arr
        .map(p => {
          const nome = String(p.forma || p.form || '').trim() || 'N/A';
          const valor = (p.valor === '' || p.valor == null) ? 0 : Number(p.valor || 0);
          return `${nome}${valor ? ` ${formatarMoeda(valor)}` : ''}`;
        })
        .join(' + ');
    } catch {
      return String(formaPagamento);
    }
  };

  // Gera chave só com as formas (sem valores) e ignorando ordem
  const criarChaveFormaPagamento = (formaPagamento) => {
    if (formaPagamento === null || formaPagamento === undefined) return 'N/A';

    try {
      const arr = Array.isArray(formaPagamento) ? formaPagamento : JSON.parse(formaPagamento);
      if (!Array.isArray(arr)) {
        return String(formaPagamento).trim();
      }

      const nomes = arr
        .map(p => String(p.forma || p.form || '').trim())
        .filter(n => n);

      nomes.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

      return nomes.join(' + ') || 'N/A';
    } catch {
      return String(formaPagamento).trim();
    }
  };

  // AGRUPANDO POR DIA E, DENTRO DO DIA, PELA COMBINAÇÃO DE FORMAS
  const vendasAgrupadas = useMemo(() => {
    const grupos = {};
    vendas.forEach(venda => {
      const dataVenda = new Date(venda.data_venda).toLocaleDateString('pt-BR');
      const chaveForma = criarChaveFormaPagamento(venda.forma_pagamento);

      if (!grupos[dataVenda]) {
        grupos[dataVenda] = { totalDia: 0, formas: {} };
      }

      if (!grupos[dataVenda].formas[chaveForma]) {
        grupos[dataVenda].formas[chaveForma] = { vendas: [], totalForma: 0 };
      }

      grupos[dataVenda].formas[chaveForma].vendas.push(venda);
      grupos[dataVenda].formas[chaveForma].totalForma += parseFloat(venda.total);
      grupos[dataVenda].totalDia += parseFloat(venda.total);
    });
    return grupos;
  }, [vendas]);

  // Lista de datas disponíveis (só dias com venda)
  const datasDisponiveis = useMemo(
    () =>
      Object.keys(vendasAgrupadas).sort((a, b) => {
        const [diaA, mesA, anoA] = a.split('/').map(Number);
        const [diaB, mesB, anoB] = b.split('/').map(Number);
        return (
          new Date(anoA, mesA - 1, diaA).getTime() -
          new Date(anoB, mesB - 1, diaB).getTime()
        );
      }),
    [vendasAgrupadas]
  );

  const totalGeral = vendas.reduce((acc, venda) => acc + parseFloat(venda.total), 0);

  // Total considerando o filtro (se tiver)
  const totalGeralFiltrado = useMemo(() => {
    if (!dataSelecionada) return totalGeral;
    const dadosDia = vendasAgrupadas[dataSelecionada];
    return dadosDia ? dadosDia.totalDia : 0;
  }, [dataSelecionada, totalGeral, vendasAgrupadas]);

  const gerarPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(
      'Relatório de Vendas',
      doc.internal.pageSize.getWidth() / 2,
      20,
      { align: 'center' }
    );

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

    // Quais datas vão para o PDF? (filtro aplicado)
    const datasParaPDF = dataSelecionada
      ? [dataSelecionada]
      : Object.keys(vendasAgrupadas);

    const tableBody = [];
    const tableHead = [[
      'ID',
      'Horário',
      'Comprador',
      'Itens',
      'Forma de Pagamento',
      'Subtotal',
      'Desconto',
      'Total',
    ]];

    datasParaPDF.forEach(data => {
      const dadosDia = vendasAgrupadas[data];
      if (!dadosDia) return;

      // Cabeçalho do dia
      tableBody.push([{
        content: `Vendas de ${data} - Total do Dia: ${formatarMoeda(dadosDia.totalDia)}`,
        colSpan: 8,
        styles: { fontStyle: 'bold', fillColor: '#d3d3d3', textColor: '#000' },
      }]);

      // Para cada combinação de forma de pagamento dentro do dia
      Object.keys(dadosDia.formas).forEach(forma => {
        const grupoForma = dadosDia.formas[forma];

        // Cabeçalho da forma de pagamento (combinação)
        tableBody.push([{
          content: `Forma de Pagamento: ${forma} - Total: ${formatarMoeda(grupoForma.totalForma)}`,
          colSpan: 8,
          styles: { fontStyle: 'bold', fillColor: '#e0e0e0', textColor: '#000' },
        }]);

        // Vendas dessa combinação
        grupoForma.vendas.forEach(venda => {
          const itensString = venda.itens
            .map(item => `${item.quantidade}x ${item.livro}`)
            .join('\n');

          tableBody.push([
            venda.id,
            formatarHora(venda.data_venda),
            venda.nome_comprador || 'N/A',
            itensString,
            formatarFormaPagamento(venda.forma_pagamento),
            formatarMoeda(venda.subtotal),
            `- ${formatarMoeda(venda.desconto)}`,
            formatarMoeda(venda.total),
          ]);
        });
      });
    });

    autoTable(doc, {
      startY: 40,
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [44, 62, 80],
        textColor: '#fff',
        fontStyle: 'bold',
      },
    });

    const finalY = doc.lastAutoTable.finalY;

    // Total do que foi exportado (respeita o filtro)
    const totalParaPDF = dataSelecionada
      ? (vendasAgrupadas[dataSelecionada]?.totalDia || 0)
      : totalGeral;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Total Vendido${dataSelecionada ? ` em ${dataSelecionada}` : ' (Geral)' }: ${formatarMoeda(totalParaPDF)}`,
      14,
      finalY + 15
    );

    doc.save('relatorio-vendas.pdf');
  };

  return (
    <Box>
      {/* --- CABEÇALHO --- */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h4" component="h1">
          Relatório de Vendas
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="filtro-data-label">Filtrar por dia</InputLabel>
            <Select
              labelId="filtro-data-label"
              value={dataSelecionada}
              label="Filtrar por dia"
              onChange={(e) => setDataSelecionada(e.target.value)}
            >
              <MenuItem value="">
                <em>Todos os dias</em>
              </MenuItem>
              {datasDisponiveis.map(data => (
                <MenuItem key={data} value={data}>
                  {data}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate('/relatorio-voucher')}
          >
            Relatório Voucher SEDUC
          </Button>

          <Button
            variant="outlined"
            color="info"
            onClick={() => navigate('/relatorios')}
          >
            Demais Relatórios
          </Button>

          <Button
            variant="contained"
            color="secondary"
            startIcon={<PictureAsPdfIcon />}
            onClick={gerarPDF}
            disabled={vendas.length === 0}
          >
            Exportar PDF
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h5" component="p" sx={{ fontWeight: 'bold' }}>
          {dataSelecionada
            ? `Total Vendido em ${dataSelecionada}: ${formatarMoeda(totalGeralFiltrado)}`
            : `Total Geral Vendido: ${formatarMoeda(totalGeralFiltrado)}`}
        </Typography>
      </Paper>

      {Object.keys(vendasAgrupadas)
        .filter(data => !dataSelecionada || data === dataSelecionada)
        .map(data => {
          const dadosDia = vendasAgrupadas[data];
          return (
            <Accordion key={data} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    width: '100%',
                  }}
                >
                  <Typography variant="h6">{`Vendas de ${data}`}</Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 'bold', mr: 2 }}
                  >
                    Total do Dia: {formatarMoeda(dadosDia.totalDia)}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1, backgroundColor: '#f9f9f9' }}>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>Horário</TableCell>
                        <TableCell>Comprador</TableCell>
                        <TableCell>Itens da Venda</TableCell>
                        <TableCell>Forma de Pagamento</TableCell>
                        <TableCell align="right">Subtotal</TableCell>
                        <TableCell align="right">Desconto</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.keys(dadosDia.formas).map((forma) => {
                        const grupoForma = dadosDia.formas[forma];
                        return (
                          <React.Fragment key={forma}>
                            {/* Cabeçalho da forma de pagamento dentro do dia */}
                            <TableRow>
                              <TableCell
                                colSpan={8}
                                sx={{
                                  backgroundColor: '#eeeeee',
                                  fontWeight: 'bold',
                                }}
                              >
                                {`Forma de Pagamento: ${forma} - Total: ${formatarMoeda(
                                  grupoForma.totalForma
                                )}`}
                              </TableCell>
                            </TableRow>

                            {grupoForma.vendas.map((venda) => (
                              <TableRow key={venda.id}>
                                <TableCell>{venda.id}</TableCell>
                                <TableCell>
                                  {formatarHora(venda.data_venda)}
                                </TableCell>
                                <TableCell>
                                  {venda.nome_comprador || 'N/A'}
                                </TableCell>
                                <TableCell>
                                  <List dense disablePadding>
                                    {venda.itens.map((item, itemIndex) => (
                                      <ListItem
                                        key={itemIndex}
                                        sx={{ pl: 0, pt: 0, pb: 0 }}
                                      >
                                        <ListItemText
                                          primary={`${item.quantidade}x ${item.livro}`}
                                        />
                                      </ListItem>
                                    ))}
                                  </List>
                                </TableCell>
                                <TableCell>
                                  {formatarFormaPagamento(
                                    venda.forma_pagamento
                                  )}
                                </TableCell>
                                <TableCell align="right">
                                  {formatarMoeda(venda.subtotal)}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{ color: 'error.main' }}
                                >
                                  - {formatarMoeda(venda.desconto)}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{ fontWeight: 'bold' }}
                                >
                                  {formatarMoeda(venda.total)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          );
        })}
    </Box>
  );
}

export default RelatorioVendas;
