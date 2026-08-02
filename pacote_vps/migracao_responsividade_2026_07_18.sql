-- =============================================================================
-- Migração idempotente — 2026-07-18
-- Aplica todas as atualizações pendentes no banco da VPS.
-- Pode ser rodada múltiplas vezes sem efeito colateral.
-- =============================================================================

-- 1. Coluna conteudo_personalizado na tabela contratos
ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS conteudo_personalizado text DEFAULT NULL;

-- 2. Tabela message_templates (modelos de mensagem WhatsApp/Email)
CREATE TABLE IF NOT EXISTS message_templates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL,
  evento         text NOT NULL DEFAULT 'pagamento',
  corpo          text NOT NULL DEFAULT '',
  ativo_whatsapp boolean NOT NULL DEFAULT true,
  ativo_email    boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 3. Garante que colunas assinatura_imagem existem (já devem existir, mas idempotente)
ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS assinatura_imagem text DEFAULT NULL;

ALTER TABLE propostas
  ADD COLUMN IF NOT EXISTS assinatura_imagem text DEFAULT NULL;
