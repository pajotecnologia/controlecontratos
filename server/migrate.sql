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
-- FORNECEDORES E CONTAS A PAGAR
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fornecedores (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social       text NOT NULL,
  nome_fantasia      text DEFAULT '',
  cpf_cnpj           text DEFAULT '',
  inscricao_estadual text DEFAULT '',
  telefone           text DEFAULT '',
  whatsapp           text DEFAULT '',
  email              text DEFAULT '',
  contato_nome       text DEFAULT '',
  cep                text DEFAULT '',
  endereco           text DEFAULT '',
  bairro             text DEFAULT '',
  cidade             text DEFAULT '',
  estado             text DEFAULT '',
  banco              text DEFAULT '',
  agencia            text DEFAULT '',
  conta              text DEFAULT '',
  tipo_chave_pix     text DEFAULT '',
  chave_pix          text DEFAULT '',
  categoria_padrao   text DEFAULT '',
  observacoes        text DEFAULT '',
  ativo              boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categorias_despesa (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL UNIQUE,
  cor         text DEFAULT '#64748b',
  descricao   text DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS despesas (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao                  text NOT NULL,
  fornecedor_id              uuid REFERENCES fornecedores(id) ON DELETE SET NULL,
  categoria_id               uuid REFERENCES categorias_despesa(id) ON DELETE SET NULL,
  tipo                       text NOT NULL DEFAULT 'unico',
  periodicidade_recorrencia  text DEFAULT 'mensal',
  dia_vencimento_recorrente integer DEFAULT NULL,
  qtde_parcelas              integer NOT NULL DEFAULT 1,
  valor_total                numeric(12,2) NOT NULL DEFAULT 0,
  data_emissao               date NOT NULL DEFAULT CURRENT_DATE,
  created_by                 uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parcelas_despesas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despesa_id      uuid NOT NULL REFERENCES despesas(id) ON DELETE CASCADE,
  numero_parcela  integer NOT NULL DEFAULT 1,
  valor           numeric(12,2) NOT NULL DEFAULT 0,
  data_vencimento date NOT NULL,
  data_pagamento  timestamptz DEFAULT NULL,
  pago            boolean NOT NULL DEFAULT false,
  forma_pagamento text DEFAULT '',
  codigo_barras   text DEFAULT NULL,
  comprovante_url text DEFAULT NULL,
  observacao      text DEFAULT NULL,
  mes_referencia  text DEFAULT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO categorias_despesa (nome, cor, descricao) VALUES
  ('Aluguel e Imóveis', '#ef4444', 'Aluguel, condomínio, IPTU e taxas prediais'),
  ('SaaS & Tecnologia', '#3b82f6', 'Servidores, licenças de software e ferramentas'),
  ('Pessoal & Salários', '#10b981', 'Salários, encargos, pró-labore e comissões'),
  ('Serviços Prestados', '#f59e0b', 'Honorários de terceiros, contabilidade e consultoria'),
  ('Impostos e Taxas', '#8b5cf6', 'Tributos municipais, estaduais e federais'),
  ('Marketing & Vendas', '#ec4899', 'Anúncios, publicidade e eventos'),
  ('Infraestrutura & Utilidades', '#06b6d4', 'Energia elétrica, água, internet e telefonia'),
  ('Outras Despesas', '#64748b', 'Despesas diversas não categorizadas')
ON CONFLICT (nome) DO NOTHING;

-- ----------------------------------------------------------------------------
-- TRIGGERS updated_at para tabelas novas
-- ----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['modelos','contratos','fornecedores','despesas']
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
CREATE TABLE IF NOT EXISTS agendamento_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_agendamento TIMESTAMP WITH TIME ZONE NOT NULL,
  canal VARCHAR(50) NOT NULL,
  referencia_tipo VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente',
  tentativas INT DEFAULT 0,
  log_erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

