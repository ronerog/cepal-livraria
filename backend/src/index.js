require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser'); // 1. Importa o cookie-parser
const db = require('./db');

const app = express();
const port = 5001;

// Middlewares
// 2. Configuração do CORS correta e sem duplicatas
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser()); // 3. Usa o middleware para ler os cookies

// 4. DEFINIÇÃO DO MIDDLEWARE DE AUTENTICAÇÃO ("O Porteiro")
const authMiddleware = (req, res, next) => {
  // Pega o cookie de autenticação que foi enviado pelo navegador
  const { auth_token } = req.cookies;
  
  // Verifica se o valor do cookie é o mesmo da nossa senha mestra no .env
  if (auth_token && auth_token === process.env.ADMIN_PASSWORD) {
    // Se estiver tudo certo, a requisição pode continuar
    return next();
  }
  
  // Se não houver cookie ou se ele for inválido, bloqueia a requisição
  res.status(401).json({ error: 'Acesso não autorizado. Por favor, faça o login de administrador.' });
};


// --- ROTAS DA API ---

// Rota de Login (Pública)
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    // Se a senha estiver correta, cria um cookie seguro no navegador do usuário
    res.cookie('auth_token', password, { httpOnly: true, sameSite: 'strict', maxAge: 3600000 }); // Cookie dura 1 hora
    res.status(200).json({ message: 'Login bem-sucedido' });
  } else {
    res.status(401).json({ error: 'Senha incorreta' });
  }
});

// Rota de Logout (Pública)
app.post('/api/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.status(200).json({ message: 'Logout bem-sucedido' });
});

// Listar todos os livros (Pública)
app.get('/api/livros', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM livros ORDER BY titulo ASC');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Buscar um livro específico (Pública)
app.get('/api/livros/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM livros WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Livro não encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Adicionar um novo livro (Protegida)
app.post('/api/livros', authMiddleware, async (req, res) => {
    try {
        // Note que não precisamos mais da senha no corpo da requisição
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

// Atualizar um livro (Protegida)
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
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Livro não encontrado para atualizar' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Deletar um livro (Protegida)
app.delete('/api/livros/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query('DELETE FROM livros WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Livro não encontrado para deletar' });
    }
    res.status(204).send();
  } catch (err) {
    if (err.code === '23503') {
        return res.status(400).json({ error: 'Não é possível deletar este livro pois ele já possui vendas registradas.' });
    }
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


// Listar todas as vendas (Pública)
// [GET] /api/vendas - Listar todas as vendas com seus itens (para o relatório)
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


// [POST] /api/vendas - Registrar uma nova venda com múltiplos itens
app.post('/api/vendas', async (req, res) => {
  // Agora recebemos um "carrinho" com vários itens
  const { carrinho, pagamentos, nomeComprador } = req.body;
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // 1. Calcula o preço total real no back-end para segurança e verifica estoque
    let precoTotalCalculado = 0;
    for (const item of carrinho) {
      const livroRes = await client.query('SELECT preco, estoque FROM livros WHERE id = $1 FOR UPDATE', [item.livro.id]);
      const livro = livroRes.rows[0];
      if (!livro) {
        throw new Error(`Livro com ID ${item.livro.id} não encontrado.`);
      }
      if (livro.estoque < item.quantidade) {
        throw new Error(`Estoque insuficiente para o livro: ${item.livro.titulo}`);
      }
      precoTotalCalculado += livro.preco * item.quantidade;
    }

    // 2. Insere a venda principal na tabela 'vendas' para obter um ID
    const formaPagamentoJSON = JSON.stringify(pagamentos);
    const vendaQuery = `
      INSERT INTO vendas (preco_total, forma_pagamento, nome_comprador) 
      VALUES ($1, $2, $3) 
      RETURNING id
    `;
    const novaVenda = await client.query(vendaQuery, [precoTotalCalculado, formaPagamentoJSON, nomeComprador]);
    const vendaId = novaVenda.rows[0].id;

    // 3. Itera sobre o carrinho e insere cada item na nova tabela 'venda_itens'
    for (const item of carrinho) {
      // Pega o preço atual do livro para guardar no histórico da venda
      const livroRes = await client.query('SELECT preco FROM livros WHERE id = $1', [item.livro.id]);
      const precoUnitario = livroRes.rows[0].preco;

      // Insere o item da venda
      const itemQuery = `
        INSERT INTO venda_itens (venda_id, livro_id, quantidade, preco_unitario)
        VALUES ($1, $2, $3, $4)
      `;
      await client.query(itemQuery, [vendaId, item.livro.id, item.quantidade, precoUnitario]);

      // Atualiza o estoque do livro
      const estoqueQuery = 'UPDATE livros SET estoque = estoque - $1 WHERE id = $2';
      await client.query(estoqueQuery, [item.quantidade, item.livro.id]);
    }
    
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

// Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});