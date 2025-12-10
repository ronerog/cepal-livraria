// backend/src/import.js

require('dotenv').config({ path: '../.env' });

const fs = require('fs');
const csv = require('csv-parser');
const db = require('./db');

const filePath = './src/livros/livros_import.csv';

async function importarLivros() {
  console.log(`Iniciando a importação do arquivo: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Erro: Arquivo não encontrado em ${filePath}. Verifique o caminho.`);
    return;
  }
  
  const client = await db.getClient();
  const promises = [];
  let contadorDeLinhas = 0; // Para contar as linhas processadas

  const stream = fs.createReadStream(filePath, { encoding: 'latin1' })
    .pipe(csv({ 
        separator: ';', 
        skipLines: 1,
        mapHeaders: ({ header }) => header.trim()
    }));

  for await (const row of stream) {
    // ----> ESTA É A LINHA MAIS IMPORTANTE PARA O NOSSO DIAGNÓSTICO <----
    console.log('Dados brutos lidos da linha:', row);
    
    contadorDeLinhas++; // Incrementa o contador
    const titulo = row['Título'];
    const estoque = parseInt(row['Saldo estoque'], 10) || 0;
    const autorPadrao = null; 
    const precoPadrao = 0.00;

    if (titulo) {
      const query = 'INSERT INTO livros (titulo, autor, preco, estoque) VALUES ($1, $2, $3, $4) ON CONFLICT (titulo) DO NOTHING;';
      const values = [titulo, autorPadrao, precoPadrao, estoque];
      promises.push(client.query(query, values));
    }
  }

  console.log(`\n--- Fim do processamento do arquivo. Total de linhas lidas pelo script: ${contadorDeLinhas} ---\n`);

  try {
    const results = await Promise.all(promises);
    console.log(`✅ Importação concluída! ${results.filter(r => r.rowCount > 0).length} novos livros foram inseridos.`);
  } catch (error) {
    console.error('❌ Erro durante a importação:', error);
  } finally {
    client.release();
    console.log('Conexão com o banco de dados liberada.');
  }
}

importarLivros();