// scripts/export_xlsx_to_csv.js (VERSÃO FINAL - normaliza cabeçalhos)
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const iconv = require('iconv-lite');

const xlsxPath = path.resolve(process.argv[2] || './ACERVO DE LIVROS  - IOGR.xlsx');
const sheetName = process.argv[3] || 'Dudu e Dessica';
const outCsv = path.resolve(process.argv[4] || './backend/src/livros/livros_import.csv');

if (!fs.existsSync(xlsxPath)) {
  console.error('❌ Arquivo XLSX não encontrado em:', xlsxPath);
  process.exit(1);
}

const wb = xlsx.readFile(xlsxPath, { cellDates: true, raw: false });
const sheet = wb.Sheets[sheetName];
if (!sheet) {
  console.error('❌ Aba não encontrada:', sheetName);
  console.log('Abas disponíveis:', wb.SheetNames);
  process.exit(1);
}

// lê começando na linha 3 (range:2)
const rows = xlsx.utils.sheet_to_json(sheet, { defval: '', range: 2 });

// função utilitária para normalizar cabeçalhos
function norm(s) {
  if (s === null || s === undefined) return '';
  return String(s).trim().normalize('NFKD').replace(/\s+/g, ' ').toLowerCase();
}

// encontra a chave original do objeto que corresponde a um predicado (trim+lower)
function findKey(obj, matchFn) {
  for (const k of Object.keys(obj)) {
    if (matchFn(norm(k))) return k;
  }
  return null;
}

const outRows = rows.map(r => {
  // detecta colunas por heurística
  const keyTitulo = findKey(r, k => k.includes('tít') || k.includes('titu') || k.includes('titulo') || k.includes('title') || k.includes('caeté') === false);
  const keyEstoque = findKey(r, k => k.includes('estoq') || k.includes('saldo') || k.includes('quant') || k.includes('qtd'));
  const keyPreco = findKey(r, k => k.includes('valor') || k.includes('preço') || k.includes('preco') || k.includes('valor venda') || k.includes('valorvenda'));
  const keyCodb = findKey(r, k => k.includes('barr') || k.includes('isbn') || k.includes('codigo'));

  const titulo = keyTitulo ? String(r[keyTitulo] || '').trim() : '';
  // tenta também pegar título de colunas sem nome (por exemplo primeira coluna onde header é "ACERVO..." inusual)
  // se titulo vazio, tenta a primeira coluna do objeto
  let tituloFinal = titulo;
  if (!tituloFinal) {
    const firstKey = Object.keys(r)[0];
    tituloFinal = firstKey ? String(r[firstKey]).trim() : '';
  }

  // estoque
  let estoque = 0;
  if (keyEstoque) {
    estoque = parseInt(String(r[keyEstoque]).toString().replace(/\D/g, ''), 10) || 0;
  } else {
    // fallback: procurar o primeiro valor numérico pequeno nas colunas
    for (const k of Object.keys(r)) {
      const v = String(r[k]).trim();
      if (/^\d{1,5}$/.test(v)) { estoque = parseInt(v,10); break; }
    }
  }

  // preço - normaliza pontos e vírgulas
  let preco = 0.0;
  if (keyPreco) {
    let s = String(r[keyPreco]).trim();
    s = s.replace(/\s/g,'').replace(/\./g,'').replace(',','.');
    preco = parseFloat(s) || 0.0;
  } else {
    // fallback: procura algum valor com decimal
    for (const k of Object.keys(r)) {
      let s = String(r[k]).trim().replace(/\s/g,'');
      if (/[0-9]+[,\.][0-9]{1,2}/.test(s)) {
        s = s.replace(/\./g,'').replace(',','.');
        preco = parseFloat(s) || 0.0;
        break;
      }
    }
  }

  const codb = keyCodb ? String(r[keyCodb] || '').replace(/\D/g,'') : '';

  return {
    'Título': String(tituloFinal).trim(),
    'Saldo estoque': Number(estoque) || 0,
    'Preço': (Number(preco) || 0).toFixed(2),
    'Código de barras': String(codb || '')
  };
});

// filtra linhas sem título
const filtered = outRows.filter(r => r['Título'] && r['Título'].trim() !== '');

const header = ['Título','Saldo estoque','Preço','Código de barras'];
const lines = [ header.join(';') ];
for (const r of filtered) {
  const line = [
    `"${String(r['Título']).replace(/"/g,'""')}"`,
    r['Saldo estoque'],
    r['Preço'],
    r['Código de barras']
  ].join(';');
  lines.push(line);
}

const csvContent = lines.join('\r\n');
fs.writeFileSync(outCsv, iconv.encode(csvContent, 'latin1'));
console.log('✅ CSV gerado em:', outCsv, 'linhas:', filtered.length);
