require('dotenv').config({ path: '../.env' });
const db = require('./db');

async function limparBanco() {
  const client = await db.getClient();
  try {
    console.log('🧹 Limpando tabelas...');
    await client.query('BEGIN');
    // Limpa as tabelas de vendas e livros
    await client.query('TRUNCATE TABLE venda_itens, vendas, livros RESTART IDENTITY CASCADE');
    await client.query('COMMIT');
    console.log('✅ Banco limpo com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao limpar o banco:', err);
  } finally {
    client.release();
  }
}

limparBanco();
