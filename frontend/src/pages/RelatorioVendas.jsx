import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { 
  Typography, Box, Button, Paper, Accordion, AccordionSummary, AccordionDetails, 
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer, List, ListItem, ListItemText
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function RelatorioVendas() {
  const [vendas, setVendas] = useState([]);

  useEffect(() => {
    api.get('/vendas').then(response => setVendas(response.data));
  }, []);

  const formatarData = (dataISO) => new Date(dataISO).toLocaleDateString('pt-BR');
  // --- NOVA FUNÇÃO PARA FORMATAR APENAS A HORA ---
  const formatarHora = (dataISO) => new Date(dataISO).toLocaleTimeString('pt-BR');

  const formatarMoeda = (valor) => {
    const numero = parseFloat(valor);
    if (isNaN(numero)) return "R$ 0,00";
    return `R$ ${numero.toFixed(2).replace('.', ',')}`;
  };
  
  const vendasAgrupadas = useMemo(() => {
    const grupos = {};
    vendas.forEach(venda => {
      const dataVenda = new Date(venda.data_venda).toLocaleDateString('pt-BR');
      
      if (!grupos[dataVenda]) {
        // Inicializa o array de vendas para o dia
        grupos[dataVenda] = { vendas: [], totalDia: 0 };
      }
      grupos[dataVenda].vendas.push(venda);
      grupos[dataVenda].totalDia += parseFloat(venda.total);
    });
    return grupos;
  }, [vendas]);

  const totalGeral = vendas.reduce((acc, venda) => acc + parseFloat(venda.total), 0);

  const gerarPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Vendas', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
    
    // --- AJUSTE NO CABEÇALHO DO PDF ---
    const tableBody = [];
    const tableHead = [['ID', 'Horário', 'Comprador', 'Itens', 'Subtotal', 'Desconto', 'Total']];

    Object.keys(vendasAgrupadas).forEach(data => {
      const dadosDia = vendasAgrupadas[data];
      tableBody.push([{ 
        content: `Vendas de ${data} - Total do Dia: ${formatarMoeda(dadosDia.totalDia)}`, 
        colSpan: 7, // Colspan atualizado para 7 colunas
        styles: { fontStyle: 'bold', fillColor: '#d3d3d3', textColor: '#000' } 
      }]);
      
      dadosDia.vendas.forEach(venda => {
        const itensString = venda.itens.map(item => `${item.quantidade}x ${item.livro}`).join('\n');
        
        // --- AJUSTE NA LINHA DO PDF PARA INCLUIR A HORA ---
        tableBody.push([
          venda.id,
          formatarHora(venda.data_venda), // Adicionado
          venda.nome_comprador || 'N/A',
          itensString,
          formatarMoeda(venda.subtotal),
          `- ${formatarMoeda(venda.desconto)}`,
          formatarMoeda(venda.total)
        ]);
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
        fontStyle: 'bold' 
      },
    });
    
    const finalY = doc.lastAutoTable.finalY;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Geral Vendido: ${formatarMoeda(totalGeral)}`, 14, finalY + 15);

    doc.save('relatorio-vendas.pdf');
  };

  return (
    <Box> 
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">Relatório de Vendas</Typography>
        <Button variant="contained" color="secondary" startIcon={<PictureAsPdfIcon />} onClick={gerarPDF} disabled={vendas.length === 0}>
          Exportar PDF
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h5" component="p" sx={{ fontWeight: 'bold' }}>
          Total Geral Vendido: {formatarMoeda(totalGeral)}
        </Typography>
      </Paper>

      {Object.keys(vendasAgrupadas).map(data => {
        const dadosDia = vendasAgrupadas[data];
        return (
          <Accordion key={data} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <Typography variant="h6">{`Vendas de ${data}`}</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mr: 2 }}>
                  Total do Dia: {formatarMoeda(dadosDia.totalDia)}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 1, backgroundColor: '#f9f9f9' }}>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {/* --- AJUSTE NO CABEÇALHO DA TELA --- */}
                      <TableCell>ID</TableCell>
                      <TableCell>Horário</TableCell>
                      <TableCell>Comprador</TableCell>
                      <TableCell>Itens da Venda</TableCell>
                      <TableCell align="right">Subtotal</TableCell>
                      <TableCell align="right">Desconto</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dadosDia.vendas.map((venda) => (
                      <TableRow key={venda.id}>
                        <TableCell>{venda.id}</TableCell>
                        {/* --- AJUSTE NA CÉLULA DA TELA PARA MOSTRAR A HORA --- */}
                        <TableCell>{formatarHora(venda.data_venda)}</TableCell>
                        <TableCell>{venda.nome_comprador || 'N/A'}</TableCell>
                        <TableCell>
                          <List dense disablePadding>
                            {venda.itens.map((item, itemIndex) => (
                              <ListItem key={itemIndex} sx={{ pl: 0, pt: 0, pb: 0 }}>
                                <ListItemText 
                                  primary={`${item.quantidade}x ${item.livro}`}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </TableCell>
                        <TableCell align="right">{formatarMoeda(venda.subtotal)}</TableCell>
                        <TableCell align="right" sx={{ color: 'error.main' }}>- {formatarMoeda(venda.desconto)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatarMoeda(venda.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        )
      })}
    </Box>
  );
}

export default RelatorioVendas;