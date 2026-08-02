CREATE TABLE IF NOT EXISTS agendamentos_envio (
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
