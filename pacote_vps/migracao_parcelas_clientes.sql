-- Migração: parcelas com mês de referência e endereço completo de clientes.
-- Pode ser executada mais de uma vez com segurança.

ALTER TABLE parcelas
  ADD COLUMN IF NOT EXISTS mes_referencia text DEFAULT NULL;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS bairro text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cidade text DEFAULT '',
  ADD COLUMN IF NOT EXISTS estado text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cep text DEFAULT '';
