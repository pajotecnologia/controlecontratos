-- Idempotent migration
CREATE TABLE IF NOT EXISTS message_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  evento        text NOT NULL DEFAULT 'pagamento',
  corpo         text NOT NULL DEFAULT '',
  ativo_whatsapp boolean NOT NULL DEFAULT true,
  ativo_email   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
