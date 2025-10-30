// scripts/debug_xlsx.js
const xlsx = require('xlsx');
const path = require('path');

const xlsxPath = path.resolve(process.argv[2] || './ACERVO DE LIVROS  - IOGR.xlsx');
const sheetName = process.argv[3] || 'Dudu e Dessica';

if (!require('fs').existsSync(xlsxPath)) {
  console.error('❌ Arquivo XLSX não encontrado em:', xlsxPath);
  process.exit(1);
}

const wb = xlsx.readFile(xlsxPath, { raw: false });
console.log('Abas no arquivo:', wb.SheetNames);

const sheet = wb.Sheets[sheetName];
if (!sheet) {
  console.error('❌ Aba não encontrada:', sheetName);
  process.exit(1);
}

function printRangeInfo(rangeStart) {
  console.log(`\n--- sheet_to_json(range:${rangeStart}) first 8 rows ---`);
  const arr = xlsx.utils.sheet_to_json(sheet, { defval: '', range: rangeStart });
  console.log(JSON.stringify(arr.slice(0,8), null, 2));
}

// tenta vários ranges para ver onde o cabeçalho está
for (let r = 0; r <= 6; r++) {
  try { printRangeInfo(r); } catch(e){ console.error('err range', r, e.message); }
}

// mostrar os valores brutos de A1:D20 (útil para ver exatamente o que existe em cada célula)
console.log('\n--- Raw cells A1:D20 ---');
for (let row = 1; row <= 20; row++) {
  const vals = [];
  for (let col = 0; col < 4; col++) {
    const cellAddr = xlsx.utils.encode_cell({ r: row-1, c: col }); // r,c zero-based
    const cell = sheet[cellAddr];
    vals.push(cell ? String(cell.v) : '');
  }
  console.log(row.toString().padStart(2,' '), '|', vals.join(' | '));
}
