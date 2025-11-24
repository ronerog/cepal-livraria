import React, { useEffect, useState, useMemo } from 'react';
import api from '../api';
import {
  Box,
  Typography,
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
  Button
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function RelatorioVoucherSeduc() {
  const [vendas, setVendas] = useState([]);

  useEffect(() => {
    api.get('/vendas')
      .then(res => setVendas(res.data))
      .catch(err => console.error("Erro ao buscar vendas:", err));
  }, []);

  const formatarMoeda = (valor) => {
    const numero = parseFloat(valor);
    if (isNaN(numero)) return "R$ 0,00";
    return `R$ ${numero.toFixed(2).replace('.', ',')}`;
  };

  const formatarHora = (dataISO) => new Date(dataISO).toLocaleTimeString('pt-BR');
  const formatarData = (dataISO) => new Date(dataISO).toLocaleDateString('pt-BR');

  // 🔍 Filtra vendas que contêm “Voucher SEDUC”
const vendasVoucher = useMemo(() => {
  return vendas
    .map(v => {
      try {
        const raw = v.forma_pagamento;

        // Pode vir como array, string JSON ou string simples
        const formas = Array.isArray(raw)
          ? raw
          : (typeof raw === 'string' && raw.trim().startsWith('['))
          ? JSON.parse(raw)
          : [{ forma: String(raw), valor: v.total }];

        // Identifica qualquer forma que mencione "voucher" e "seduc"
        const formasVoucher = formas.filter(p =>
          String(p.forma || p.form || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .includes('voucher seduc')
        );

        // Soma apenas os valores das partes "voucher seduc"
        const totalVoucherReal = formasVoucher.reduce((acc, p) => acc + parseFloat(p.valor || 0), 0);

        // Limita o valor considerado no voucher a R$100
        const totalVoucher = totalVoucherReal > 100 ? 100 : totalVoucherReal;

        if (totalVoucherReal > 0) {
          return { ...v, totalVoucher };
        }
        return null;
      } catch (err) {
        // Se der erro no parse, tenta buscar texto puro
        const texto = String(v.forma_pagamento || '').toLowerCase();
        if (texto.includes('voucher') && texto.includes('seduc')) {
          return { ...v, totalVoucher: 100 }; // no texto simples, considera o limite de 100
        }
        return null;
      }
    })
    .filter(Boolean);
}, [vendas]);

  // Agrupa por data e calcula total do dia (geral e voucher)
const vendasAgrupadas = useMemo(() => {
  const grupos = {};
  vendasVoucher.forEach(venda => {
    const data = formatarData(venda.data_venda);
    if (!grupos[data]) grupos[data] = { vendas: [], totalDiaGeral: 0, totalDiaVoucher: 0 };

    const totalVenda = parseFloat(venda.total);
    grupos[data].vendas.push(venda);
    grupos[data].totalDiaGeral += totalVenda;
    grupos[data].totalDiaVoucher += venda.totalVoucher;
  });
  return grupos;
}, [vendasVoucher]);

  // Totais gerais
  const totalGeral = vendasVoucher.reduce((acc, v) => acc + parseFloat(v.total), 0);
const totalVoucher = vendasVoucher.reduce((acc, v) => acc + v.totalVoucher, 0);

  const gerarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório - Voucher SEDUC', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

    const tableHead = [['ID', 'Data', 'Hora', 'Comprador', 'Itens', 'Total', 'Voucher']];
    const tableBody = [];

    Object.keys(vendasAgrupadas).forEach(data => {
      const dados = vendasAgrupadas[data];
      tableBody.push([{
        content: `Data: ${data} - Total do Dia: ${formatarMoeda(dados.totalDiaGeral)} | Voucher: ${formatarMoeda(dados.totalDiaVoucher)}`,
        colSpan: 7,
        styles: { fillColor: [220, 220, 220], halign: 'center', fontStyle: 'bold' }
      }]);
      dados.vendas.forEach(v => {
        const itens = v.itens.map(i => `${i.quantidade}x ${i.livro}`).join('\n');
        tableBody.push([
          v.id,
          formatarData(v.data_venda),
          formatarHora(v.data_venda),
          v.nome_comprador || 'N/A',
          itens,
          formatarMoeda(v.total),
          formatarMoeda(v.totalVoucher)
        ]);
      });
    });

    autoTable(doc, {
      startY: 40,
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [44, 62, 80], textColor: '#fff', fontStyle: 'bold' }
    });

    const finalY = doc.lastAutoTable.finalY;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Geral: ${formatarMoeda(totalGeral)}`, 14, finalY + 10);
    doc.text(`Total Voucher (limitado a R$ 100,00 por venda): ${formatarMoeda(totalVoucher)}`, 14, finalY + 20);

    doc.save('relatorio-voucher-seduc.pdf');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Relatório - Voucher SEDUC</Typography>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<PictureAsPdfIcon />}
          onClick={gerarPDF}
          disabled={vendasVoucher.length === 0}
        >
          Exportar PDF
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6">
          Total Geral Voucher SEDUC: {formatarMoeda(totalGeral)}
        </Typography>
        <Typography variant="h6" color="primary">
          Total em Voucher (até R$ 100,00 por venda): {formatarMoeda(totalVoucher)}
        </Typography>
      </Paper>

      {Object.keys(vendasAgrupadas).length === 0 && (
        <Typography color="text.secondary">Nenhuma venda com "Voucher SEDUC" encontrada.</Typography>
      )}

      {Object.keys(vendasAgrupadas).map(data => {
        const dadosDia = vendasAgrupadas[data];
        return (
          <Accordion key={data} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <Typography variant="h6">{data}</Typography>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Total do Dia: {formatarMoeda(dadosDia.totalDiaGeral)}
                  </Typography>
                  <Typography variant="body1" color="primary">
                    Voucher: {formatarMoeda(dadosDia.totalDiaVoucher)}
                  </Typography>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Hora</TableCell>
                      <TableCell>Comprador</TableCell>
                      <TableCell>Itens</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="right">Voucher</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dadosDia.vendas.map(v => (
                      <TableRow key={v.id}>
                        <TableCell>{v.id}</TableCell>
                        <TableCell>{formatarHora(v.data_venda)}</TableCell>
                        <TableCell>{v.nome_comprador || 'N/A'}</TableCell>
                        <TableCell>
                          {v.itens.map((i, idx) => (
                            <div key={idx}>{`${i.quantidade}x ${i.livro}`}</div>
                          ))}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatarMoeda(v.total)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          {formatarMoeda(v.totalVoucher)}
                        </TableCell>
                      </TableRow>
                    ))}
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

export default RelatorioVoucherSeduc;
