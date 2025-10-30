-- import_livros.sql
-- Script para truncar vendas/venda_itens/livros e importar CSV para livros (Postgres)
-- ATENÇÃO: faça backup do DB antes de rodar!

BEGIN;

-- 1) Truncar as tabelas principais (reinicia identity e aplica cascade)
TRUNCATE TABLE venda_itens, vendas, livros RESTART IDENTITY CASCADE;

-- 2) Criar tabela de staging conforme o CSV (temporária)
CREATE TEMP TABLE staging_livros_raw (
  "Título" text,
  "Saldo estoque" text,
  "Preço" text,
  "Código de barras" text
);

-- Observação: o próximo comando \copy não roda dentro de um arquivo SQL se você executar via psql -f
-- mas é comum rodar o \copy manualmente no cliente psql. Veja instruções abaixo.

-- 3) Inserir dados transformados de staging para a tabela final `livros`.
-- Ajuste os nomes de coluna (titulo, estoque, preco, codigo_barras) se seu esquema for diferente.
INSERT INTO livros (titulo, estoque, preco, codigo_barras)
SELECT
  NULLIF(trim("Título"), '') AS titulo,
  -- limpa tudo que não é dígito e converte para integer (se vazio, fica NULL)
  NULLIF(regexp_replace("Saldo estoque", '[^0-9-]', '', 'g'), '')::integer AS estoque,
  -- normaliza preço: remove pontos de milhar, troca vírgula por ponto, converte para numeric
  NULLIF(replace(replace("Preço", '.', ''), ',', '.'), '')::numeric AS preco,
  NULLIF(trim("Código de barras"), '') AS codigo_barras
FROM staging_livros_raw
WHERE NULLIF(trim("Título"), '') IS NOT NULL; -- evita linhas vazias

-- 4) Ajustar sequence da tabela livros.id (se existir coluna id serial)
-- Substitua 'id' se sua PK for outro nome.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='livros' AND column_name='id'
  ) THEN
    PERFORM setval(pg_get_serial_sequence('livros','id'), COALESCE((SELECT MAX(id) FROM livros),0));
  END IF;
END$$;

COMMIT;
