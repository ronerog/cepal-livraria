import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { 
  Typography, Button, Box, Paper, Stack, TextField, Autocomplete, 
  IconButton, List, ListItem, ListItemText, Divider, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import DeleteIcon from '@mui/icons-material/Delete';

function TelaVenda() {
    // Estado dos dados da venda
    const [nomeComprador, setNomeComprador] = useState('');
    const [pagamentos, setPagamentos] = useState([{ forma: 'Pix', valor: '' }]);
    
    // Estados do carrinho
    const [livros, setLivros] = useState([]); // Lista de todos os livros disponíveis
    const [carrinho, setCarrinho] = useState([]);
    const [livroParaAdicionar, setLivroParaAdicionar] = useState(null);
    const [qtdParaAdicionar, setQtdParaAdicionar] = useState(1);
    
    const navigate = useNavigate();

    // Carrega a lista de livros da API quando o componente monta
    useEffect(() => {
        api.get('/livros')
            .then(res => setLivros(res.data.filter(livro => livro.estoque > 0)))
            .catch(error => console.error("Erro ao buscar livros:", error));
    }, []);

    // Função para formatar valores em Reais (R$)
    const formatarMoeda = (valor) => {
        if (isNaN(valor)) return "R$ 0,00";
        return `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;
    };

    // Lógica para adicionar um item ao carrinho
    const handleAddToCart = () => {
      if (!livroParaAdicionar || qtdParaAdicionar <= 0) {
        alert("Selecione um livro e uma quantidade válida.");
        return;
      }
      if (qtdParaAdicionar > livroParaAdicionar.estoque) {
        alert(`Estoque insuficiente. Apenas ${livroParaAdicionar.estoque} unidades disponíveis.`);
        return;
      }
      
      const itemExistente = carrinho.find(item => item.livro.id === livroParaAdicionar.id);
      
      if (itemExistente) {
        setCarrinho(carrinho.map(item => 
          item.livro.id === livroParaAdicionar.id
            ? { ...item, quantidade: item.quantidade + qtdParaAdicionar }
            : item
        ));
      } else {
        setCarrinho([...carrinho, { livro: livroParaAdicionar, quantidade: qtdParaAdicionar }]);
      }
      
      setLivroParaAdicionar(null);
      setQtdParaAdicionar(1);
    };

    // Lógica para remover um item do carrinho
    const handleRemoveFromCart = (livroId) => {
      setCarrinho(carrinho.filter(item => item.livro.id !== livroId));
    };

    // Cálculos de totais
    const totalVenda = useMemo(() => {
        return carrinho.reduce((acc, item) => acc + (item.livro.preco * item.quantidade), 0);
    }, [carrinho]);

    const totalPago = useMemo(() => {
        return pagamentos.reduce((acc, p) => acc + parseFloat(p.valor || 0), 0);
    }, [pagamentos]);

    const restante = totalVenda - totalPago;

    // Funções para gerenciar o pagamento dividido
    const handlePagamentoChange = (index, field, value) => {
        const novosPagamentos = [...pagamentos];
        novosPagamentos[index][field] = value;
        setPagamentos(novosPagamentos);
    };

    const adicionarPagamento = () => {
        setPagamentos([...pagamentos, { forma: 'Dinheiro', valor: '' }]);
    };

    const removerPagamento = (index) => {
        const novosPagamentos = pagamentos.filter((_, i) => i !== index);
        setPagamentos(novosPagamentos);
    };

    // Submissão final da venda
    const handleSubmit = (e) => {
        e.preventDefault();
        if (carrinho.length === 0) {
            alert("O carrinho está vazio.");
            return;
        }
        if (Math.abs(restante) > 0.001) {
            alert(`O total pago (${formatarMoeda(totalPago)}) não corresponde ao total da venda (${formatarMoeda(totalVenda)}).`);
            return;
        }
        
        const vendaData = { carrinho, pagamentos, nomeComprador };

        api.post('/vendas', vendaData)
            .then(() => {
                alert('Venda registrada com sucesso!');
                navigate('/relatorio');
            })
            .catch(error => alert(`Erro: ${error.response?.data?.error || 'Não foi possível registrar a venda.'}`));
    };

    return (
        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Registrar Nova Venda
            </Typography>

            {/* --- SEÇÃO PARA ADICIONAR ITENS --- */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} alignItems="center">
              <Autocomplete
                sx={{ flex: 4, width: '100%' }}
                options={livros}
                getOptionLabel={(option) => `${option.titulo} (Estoque: ${option.estoque})`}
                value={livroParaAdicionar}
                onChange={(e, newValue) => setLivroParaAdicionar(newValue)}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <TextField {...params} label="Pesquise um Livro" />}
              />
              <TextField sx={{ flex: 1, width: '100%' }} label="Qtd." type="number" value={qtdParaAdicionar} onChange={(e) => setQtdParaAdicionar(parseInt(e.target.value, 10) || 1)} inputProps={{ min: "1" }} />
              <Button variant="contained" onClick={handleAddToCart} startIcon={<AddCircleIcon />} sx={{ width: { xs: '100%', sm: 'auto' } }}>Adicionar</Button>
            </Stack>

            <Divider>Carrinho de Compras</Divider>

            {/* --- LISTA DO CARRINHO --- */}
            <List sx={{ my: 2 }}>
              {carrinho.map(item => (
                <ListItem key={item.livro.id} secondaryAction={
                  <IconButton edge="end" aria-label="delete" onClick={() => handleRemoveFromCart(item.livro.id)}>
                    <DeleteIcon color="error" />
                  </IconButton>
                }>
                  <ListItemText 
                    primary={`${item.quantidade}x ${item.livro.titulo}`}
                    secondary={`Subtotal: ${formatarMoeda(item.livro.preco * item.quantidade)}`}
                  />
                </ListItem>
              ))}
              {carrinho.length === 0 && (
                <Typography sx={{ textAlign: 'center', color: 'text.secondary', my: 2 }}>
                  O carrinho está vazio.
                </Typography>
              )}
            </List>
            
            {/* --- SEÇÃO DE FINALIZAÇÃO DA VENDA (SÓ APARECE SE TIVER ITENS NO CARRINHO) --- */}
            {carrinho.length > 0 && (
              <Box component="form" onSubmit={handleSubmit} noValidate>
                <Divider sx={{ mb: 3 }}>Detalhes Finais</Divider>
                <Stack spacing={3}>
                    <TextField label="Nome do Comprador" type="text" value={nomeComprador} onChange={(e) => setNomeComprador(e.target.value)} fullWidth required />
                    
                    <Typography variant="h6">Pagamento</Typography>
                    
                    {pagamentos.map((p, index) => (
                        <Stack direction="row" spacing={2} key={index} alignItems="center">
                            <FormControl fullWidth>
                                <InputLabel>Forma</InputLabel>
                                <Select value={p.forma} label="Forma" onChange={(e) => handlePagamentoChange(index, 'forma', e.target.value)}>
                                    <MenuItem value="Pix">Pix</MenuItem>
                                    <MenuItem value="Dinheiro">Dinheiro</MenuItem>
                                    <MenuItem value="Cartão de Crédito">Cartão de Crédito</MenuItem>
                                    <MenuItem value="Cartão de Débito">Cartão de Débito</MenuItem>
                                </Select>
                            </FormControl>
                            <TextField label="Valor" type="number" value={p.valor} onChange={(e) => handlePagamentoChange(index, 'valor', e.target.value)} fullWidth required inputProps={{ step: "0.01", min: "0" }} />
                            {pagamentos.length > 1 && (
                                <IconButton onClick={() => removerPagamento(index)} color="error">
                                    <RemoveCircleIcon />
                                </IconButton>
                            )}
                        </Stack>
                    ))}
                    <Button startIcon={<AddCircleIcon />} onClick={adicionarPagamento} sx={{ alignSelf: 'flex-start' }}>
                        Adicionar outra forma de pagamento
                    </Button>

                    <Box sx={{ textAlign: 'right', mt: 2, p: 2, backgroundColor: '#f9f9f9', borderRadius: 1 }}>
                        <Typography variant="h6">Total da Venda: {formatarMoeda(totalVenda)}</Typography>
                        <Typography variant="h6">Total Pago: {formatarMoeda(totalPago)}</Typography>
                        <Typography variant="h5" color={Math.abs(restante) < 0.001 ? 'success.main' : 'error.main'} sx={{ fontWeight: 'bold' }}>
                            Restante: {formatarMoeda(restante)}
                        </Typography>
                    </Box>
                    
                    <Box>
                        <Button type="submit" variant="contained" color="primary" size="large" disabled={Math.abs(restante) > 0.001 || !nomeComprador}>
                            Registrar Venda
                        </Button>
                    </Box>
                </Stack>
              </Box>
            )}
        </Paper>
    );
}

export default TelaVenda;