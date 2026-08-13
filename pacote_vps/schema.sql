-- ============================================================================
-- Sistema de Gestão de Contratos e Comissões — Schema PostgreSQL (puro)
-- ============================================================================
-- Roda em qualquer PostgreSQL 13+. Não depende de Supabase.
-- A autenticação e a autorização são feitas pelo backend (Node/Express),
-- por isso NÃO há Row Level Security aqui — o backend controla o acesso.
--
-- Rodar uma vez em um banco novo:
--   psql "postgresql://USUARIO:SENHA@HOST:5432/NOME_DO_BANCO" -f schema.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- fornece gen_random_uuid()

-- Enum de papéis
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'vendedor');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Trigger genérico de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Usuários (autenticação própria, substitui o auth do Supabase)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Perfis e papéis
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name  text NOT NULL DEFAULT '',
  whatsapp   text DEFAULT '',
  cpf        text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role    app_role NOT NULL DEFAULT 'vendedor',
  UNIQUE (user_id, role)
);

-- ============================================================================
-- Cadastros
-- ============================================================================
CREATE TABLE IF NOT EXISTS clientes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               text NOT NULL,
  telefone           text DEFAULT '',
  email              text DEFAULT '',
  cpf_cnpj           text DEFAULT '',
  endereco           text DEFAULT '',
  bairro             text DEFAULT '',
  cidade             text DEFAULT '',
  estado             text DEFAULT '',
  cep                text DEFAULT '',
  nome_responsavel   text DEFAULT '',
  cargo_responsavel  text DEFAULT '',
  cpf_responsavel    text DEFAULT '',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendedores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  nome            text NOT NULL,
  whatsapp        text DEFAULT '',
  cpf             text DEFAULT '',
  email           text DEFAULT '',
  comissao_padrao numeric(5,2) NOT NULL DEFAULT 10.00,
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Contratos (tabela "vendas") e comissões
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendas (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente                 text NOT NULL,
  cliente_id              uuid REFERENCES clientes(id) ON DELETE SET NULL,
  valor_servico           numeric(12,2) NOT NULL DEFAULT 0,
  data_venda              date NOT NULL DEFAULT CURRENT_DATE,
  mes_referencia          text NOT NULL,
  cliente_pagou           boolean NOT NULL DEFAULT false,
  data_pagamento_cliente  timestamptz DEFAULT NULL,
  observacao_pagamento    text DEFAULT NULL,
  recorrente              boolean NOT NULL DEFAULT false,
  -- Parcelamento (modelo de tabela parcelas dedicada)
  qtde_parcelas           integer NOT NULL DEFAULT 1,
  valor_parcela           numeric(12,2) DEFAULT NULL,
  primeiro_vencimento     date DEFAULT NULL,
  created_by              uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venda_vendedores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id       uuid NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  vendedor_id    uuid NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
  percentual     numeric(5,2) NOT NULL DEFAULT 0,
  valor_comissao numeric(12,2) NOT NULL DEFAULT 0,
  comissao_paga  boolean NOT NULL DEFAULT false,
  data_pagamento timestamptz DEFAULT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Parcelas (uma linha por parcela de cada contrato)
-- ============================================================================
CREATE TABLE IF NOT EXISTS parcelas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id        uuid NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  numero_parcela  integer NOT NULL,
  valor           numeric(12,2) NOT NULL DEFAULT 0,
  data_vencimento date NOT NULL,
  data_pagamento  timestamptz DEFAULT NULL,
  pago            boolean NOT NULL DEFAULT false,
  numero_nf       text DEFAULT NULL,
  observacao      text DEFAULT NULL,
  mes_referencia  text DEFAULT NULL,
  -- Cobrança ASAAS
  asaas_cobranca_id    text DEFAULT NULL,
  asaas_status         text DEFAULT NULL,
  asaas_boleto_url     text DEFAULT NULL,
  asaas_pix_qr_code    text DEFAULT NULL,
  asaas_pix_copy_paste text DEFAULT NULL,
  asaas_invoice_url    text DEFAULT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Configurações
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_settings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL DEFAULT '',
  cnpj               text DEFAULT '',
  cep                text DEFAULT '',
  endereco           text DEFAULT '',
  bairro             text DEFAULT '',
  cidade             text DEFAULT '',
  email              text DEFAULT '',
  telefone           text DEFAULT '',
  nome_responsavel   text DEFAULT '',
  cargo_responsavel  text DEFAULT '',
  cpf_responsavel    text DEFAULT '',
  logo_url           text DEFAULT '',
  assinatura_imagem  text DEFAULT NULL,
  public_url         text DEFAULT NULL,
  is_default         boolean DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asaas_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key       text NOT NULL DEFAULT '',
  ambiente      text NOT NULL DEFAULT 'sandbox',
  ativo         boolean NOT NULL DEFAULT false,
  webhook_token text DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Modelos de contrato (texto com variáveis: dados da empresa e do cliente)
-- ============================================================================
CREATE TABLE IF NOT EXISTS modelos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  conteudo   text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Contratos (documentos): data emitido, vencimento, valor, empresa, modelo
-- ============================================================================
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
  conteudo_personalizado text DEFAULT NULL,
  company_id         uuid REFERENCES company_settings(id) ON DELETE SET NULL,
  cliente_id         uuid REFERENCES clientes(id) ON DELETE SET NULL,
  modelo_id          uuid REFERENCES modelos(id) ON DELETE SET NULL,
  vendedor_id        uuid REFERENCES vendedores(id) ON DELETE SET NULL,
  created_by              uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Assinatura digital
  assinatura_token        text UNIQUE DEFAULT NULL,
  assinatura_status       text NOT NULL DEFAULT 'pendente',
  assinatura_observacao   text DEFAULT NULL,
  assinatura_imagem       text DEFAULT NULL,
  assinatura_data         timestamptz DEFAULT NULL,
  assinatura_nome         text DEFAULT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Propostas comerciais: dados gerais da proposta e itens lançados
-- ============================================================================
CREATE TABLE IF NOT EXISTS propostas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_proposta   date NOT NULL DEFAULT CURRENT_DATE,
  cliente_id      uuid REFERENCES clientes(id) ON DELETE SET NULL,
  vendedor_id     uuid REFERENCES vendedores(id) ON DELETE SET NULL,
  tipo_proposta   text DEFAULT '',
  titulo          text DEFAULT '',
  observacoes     text DEFAULT '',
  desconto        numeric(12,2) DEFAULT 0,
  total           numeric(12,2) DEFAULT 0,
  company_id      uuid REFERENCES company_settings(id) ON DELETE SET NULL,
  modelo_proposta text DEFAULT 'classico',
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Assinatura digital
  assinatura_token        text UNIQUE DEFAULT NULL,
  assinatura_status       text NOT NULL DEFAULT 'pendente',
  assinatura_observacao   text DEFAULT NULL,
  assinatura_imagem       text DEFAULT NULL,
  assinatura_data         timestamptz DEFAULT NULL,
  assinatura_nome         text DEFAULT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposta_itens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id     uuid NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  descricao       text DEFAULT '',
  imagem_url      text DEFAULT '',
  quantidade      numeric(12,2) DEFAULT 1,
  valor_unitario  numeric(12,2) DEFAULT 0,
  total           numeric(12,2) DEFAULT 0,
  ordem           integer DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evolution_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_url        text DEFAULT '',
  instance_name       text DEFAULT '',
  api_key             text DEFAULT '',
  message_template    text DEFAULT 'Olá {{vendedor}}, sua comissão de R$ {{valor}} ({{percentual}}%) referente ao cliente {{cliente}} foi confirmada!',
  template_nova_venda text DEFAULT 'Olá {{vendedor}}, você foi incluído na venda do cliente {{cliente}} no valor de R$ {{valor_servico}}. Sua comissão: R$ {{valor}} ({{percentual}}%).',
  template_pagamento  text DEFAULT 'Olá {{vendedor}}, sua comissão de R$ {{valor}} ({{percentual}}%) referente ao cliente {{cliente}} foi paga! 🎉',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS smtp_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host                text NOT NULL DEFAULT '',
  port                integer NOT NULL DEFAULT 587,
  username            text NOT NULL DEFAULT '',
  password            text NOT NULL DEFAULT '',
  from_email          text NOT NULL DEFAULT '',
  from_name           text NOT NULL DEFAULT '',
  use_tls             boolean NOT NULL DEFAULT true,
  template_nova_venda text DEFAULT 'Olá {{vendedor}}, você foi incluído na venda do cliente {{cliente}} no valor de R$ {{valor_servico}}. Sua comissão: R$ {{valor}} ({{percentual}}%).',
  template_pagamento  text DEFAULT 'Olá {{vendedor}}, sua comissão de R$ {{valor}} ({{percentual}}%) referente ao cliente {{cliente}} foi paga! 🎉',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Triggers de updated_at
-- ============================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','clientes','vendedores','vendas','company_settings','asaas_settings','evolution_settings','smtp_settings','modelos','contratos','propostas']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t);
  END LOOP;
END $$;

-- ============================================================================
-- Índices úteis
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_contratos_cliente          ON contratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contratos_modelo           ON contratos(modelo_id);
CREATE INDEX IF NOT EXISTS idx_venda_vendedores_venda    ON venda_vendedores(venda_id);
CREATE INDEX IF NOT EXISTS idx_venda_vendedores_vendedor ON venda_vendedores(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente            ON vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_user           ON vendedores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user           ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_venda            ON parcelas(venda_id);
CREATE INDEX IF NOT EXISTS idx_propostas_cliente          ON propostas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_proposta_itens_proposta     ON proposta_itens(proposta_id);
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
