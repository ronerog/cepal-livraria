const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./db');
require('dotenv').config({ path: '../.env' });

const app = express();
const port = 5001;

// Middlewares
app.use(cors({ origin: true, credentials: true })); // aceita qualquer origem
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
app.post('/api/livros', authMiddleware, async (req, res) => {
  try {
    const { titulo, autor, preco, estoque } = req.body;
    const newLivro = await db.query(
      "INSERT INTO livros (titulo, autor, preco, estoque) VALUES ($1, $2, $3, $4) RETURNING *",
      [titulo, autor, preco, estoque]
    );
    res.status(201).json(newLivro.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Atualizar livro
app.put('/api/livros/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, autor, preco, estoque } = req.body;
    const updateQuery = `
      UPDATE livros 
      SET titulo = $1, autor = $2, preco = $3, estoque = $4 
      WHERE id = $5 
      RETURNING *
    `;
    const { rows } = await db.query(updateQuery, [titulo, autor, preco, estoque, id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Livro não encontrado para atualizar' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
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
    const query = `
      SELECT 
          v.id, 
          v.preco_total, 
          v.forma_pagamento, 
          v.nome_comprador, 
          v.data_venda,
          json_agg(json_build_object(
              'livro_titulo', l.titulo,
              'quantidade', vi.quantidade,
              'preco_unitario', vi.preco_unitario
          )) as itens
      FROM vendas v
      JOIN venda_itens vi ON v.id = vi.venda_id
      JOIN livros l ON vi.livro_id = l.id
      GROUP BY v.id
      ORDER BY v.data_venda DESC;
    `;
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Registrar venda (otimizado)
app.post('/api/vendas', async (req, res) => {
  const { carrinho, pagamentos, nomeComprador } = req.body;
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Obtem livros do carrinho de uma vez
    const ids = carrinho.map(item => item.livro.id);
    const livrosRes = await client.query(
      `SELECT id, preco, estoque, titulo FROM livros WHERE id = ANY($1) FOR UPDATE`,
      [ids]
    );
    const livrosMap = {};
    livrosRes.rows.forEach(l => { livrosMap[l.id] = l; });

    // Verifica estoque e calcula preço total
    let precoTotal = 0;
    for (const item of carrinho) {
      const livro = livrosMap[item.livro.id];
      if (!livro) throw new Error(`Livro com ID ${item.livro.id} não encontrado.`);
      if (livro.estoque < item.quantidade) throw new Error(`Estoque insuficiente para o livro: ${livro.titulo}`);
      precoTotal += livro.preco * item.quantidade;
    }

    // Insere venda
    const vendaQuery = `
      INSERT INTO vendas (preco_total, forma_pagamento, nome_comprador)
      VALUES ($1, $2, $3) RETURNING id
    `;
    const novaVenda = await client.query(vendaQuery, [precoTotal, JSON.stringify(pagamentos), nomeComprador]);
    const vendaId = novaVenda.rows[0].id;

    // Insere itens e atualiza estoque de uma vez
    const insertPromises = carrinho.map(item => {
      const livro = livrosMap[item.livro.id];
      return Promise.all([
        client.query(
          `INSERT INTO venda_itens (venda_id, livro_id, quantidade, preco_unitario)
           VALUES ($1, $2, $3, $4)`,
          [vendaId, livro.id, item.quantidade, livro.preco]
        ),
        client.query(
          `UPDATE livros SET estoque = estoque - $1 WHERE id = $2`,
          [item.quantidade, livro.id]
        )
      ]);
    });
    await Promise.all(insertPromises);

    await client.query('COMMIT');
    res.status(201).json({ id: vendaId, message: 'Venda registrada com sucesso' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Inicia servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
