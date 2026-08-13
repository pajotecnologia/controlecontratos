-- ============================================================================
-- Migration: Suporte a Múltiplas Empresas e Modelos de Proposta
-- ============================================================================

-- Adiciona campo is_default na tabela company_settings
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS assinatura_imagem TEXT DEFAULT NULL;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS public_url TEXT DEFAULT NULL;

-- Adiciona campo modelo_proposta na tabela propostas
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS modelo_proposta TEXT DEFAULT 'classico';
