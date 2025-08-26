import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { 
  Typography, Box, Button, Paper, Accordion, AccordionSummary, AccordionDetails, 
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Divider, List, ListItem, ListItemText
} from '@mui/material'; // Adicionei List, ListItem, ListItemText
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function RelatorioVendas() {
  const [vendas, setVendas] =useState([]);

  useEffect(() => {
    api.get('/vendas').then(response => setVendas(response.data));
  }, []);

  const formatarData = (dataISO) => new Date(dataISO).toLocaleString('pt-BR');
  const formatarMoeda = (valor) => `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;
  
  const formatarPagamentos = (pagamentoJson) => {
    try {
      const pagamentos = JSON.parse(pagamentoJson);
      if (Array.isArray(pagamentos)) {
        return pagamentos.map(p => `${p.forma}: ${formatarMoeda(p.valor)}`).join(' | ');
      }
    } catch (e) {
      return pagamentoJson;
    }
    return pagamentoJson;
  };

  const vendasAgrupadas = useMemo(() => {
    const grupos = {};
    vendas.forEach(venda => {
      const dataVenda = new Date(venda.data_venda).toLocaleDateString('pt-BR');
      
      if (!grupos[dataVenda]) {
        grupos[dataVenda] = { pagamentos: {}, totalDia: 0 };
      }
      grupos[dataVenda].totalDia += parseFloat(venda.preco_total);

      try {
        const pagamentos = JSON.parse(venda.forma_pagamento);
        if (Array.isArray(pagamentos)) {
          pagamentos.forEach(p => {
            if (!grupos[dataVenda].pagamentos[p.forma]) {
              grupos[dataVenda].pagamentos[p.forma] = { total: 0, vendas: [] };
            }
            grupos[dataVenda].pagamentos[p.forma].vendas.push(venda);
            grupos[dataVenda].pagamentos[p.forma].total += parseFloat(p.valor);
          });
        }
      } catch (e) {
        const forma = venda.forma_pagamento;
        if (!grupos[dataVenda].pagamentos[forma]) {
          grupos[dataVenda].pagamentos[forma] = { total: 0, vendas: [] };
        }
        grupos[dataVenda].pagamentos[forma].vendas.push(venda);
        grupos[dataVenda].pagamentos[forma].total += parseFloat(venda.preco_total);
      }
    });
    return grupos;
  }, [vendas]);

  const totalGeral = vendas.reduce((acc, venda) => acc + parseFloat(venda.preco_total), 0);

  const gerarPDF = () => {
    const doc = new jsPDF();
    
    // Título Principal
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Vendas', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    // Data de emissão
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
    
    // Construindo o corpo da tabela com agrupamentos
    const tableBody = [];
    const tableHead = [['Itens da Venda', 'Comprador', 'Pagamento Completo', 'Total da Venda']];

    Object.keys(vendasAgrupadas).forEach(data => {
      const dadosDia = vendasAgrupadas[data];
      // Adiciona a linha do DIA
      tableBody.push([{ 
        content: `Vendas de ${data}  -  Total do Dia: ${formatarMoeda(dadosDia.totalDia)}`, 
        colSpan: 4, 
        styles: { fontStyle: 'bold', fillColor: '#d3d3d3', textColor: '#000' } 
      }]);

      Object.keys(dadosDia.pagamentos).forEach(forma => {
        const dadosForma = dadosDia.pagamentos[forma];
        // Adiciona a linha da FORMA DE PAGAMENTO
        tableBody.push([{ 
          content: `  Forma de Pagamento: ${forma}  -  Subtotal: ${formatarMoeda(dadosForma.total)}`, 
          colSpan: 4, 
          styles: { fontStyle: 'italic', fillColor: '#f5f5f5', textColor: '#333' } 
        }]);
        
        // Adiciona as linhas de vendas detalhadas
        dadosForma.vendas.forEach(venda => {
          // Formata a lista de itens para uma única string com quebra de linha
          const itensString = venda.itens.map(item => `${item.quantidade}x ${item.livro_titulo}`).join('\n');
          
          tableBody.push([
            itensString,
            venda.nome_comprador,
            formatarPagamentos(venda.forma_pagamento),
            formatarMoeda(venda.preco_total)
          ]);
        });
      });
    });

    autoTable(doc, {
      startY: 40,
      head: tableHead,
      body: tableBody,
      theme: 'grid', // 'striped', 'grid', or 'plain'
      headStyles: { 
        fillColor: [44, 62, 80], // Cor de fundo do cabeçalho (azul escuro)
        textColor: '#fff', // Cor do texto do cabeçalho (branco)
        fontStyle: 'bold' 
      },
      alternateRowStyles: {
        fillColor: '#f9f9f9' // Efeito "zebrado" nas linhas
      },
      styles: {
        cellPadding: 3,
        fontSize: 9,
        valign: 'middle'
      }
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
              {Object.keys(dadosDia.pagamentos).map(forma => {
                const dadosForma = dadosDia.pagamentos[forma];
                return (
                  <Accordion key={forma} sx={{ mb: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <Typography>{`Forma de Pagamento: ${forma}`}</Typography>
                        <Typography sx={{ mr: 2, color: 'text.secondary' }}>
                          Subtotal: {formatarMoeda(dadosForma.total)}
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Itens da Venda</TableCell>
                              <TableCell>Comprador</TableCell>
                              <TableCell>Pagamento Completo</TableCell>
                              <TableCell>Total da Venda</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {dadosForma.vendas.map((venda, index) => (
                              <TableRow key={`${venda.id}-${index}`}>
                                <TableCell>
                                  {/* --- AQUI ESTÁ A CORREÇÃO --- */}
                                  {/* Mapeamos a lista de 'itens' dentro de cada venda */}
                                  <List dense disablePadding>
                                    {venda.itens.map((item, itemIndex) => (
                                      <ListItem key={itemIndex} sx={{ pl: 0 }}>
                                        <ListItemText 
                                          primary={`${item.quantidade}x ${item.livro_titulo}`}
                                        />
                                      </ListItem>
                                    ))}
                                  </List>
                                </TableCell>
                                <TableCell>{venda.nome_comprador}</TableCell>
                                <TableCell>{formatarPagamentos(venda.forma_pagamento)}</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>{formatarMoeda(venda.preco_total)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </AccordionDetails>
                  </Accordion>
                )
              })}
            </AccordionDetails>
          </Accordion>
        )
      })}
    </Box>
  );
}

export default RelatorioVendas;