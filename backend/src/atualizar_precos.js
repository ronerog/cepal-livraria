// backend/src/atualizar_precos.js
require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const csv = require('csv-parser');
const db = require('./db');

const filePath = './src/livros/livros_import.csv';

function parsePrice(val) {
  if (!val && val !== 0) return 0.0;
  let s = String(val).trim();
  s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0.0 : +n.toFixed(2);
}

async function atualizar() {
  if (!fs.existsSync(filePath)) {
    console.error('Arquivo não encontrado:', filePath);
    process.exit(1);
  }
  const client = await db.getClient();
  try {
    const stream = fs.createReadStream(filePath, { encoding: 'latin1' })
      .pipe(csv({ separator: ';', mapHeaders: ({ header }) => header.trim() }));

    let count = 0;
    for await (const row of stream) {
      const titulo = (row['Título'] || row['Titulo'] || row['titulo'] || '').toString().trim();
      const preco = parsePrice(row['Preço'] ?? row['Preco'] ?? row['Valor venda'] ?? row['Valor']);
      if (!titulo) continue;

      // Atualiza pelo título; se preferir usar codigo_barras troque a condição
      const res = await client.query('UPDATE livros SET preco = $1 WHERE titulo = $2', [preco, titulo]);
      if (res.rowCount > 0) count += res.rowCount;
    }
    console.log('✅ Atualização de preços concluída. Linhas atualizadas:', count);
  } catch (err) {
    console.error('Erro ao atualizar preços:', err);
  } finally {
    client.release();
  }
}

atualizar();
