-- Idempotent migration
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS public_url text;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS assinatura_link text;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS assinatura_link text;
