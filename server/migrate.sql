-- ============================================================================
-- MIGRAÇÃO: Aplicar em banco existente (seguro para rodar múltiplas vezes)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CLIENTES: campos do responsável e endereço detalhado
-- ----------------------------------------------------------------------------
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bairro           text DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cidade           text DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS estado           text DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cep              text DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS nome_responsavel  text DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cargo_responsavel text DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cpf_responsavel   text DEFAULT '';

-- ----------------------------------------------------------------------------
-- COMPANY_SETTINGS: campos do responsável e contato
-- ----------------------------------------------------------------------------
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS cep               text DEFAULT '';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS endereco          text DEFAULT '';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bairro            text DEFAULT '';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS cidade            text DEFAULT '';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS email             text DEFAULT '';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS telefone          text DEFAULT '';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS nome_responsavel  text DEFAULT '';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS cargo_responsavel text DEFAULT '';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS cpf_responsavel   text DEFAULT '';

-- ----------------------------------------------------------------------------
-- MODELOS: tabela de modelos de contrato (cria se não existir)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS modelos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  conteudo   text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- CONTRATOS: tabela de contratos documentais (cria se não existir)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contratos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_emissao       date NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento    text DEFAULT NULL,
  valor              numeric(12,2) NOT NULL DEFAULT 0,
  taxa_implantacao   numeric(12,2) NOT NULL DEFAULT 0,
  forma_pagamento    text DEFAULT '',
  forma_reajuste     text DEFAULT '',
  modelo_equipamento text DEFAULT '',
  prazo_contrato     text DEFAULT '',
  company_id         uuid REFERENCES company_settings(id) ON DELETE SET NULL,
  cliente_id         uuid REFERENCES clientes(id) ON DELETE SET NULL,
  modelo_id          uuid REFERENCES modelos(id) ON DELETE SET NULL,
  created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  assinatura_token        text UNIQUE DEFAULT NULL,
  assinatura_status       text NOT NULL DEFAULT 'pendente',
  assinatura_observacao   text DEFAULT NULL,
  assinatura_imagem       text DEFAULT NULL,
  assinatura_data         timestamptz DEFAULT NULL,
  assinatura_nome         text DEFAULT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Campos de assinatura em contratos já existentes
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS assinatura_token      text UNIQUE DEFAULT NULL;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS assinatura_status     text NOT NULL DEFAULT 'pendente';
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS assinatura_observacao text DEFAULT NULL;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS assinatura_imagem     text DEFAULT NULL;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS assinatura_data       timestamptz DEFAULT NULL;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS assinatura_nome       text DEFAULT NULL;

-- ----------------------------------------------------------------------------
-- VÍNCULO DE VENDEDOR em contratos e propostas (envio de mensagens ao vendedor)
-- ----------------------------------------------------------------------------
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES vendedores(id) ON DELETE SET NULL;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES vendedores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contratos_vendedor ON contratos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_propostas_vendedor ON propostas(vendedor_id);

-- ----------------------------------------------------------------------------
-- MESSAGE_TEMPLATES: tabela de templates dinâmicos de mensagem (cria se não existir)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- ASAAS: tabela de configurações de integração com o gateway de pagamento
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asaas_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key       text NOT NULL DEFAULT '',
  ambiente      text NOT NULL DEFAULT 'sandbox',
  ativo         boolean NOT NULL DEFAULT false,
  webhook_token text DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE asaas_settings ADD COLUMN IF NOT EXISTS webhook_token text DEFAULT '';

-- ----------------------------------------------------------------------------
-- ASAAS: colunas de cobrança nas parcelas (idempotentes)
-- ----------------------------------------------------------------------------
ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS asaas_cobranca_id   text DEFAULT NULL;
ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS asaas_status        text DEFAULT NULL;
ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS asaas_boleto_url    text DEFAULT NULL;
ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS asaas_pix_qr_code   text DEFAULT NULL;
ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS asaas_pix_copy_paste text DEFAULT NULL;
ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS asaas_invoice_url   text DEFAULT NULL;

-- ----------------------------------------------------------------------------
-- TRIGGERS updated_at para tabelas novas
-- ----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['modelos','contratos']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- COMPANY_SETTINGS: assinatura digital da empresa
-- ----------------------------------------------------------------------------
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS assinatura_imagem text DEFAULT '';

-- ----------------------------------------------------------------------------
-- FIM DA MIGRAÇÃO
-- ----------------------------------------------------------------------------
SELECT 'Migração aplicada com sucesso!' AS resultado;
