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
          ) ORDER BY vi.id
        ) as itens
      FROM vendas v
      JOIN venda_itens vi ON v.id = vi.venda_id
      JOIN livros l ON vi.livro_id = l.id
      GROUP BY v.id, v.nome_comprador, v.subtotal, v.desconto, v.total, v.data_venda, v.forma_pagamento
      ORDER BY v.data_venda DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao buscar vendas:", err);
    res.status(500).json({ error: 'Erro ao buscar vendas' });
  }
});

app.post('/api/vendas', async (req, res) => {
  const {
    carrinho = [],
    pagamentos = null,          // array esperado
    formaPagamento = null,      // compatibilidade antiga (string)
    nomeComprador = null,
    subtotal = 0,
    desconto = 0,
    total = 0
  } = req.body;

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Normaliza pagamentos:
    let pagamentosNormalizados = [];

    if (Array.isArray(pagamentos)) {
      pagamentosNormalizados = pagamentos.map(p => ({
        forma: String((p && p.forma) || '').trim(),
        valor: (p && (p.valor === '' || p.valor == null)) ? 0 : Number(p.valor || 0)
      }));
    } else if (formaPagamento) {
      pagamentosNormalizados = [{ forma: String(formaPagamento).trim(), valor: 0 }];
    } else {
      pagamentosNormalizados = [];
    }

    // Insere a venda gravando forma_pagamento como jsonb e timestamp
    const vendaQuery = `
      INSERT INTO vendas (nome_comprador, subtotal, desconto, total, forma_pagamento, data_venda) 
      VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
      RETURNING id
    `;
    const vendaResult = await client.query(vendaQuery, [
      nomeComprador || null,
      subtotal,
      desconto,
      total,
      JSON.stringify(pagamentosNormalizados)
    ]);
    const vendaId = vendaResult.rows[0].id;

    // Insere itens e atualiza estoque
    for (const item of carrinho) {
      await client.query(
        'INSERT INTO venda_itens (venda_id, livro_id, quantidade, preco_unitario) VALUES ($1, $2, $3, $4)',
        [vendaId, item.livro.id, item.quantidade, item.livro.preco]
      );

      const updateEstoqueResult = await client.query(
        'UPDATE livros SET estoque = estoque - $1 WHERE id = $2 AND estoque >= $1',
        [item.quantidade, item.livro.id]
      );

      if (updateEstoqueResult.rowCount === 0) {
        throw new Error(`Estoque insuficiente para o livro: ${item.livro.titulo}`);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Venda registrada com sucesso!', vendaId });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao registrar venda:', error);
    res.status(500).json({ error: error.message || 'Erro interno do servidor ao registrar a venda.' });
  } finally {
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

// --- RELATÓRIOS: Top livros e por forma de pagamento ---

// Função auxiliar para detectar o tipo da coluna forma_pagamento (jsonb ou texto)
const detectFormaPagamentoTipo = async () => {
  const q = `
    SELECT data_type
    FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'forma_pagamento'
    LIMIT 1;
  `;
  const r = await db.query(q);
  if (r.rows.length === 0) return 'text';
  const dt = String(r.rows[0].data_type || '').toLowerCase();
  if (dt.includes('json')) return 'json';
  return dt; // 'text', 'character varying', etc.
};

/**
 * 📘 Relatório: Top livros vendidos
 * GET /api/relatorios/top-livros
 */
app.get('/api/relatorios/top-livros', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        l.id,
        l.titulo,
        COALESCE(SUM(vi.quantidade)::bigint, 0) AS total_vendido
      FROM venda_itens vi
      JOIN livros l ON vi.livro_id = l.id
      GROUP BY l.id, l.titulo
      ORDER BY total_vendido DESC
      LIMIT 500;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro relatorio top-livros:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório de top livros' });
  }
});

/**
 * 💳 Relatório: Vendas por forma de pagamento
 * GET /api/relatorios/por-pagamento
 *
 * Lida com dois casos:
 *  - JSONB (formas múltiplas, ex: [{"forma":"Pix","valor":30},...])
 *  - Texto (antigo, ex: "Voucher SEDUC R$ 100,00 + Cartão de Débito R$ 32,00")
 */
app.get('/api/relatorios/por-pagamento', async (req, res) => {
  try {
    // 1) Pegamos id, forma_pagamento e a data já convertida para America/Recife (YYYY-MM-DD)
    //    Se o tipo de data na sua tabela for timestamptz isto funciona bem.
    //    Se for timestamp without time zone, remova o AT TIME ZONE 'UTC' e ajuste conforme seu ambiente.
    const q = `
      SELECT
        id,
        forma_pagamento,
        (data_venda AT TIME ZONE 'America/Recife')::date AS sale_date
      FROM vendas
      WHERE forma_pagamento IS NOT NULL
    `;
    const { rows: vendas } = await db.query(q);

    // 2) mapa para canonical names (baixa/sem acento/trim)
    const canonicalMap = {
      'pix': 'Pix',
      'dinheiro': 'Dinheiro',
      'cartao credito': 'Cartão de Crédito',
      'cartão credito': 'Cartão de Crédito',
      'cartao de credito': 'Cartão de Crédito',
      'cartão de crédito': 'Cartão de Crédito',
      'cartao de débito': 'Cartão de Débito',
      'cartao debito': 'Cartão de Débito',
      'cartão de débito': 'Cartão de Débito',
      'voucher seduc': 'Voucher SEDUC',
      'voucher': 'Voucher SEDUC',
      // adicione outros sinônimos que apareçam no seu DB
    };

    const normalizeKey = (s) => {
      if (!s) return 'NÃO INFORMADO';
      // remove acentos básicos e pontuações, transforma em lower
      const noAccent = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      const onlyAlnum = noAccent.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      return canonicalMap[onlyAlnum] || (onlyAlnum ? (onlyAlnum.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')) : s);
    };

    // parse token helper para strings tipo "Voucher SEDUC R$ 100,00" -> { forma: 'Voucher SEDUC', valor: 100 }
    const parseToken = (rawToken) => {
      const token = String(rawToken || '').trim();
      // tenta achar o último número na string (suporta 1.234,56 ou 1234.56)
      const numberMatches = token.match(/([0-9]+(?:[.,][0-9]+)?)(?!.*[0-9.,])/g);
      let valor = 0;
      if (numberMatches && numberMatches.length > 0) {
        const lastNum = numberMatches[numberMatches.length - 1].replace(',', '.');
        const parsed = parseFloat(lastNum);
        if (!isNaN(parsed)) valor = parsed;
      }

      // retira trecho 'R$ ...' e números para obter nome
      let nome = token.replace(/R\$[\s]*[0-9.,]+/ig, '')
                      .replace(/[0-9]+(?:[.,][0-9]+)?/g, '')
                      .replace(/[\+\-]/g, '')
                      .trim();

      if (!nome) {
        // se sobrou nada, tenta extrair palavra antes do R$
        const beforeR = token.split('R$')[0].trim();
        nome = beforeR || token;
      }

      return { forma: nome || 'NÃO INFORMADO', valor: Number(Number(valor).toFixed(2)) };
    };

    // 3) agregação: key = `${sale_date}||${formaCanonical}`
    const agg = new Map();

    for (const v of vendas) {
      const vendaId = v.id;
      const dateISO = v.sale_date ? v.sale_date.toISOString().slice(0, 10) : 'NÃO INFORMADO';
      const fp = v.forma_pagamento;

      let parts = [];

      // Se já for array JS (driver pode retornar jsonb como objeto)
      if (Array.isArray(fp)) {
        parts = fp.map(p => {
          const nome = String(p.form || p.forma || '').trim() || '';
          const valor = (p && (p.valor === '' || p.valor == null)) ? 0 : Number(p.valor || 0);
          return { forma: nome, valor: Number(valor || 0) };
        });
      } else {
        const asString = String(fp);

        // tenta parse JSON (stringified JSON array/object)
        try {
          const parsed = JSON.parse(asString);
          if (Array.isArray(parsed)) {
            parts = parsed.map(p => ({ forma: String(p.form || p.forma || '').trim() || '', valor: Number(p.valor || 0) || 0 }));
          } else if (parsed && typeof parsed === 'object') {
            parts = [{ forma: String(parsed.form || parsed.forma || '').trim() || '', valor: Number(parsed.valor || 0) || 0 }];
          }
        } catch (err) {
          // não era JSON -> split por '+'
        }

        if (parts.length === 0) {
          const tokens = asString.split('+').map(t => t.trim()).filter(Boolean);
          parts = tokens.map(t => parseToken(t));
        }
      }

      // agora normalize o nome e agregue sem duplicar vendaId por forma+date
      const seenFormasThisVenda = new Set(); // evita contar uma mesma venda duas vezes para mesma forma se parts tiver a mesma forma repetida
      for (const p of parts) {
        const formaCanonical = normalizeKey(p.forma);
        const key = `${dateISO}||${formaCanonical}`;

        // evita contar a mesma venda duas vezes para a mesma forma (se, por acaso, a venda tiver 2 partes iguais)
        const dedupeKey = `${vendaId}||${key}`;
        if (seenFormasThisVenda.has(dedupeKey)) continue;
        seenFormasThisVenda.add(dedupeKey);

        if (!agg.has(key)) agg.set(key, { vendaIds: new Set(), valor_total: 0 });
        const entry = agg.get(key);
        entry.vendaIds.add(vendaId);
        entry.valor_total += Number(p.valor || 0) || 0;
      }
    }

    // 4) transformar em array e ordenar
    const rows = Array.from(agg.entries()).map(([key, val]) => {
      const [dateISO, forma] = key.split('||');
      return {
        date: dateISO,
        forma,
        num_vendas: val.vendaIds.size,
        valor_total_contribuido: Math.round((val.valor_total + Number.EPSILON) * 100) / 100
      };
    });

    rows.sort((a, b) => {
      if (a.date === b.date) return b.valor_total_contribuido - a.valor_total_contribuido;
      return b.date.localeCompare(a.date);
    });

    return res.json({ tipo: 'json', rows });
  } catch (err) {
    console.error('Erro relatorio por-pagamento (JS agg):', err);
    res.status(500).json({ error: 'Erro ao gerar relatório por forma de pagamento' });
  }
});

app.get('/api/relatorios/totais-gerais', async (req, res) => {
  try {
    // totais principais (como já tinha)
    const qTotals = `
      SELECT
        COUNT(DISTINCT v.id) AS total_vendas_incl_cortesia,
        COALESCE(SUM(vi.quantidade), 0) AS total_livros_incl_cortesia,
        COUNT(DISTINCT v.id) FILTER (WHERE v.total <> 0) AS total_vendas_sem_cortesia,
        COALESCE(SUM(vi.quantidade) FILTER (WHERE v.total <> 0), 0) AS total_livros_sem_cortesia
      FROM vendas v
      LEFT JOIN venda_itens vi ON v.id = vi.venda_id
    `;
    const { rows: totalsRows } = await db.query(qTotals);
    const totals = totalsRows[0] || {
      total_vendas_incl_cortesia: 0,
      total_livros_incl_cortesia: 0,
      total_vendas_sem_cortesia: 0,
      total_livros_sem_cortesia: 0
    };

    // cortesias por livro: soma das quantidades apenas para vendas cujo total = 0
    const qCortesiasPorLivro = `
      SELECT
        l.id AS livro_id,
        l.titulo,
        COALESCE(SUM(vi.quantidade), 0) AS quantidade_cortesia
      FROM venda_itens vi
      JOIN vendas v ON vi.venda_id = v.id
      JOIN livros l ON vi.livro_id = l.id
      WHERE v.total = 0
      GROUP BY l.id, l.titulo
      HAVING COALESCE(SUM(vi.quantidade), 0) > 0
      ORDER BY quantidade_cortesia DESC, l.titulo
      LIMIT 1000;
    `;
    const { rows: cortesiasRows } = await db.query(qCortesiasPorLivro);

    // normaliza tipos numéricos (psql pode retornar strings)
    const cortesias_por_livro = cortesiasRows.map(r => ({
      livro_id: r.livro_id,
      titulo: r.titulo,
      quantidade_cortesia: Number(r.quantidade_cortesia || 0)
    }));

    // junta tudo
    return res.json({
      ...totals,
      cortesias_por_livro
    });
  } catch (err) {
    console.error('Erro relatorio totais-gerais:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório de totais gerais' });
  }
});

/**
 * ✅ Relatório: Por dia — vendas e livros (incl/excl cortesia)
 * GET /api/relatorios/por-dia-vendas
 *
 * Retorna rows: [{ date: 'YYYY-MM-DD', total_vendas_incl_cortesia, total_vendas_sem_cortesia, total_livros_incl_cortesia, total_livros_sem_cortesia }, ...]
 * usa timezone America/Recife para agrupar a data corretamente.
 */
app.get('/api/relatorios/por-dia-vendas', async (req, res) => {
  try {
    const q = `
      SELECT
        (data_venda AT TIME ZONE 'America/Recife')::date AS date,
        COUNT(DISTINCT v.id) AS total_vendas_incl_cortesia,
        COUNT(DISTINCT v.id) FILTER (WHERE v.total <> 0) AS total_vendas_sem_cortesia,
        COALESCE(SUM(vi.quantidade), 0) AS total_livros_incl_cortesia,
        COALESCE(SUM(vi.quantidade) FILTER (WHERE v.total <> 0), 0) AS total_livros_sem_cortesia
      FROM vendas v
      LEFT JOIN venda_itens vi ON v.id = vi.venda_id
      GROUP BY date
      ORDER BY date DESC
    `;
    const { rows } = await db.query(q);
    // normalize numeric types to Numbers (psql sometimes retorna strings)
    const normalized = rows.map(r => ({
      date: r.date ? r.date.toISOString().slice(0, 10) : null,
      total_vendas_incl_cortesia: Number(r.total_vendas_incl_cortesia || 0),
      total_vendas_sem_cortesia: Number(r.total_vendas_sem_cortesia || 0),
      total_livros_incl_cortesia: Number(r.total_livros_incl_cortesia || 0),
      total_livros_sem_cortesia: Number(r.total_livros_sem_cortesia || 0),
    }));
    res.json({ rows: normalized });
  } catch (err) {
    console.error('Erro relatorio por-dia-vendas:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório por dia' });
  }
});

// Inicia servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
