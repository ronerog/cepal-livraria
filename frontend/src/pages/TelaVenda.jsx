// src/pages/TelaVenda.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
  Typography, Button, Box, Paper, Stack, TextField, Autocomplete,
  IconButton, List, ListItem, ListItemText, Divider, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import GiftIcon from '@mui/icons-material/CardGiftcard';
import { useNotification } from '../context/NotificationContext';
import PasswordPrompt from '../components/PasswordPrompt'; // ajuste o caminho se necessário

function TelaVenda() {
  // Estados da Venda
  const [nomeComprador, setNomeComprador] = useState('');
  const [pagamentos, setPagamentos] = useState([{ forma: 'Pix', valor: '' }]);
  const [descontoInput, setDescontoInput] = useState(''); // Valor digitado no input
  const [descontoAplicado, setDescontoAplicado] = useState(0); // Valor do desconto efetivamente aplicado

  // Estados do Carrinho
  const [livros, setLivros] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  const [livroParaAdicionar, setLivroParaAdicionar] = useState(null);
  const [qtdParaAdicionar, setQtdParaAdicionar] = useState(1);
  const [codigoBarras, setCodigoBarras] = useState('');

  // Estados do PasswordPrompt
  const [openPasswordPrompt, setOpenPasswordPrompt] = useState(false);
  const [passwordTargetLivroId, setPasswordTargetLivroId] = useState(null);

  const navigate = useNavigate();
  const { showNotification } = useNotification();

  useEffect(() => {
    api.get('/livros')
      .then(res => setLivros(res.data.filter(livro => livro.estoque > 0)))
      .catch(error => console.error("Erro ao buscar livros:", error));
  }, []);

  const formatarMoeda = (valor) => {
    if (isNaN(valor)) return "R$ 0,00";
    // formatação simples com duas casas e vírgula
    return `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;
  };

  const adicionarLivroAoCarrinho = (livro, quantidade) => {
    if (!livro) return;
    const estoqueDisponivel = livro.estoque;
    const itemExistente = carrinho.find(item => item.livro.id === livro.id);
    const quantidadeNoCarrinho = itemExistente ? itemExistente.quantidade : 0;

    if ((quantidadeNoCarrinho + quantidade) > estoqueDisponivel) {
      showNotification(`Estoque insuficiente. Apenas ${estoqueDisponivel} unidades disponíveis.`, 'error');
      return;
    }

    if (itemExistente) {
      setCarrinho(carrinho.map(item =>
        item.livro.id === livro.id
          ? { ...item, quantidade: item.quantidade + quantidade }
          : item
      ));
    } else {
      // armazenamos o objeto livro completo (como seu backend espera)
      setCarrinho([...carrinho, { livro: livro, quantidade: quantidade }]);
    }
  };

  const handleScan = async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!codigoBarras) return;
      try {
        const response = await api.get(`/livros/codigo/${codigoBarras}`);
        const livroEncontrado = response.data;
        adicionarLivroAoCarrinho(livroEncontrado, 1);
        showNotification(`'${livroEncontrado.titulo}' adicionado ao carrinho.`);
        setCodigoBarras('');
      } catch (error) {
        showNotification(`Livro com código "${codigoBarras}" não encontrado.`, 'error');
        setCodigoBarras('');
      }
    }
  };

  const handleAddToCart = () => {
    if (!livroParaAdicionar || qtdParaAdicionar <= 0) {
      showNotification("Selecione um livro e uma quantidade válida.", 'error');
      return;
    }
    adicionarLivroAoCarrinho(livroParaAdicionar, qtdParaAdicionar);
    setLivroParaAdicionar(null);
    setQtdParaAdicionar(1);
  };

  const handleRemoveFromCart = (livroId) => {
    setCarrinho(carrinho.filter(item => item.livro.id !== livroId));
  };

  // APLICAR DESCONTO (global em %)
  const handleAplicarDesconto = () => {
    const valor = parseFloat(descontoInput);
    if (!isNaN(valor) && valor >= 0 && valor <= 100) {
      setDescontoAplicado(valor);
      showNotification(`Desconto de ${valor}% aplicado com sucesso!`);
    } else {
      showNotification("Por favor, insira um valor de desconto válido (0 a 100).", "error");
    }
  };

  // Abertura do PasswordPrompt para cortesia
  const abrirPromptSenha = (livroId) => {
    setPasswordTargetLivroId(livroId);
    setOpenPasswordPrompt(true);
  };

  const fecharPromptSenha = () => {
    setPasswordTargetLivroId(null);
    setOpenPasswordPrompt(false);
  };

  // Recebe a senha do PasswordPrompt e valida no backend
  const confirmarSenhaParaCortesia = async (password) => {
    if (!passwordTargetLivroId) {
      showNotification('Livro alvo não identificado.', 'error');
      return;
    }

    if (!password) {
      showNotification('Digite a senha.', 'error');
      return;
    }

    try {
      // endpoint que deve validar a senha (implementei /verify-cortesia no backend)
      await api.post('/verify-cortesia', { password });

      // aplica cortesia no item do carrinho: salva precoOriginal e zera preco atual
      setCarrinho(prev =>
        prev.map(item => {
          if (item.livro.id === passwordTargetLivroId) {
            // se já tiver sido cortesia, ignora
            if (item.cortesia) return item;
            const precoOriginal = item.livro.preco;
            const novoLivro = { ...item.livro, preco: 0 };
            return { ...item, livro: novoLivro, precoOriginal, cortesia: true };
          }
          return item;
        })
      );

      showNotification('Cortesia aplicada com sucesso.');
    } catch (err) {
      showNotification('Senha incorreta para cortesia.', 'error');
    } finally {
      fecharPromptSenha();
    }
  };

  // Cálculos de totais
  const subTotal = useMemo(() => {
    return carrinho.reduce((acc, item) => acc + (Number(item.livro.preco || 0) * item.quantidade), 0);
  }, [carrinho]);

  const valorDesconto = useMemo(() => {
    return (subTotal * descontoAplicado) / 100;
  }, [subTotal, descontoAplicado]);

  const totalFinal = useMemo(() => {
    const total = subTotal - valorDesconto;
    // evitar +- 0.0000
    return Math.round(total * 100) / 100;
  }, [subTotal, valorDesconto]);

  const totalPago = useMemo(() => {
    return pagamentos.reduce((acc, p) => acc + parseFloat(p.valor || 0), 0);
  }, [pagamentos]);

  const restante = Math.round((totalFinal - totalPago) * 100) / 100;

  // Gerenciamento de pagamentos
  const handlePagamentoChange = (index, field, value) => {
    const novosPagamentos = [...pagamentos];
    novosPagamentos[index][field] = value;
    setPagamentos(novosPagamentos);
  };

  const adicionarPagamento = () => {
    setPagamentos([...pagamentos, { forma: 'Dinheiro', valor: '' }]);
  };

  const removerPagamento = (index) => {
    setPagamentos(pagamentos.filter((_, i) => i !== index));
  };

  // Submissão da venda
  const handleSubmit = (e) => {
    e.preventDefault();
    if (carrinho.length === 0) {
      showNotification("O carrinho está vazio.", 'error');
      return;
    }
    if (Math.abs(restante) > 0.01) {
      showNotification(`O total pago (${formatarMoeda(totalPago)}) não corresponde ao total da venda (${formatarMoeda(totalFinal)}).`, 'error');
      return;
    }

    // Envia carrinho no formato atual (backend existente já consome item.livro.id e item.livro.preco)
    const vendaData = {
      carrinho, // itens com livro (se cortesia, preço já é 0)
      pagamentos,
      nomeComprador,
      subtotal: subTotal,
      desconto: valorDesconto,
      total: totalFinal,
    };

    api.post('/vendas', vendaData)
      .then(() => {
        showNotification('Venda registrada com sucesso!');
        navigate('/relatorio');
      })
      .catch(error => {
        showNotification(`Erro: ${error.response?.data?.error || 'Não foi possível registrar a venda.'}`, 'error');
      });
  };

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Registrar Nova Venda
      </Typography>

      {/* SEÇÃO PARA ADICIONAR ITENS */}
      <Stack direction="column" spacing={2} sx={{ mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <Autocomplete
            sx={{ flex: 4, width: '100%' }}
            options={livros}
            getOptionLabel={(option) => `${option.titulo} (Estoque: ${option.estoque})`}
            value={livroParaAdicionar}
            onChange={(e, newValue) => setLivroParaAdicionar(newValue)}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="Pesquise um Livro" />}
          />
          <TextField
            sx={{ flex: 1, width: '100%' }}
            label="Qtd."
            type="number"
            value={qtdParaAdicionar}
            onChange={(e) => setQtdParaAdicionar(parseInt(e.target.value, 10) || 1)}
            inputProps={{ min: "1" }}
          />
          <Button variant="contained" onClick={handleAddToCart} startIcon={<AddCircleIcon />} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Adicionar
          </Button>
        </Stack>

        {/* Campo para leitura de código de barras (seus handlers cuidam do Enter) */}
        {/* <TextField
          id="codigo-barras"
          label="Escanear Código de Barras"
          type="text"
          value={codigoBarras}
          onChange={(e) => setCodigoBarras(e.target.value)}
          onKeyDown={handleScan}
          fullWidth
          sx={{ mt: 1 }}
        /> */}
      </Stack>

      <Divider>Carrinho de Compras</Divider>

      <List sx={{ my: 2 }}>
        {carrinho.map(item => (
          <ListItem
            key={item.livro.id}
            secondaryAction={
              <>
                <Button
                  variant="outlined" // Use "contained" se for a ação mais importante
                  color="primary" // Cor padrão do tema (geralmente azul)
                  startIcon={<GiftIcon />}
                  onClick={() => abrirPromptSenha(item.livro.id)}
                  title="Conceder o livro gratuitamente (Cortesia)"
                >
                  Aplicar Cortesia
                </Button>
                <IconButton edge="end" onClick={() => handleRemoveFromCart(item.livro.id)}>
                  <DeleteIcon color="error" />
                </IconButton>
              </>
            }
          >
            <ListItemText
              primary={`${item.quantidade}x ${item.livro.titulo} ${item.cortesia ? ' (CORTESIA)' : ''}`}
              secondary={
                item.cortesia
                  ? `Subtotal: ${formatarMoeda(item.livro.preco * item.quantidade)} • preço original ${formatarMoeda(item.precoOriginal)}`
                  : `Subtotal: ${formatarMoeda(item.livro.preco * item.quantidade)}`
              }
            />
          </ListItem>
        ))}
        {carrinho.length === 0 && (<Typography sx={{ textAlign: 'center', color: 'text.secondary', my: 2 }}>O carrinho está vazio.</Typography>)}
      </List>

      {/* Componente de prompt de senha (você já criou) */}
      <PasswordPrompt
        open={openPasswordPrompt}
        onClose={fecharPromptSenha}
        onConfirm={confirmarSenhaParaCortesia}
      />

      {/* --- SEÇÃO DE FINALIZAÇÃO DA VENDA --- */}
      {carrinho.length > 0 && (
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Divider sx={{ mb: 3 }}>Detalhes Finais</Divider>
          <Stack spacing={3}>
            <TextField label="Nome do Comprador (Opcional)" type="text" value={nomeComprador} onChange={(e) => setNomeComprador(e.target.value)} fullWidth />

            {/* DESCONTO */}
            <Typography variant="h6">Desconto</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                label="Desconto (%)"
                type="number"
                value={descontoInput}
                onChange={(e) => setDescontoInput(e.target.value)}
                sx={{ flex: 1 }}
                inputProps={{ min: "0", max: "100", step: "0.01" }}
              />
              <Button variant="outlined" onClick={handleAplicarDesconto}>Aplicar</Button>
            </Stack>

            {/* PAGAMENTOS */}
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
                {pagamentos.length > 1 && (<IconButton onClick={() => removerPagamento(index)} color="error"><RemoveCircleIcon /></IconButton>)}
              </Stack>
            ))}
            <Button startIcon={<AddCircleIcon />} onClick={adicionarPagamento} sx={{ alignSelf: 'flex-start' }}>Adicionar outra forma de pagamento</Button>

            {/* TOTAIS */}
            <Box sx={{ textAlign: 'right', p: 2, backgroundColor: '#f9f9f9', borderRadius: 1, width: '100%' }}>
              <Typography variant="body1">Subtotal: {formatarMoeda(subTotal)}</Typography>
              <Typography variant="body1" color="error.main">Desconto ({descontoAplicado}%): - {formatarMoeda(valorDesconto)}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Total Final: {formatarMoeda(totalFinal)}</Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body1">Total Pago: {formatarMoeda(totalPago)}</Typography>
              <Typography variant="h6" color={Math.abs(restante) < 0.01 ? 'success.main' : 'error.main'} sx={{ fontWeight: 'bold' }}>
                Restante: {formatarMoeda(restante)}
              </Typography>
            </Box>

            <Box>
              <Button type="submit" variant="contained" color="primary" size="large" disabled={Math.abs(restante) > 0.01}>
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
