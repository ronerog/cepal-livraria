const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./db');
require('dotenv').config({ path: '../.env' });

const app = express();
const port = 5001;

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Serve arquivos estáticos do front-end
app.use(express.static(path.join(__dirname, '../public')));

// Rota raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Middleware de autenticação
const authMiddleware = (req, res, next) => {
  const { auth_token } = req.cookies;
  if (auth_token && auth_token === process.env.ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'Acesso não autorizado. Por favor, faça o login de administrador.' });
};

// --- ROTAS DA API ---

// Login
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    res.cookie('auth_token', password, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 3600000
    });
    return res.status(200).json({ message: 'Login bem-sucedido' });
  }
  res.status(401).json({ error: 'Senha incorreta' });
});

app.get('/api/livros/codigo/:codigo', async (req, res) => {
  const { codigo } = req.params;
  try {
    const result = await db.query('SELECT * FROM livros WHERE codigo_barras = $1', [codigo]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Livro não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.status(200).json({ message: 'Logout bem-sucedido' });
});

// Listar todos os livros
app.get('/api/livros', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM livros ORDER BY titulo ASC');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Buscar livro específico
app.get('/api/livros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM livros WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Livro não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Adicionar livro
app.post('/api/livros', async (req, res) => {
  const { titulo, autor, preco, estoque, codigo_barras } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO livros (titulo, autor, preco, estoque, codigo_barras) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [titulo, autor, preco, estoque, codigo_barras || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao inserir livro' });
  }
});


// Atualizar livro
app.put('/api/livros/:id', async (req, res) => {
  const { id } = req.params;
  const { titulo, autor, preco, estoque, codigo_barras } = req.body;
  try {
    const result = await db.query(
      'UPDATE livros SET titulo = $1, autor = $2, preco = $3, estoque = $4, codigo_barras = $5 WHERE id = $6 RETURNING *',
      [titulo, autor, preco, estoque, codigo_barras || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Livro não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar livro' });
  }
});

// Deletar livro
app.delete('/api/livros/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query('DELETE FROM livros WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Livro não encontrado para deletar' });
    res.status(204).send();
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Não é possível deletar este livro pois ele já possui vendas registradas.' });
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Listar vendas
app.get('/api/vendas', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        v.id, 
        v.nome_comprador, 
        v.subtotal,    
        v.desconto,     
        v.total,         
        v.data_venda,
        v.forma_pagamento, 
        json_agg(
          json_build_object(
            'livro', l.titulo, 
            'quantidade', vi.quantidade, 
            'preco_unitario', vi.preco_unitario
          )
        ) as itens
      FROM vendas v
      JOIN venda_itens vi ON v.id = vi.venda_id
      JOIN livros l ON vi.livro_id = l.id
      GROUP BY v.id
      ORDER BY v.data_venda DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao buscar vendas:", err);
    res.status(500).json({ error: 'Erro ao buscar vendas' });
  }
});

// Registrar venda (otimizado)
app.post('/api/vendas', async (req, res) => {
  const { carrinho, pagamentos, nomeComprador, subtotal, desconto, total, formaPagamento } = req.body;

  const client = await db.getClient();

    try {
    await client.query('BEGIN');

    // Insere a venda na tabela 'vendas' com os campos corretos
    const vendaQuery = `
      INSERT INTO vendas (nome_comprador, subtotal, desconto, total, forma_pagamento) 
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `;
    const vendaResult = await client.query(vendaQuery, [nomeComprador, subtotal, desconto, total, formaPagamento]);
    const vendaId = vendaResult.rows[0].id;

    // Itera sobre cada item do carrinho para:
    // 1. Inserir em 'venda_itens'
    // 2. Atualizar o estoque em 'livros'
    for (const item of carrinho) {
      // Insere o item na tabela 'venda_itens'
      await client.query(
        'INSERT INTO venda_itens (venda_id, livro_id, quantidade, preco_unitario) VALUES ($1, $2, $3, $4)',
        [vendaId, item.livro.id, item.quantidade, item.livro.preco]
      );
      
      // Atualiza (diminui) o estoque do livro correspondente
      const updateEstoqueResult = await client.query(
        'UPDATE livros SET estoque = estoque - $1 WHERE id = $2 AND estoque >= $1',
        [item.quantidade, item.livro.id]
      );

      // Se a atualização do estoque não afetou nenhuma linha, o estoque era insuficiente.
      if (updateEstoqueResult.rowCount === 0) {
        throw new Error(`Estoque insuficiente para o livro: ${item.livro.titulo}`);
      }
    }

    // Se tudo deu certo, confirma a transação
    await client.query('COMMIT');
    res.status(201).json({ message: 'Venda registrada com sucesso!', vendaId });

  } catch (error) {
    // Se qualquer passo falhou, desfaz todas as operações
    await client.query('ROLLBACK');
    console.error('Erro ao registrar venda:', error);
    res.status(500).json({ error: error.message || 'Erro interno do servidor ao registrar a venda.' });
  } finally {
    // Libera a conexão de volta para a pool
    client.release();
  }
});

app.post('/api/verify-cortesia', (req, res) => {
  try {
    const { password } = req.body;
    console.log('[verify-cortesia] senha recebida:', JSON.stringify(password));
    console.log('[verify-cortesia] ADMIN_PASSWORD env:', JSON.stringify(process.env.ADMIN_PASSWORD));

    if (!password) return res.status(400).json({ error: 'Senha é obrigatória.' });

    if (String(password).trim() === String(process.env.ADMIN_PASSWORD || '').trim()) {
      return res.status(200).json({ message: 'Senha válida' });
    }
    return res.status(401).json({ error: 'Senha incorreta' });
  } catch (err) {
    console.error('[verify-cortesia] erro:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// também expor sem /api caso algum lugar chame /verify-cortesia
app.post('/verify-cortesia', (req, res) => {
  const { password } = req.body;
  if (String(password || '').trim() === String(process.env.ADMIN_PASSWORD || '').trim()) {
    return res.status(200).json({ message: 'Senha válida' });
  }
  return res.status(401).json({ error: 'Senha incorreta' });
});

// Inicia servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
