SET client_encoding TO 'UTF8';

-- Solicitações enviadas pelos clientes e analisadas pelo administrador
CREATE TABLE IF NOT EXISTS solicitacoes_orcamento (
  id UUID PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL,
  telefone VARCHAR(30),
  destino VARCHAR(120) NOT NULL,
  passageiros INTEGER NOT NULL CHECK (passageiros >= 1),
  data_ida DATE,
  data_volta DATE,
  faixa_orcamento VARCHAR(80),
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovada', 'recusada')),
  decidido_em TIMESTAMPTZ
);

-- Migração para quem já tinha criado a tabela antes do painel administrativo.
ALTER TABLE solicitacoes_orcamento
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pendente';

ALTER TABLE solicitacoes_orcamento
  ADD COLUMN IF NOT EXISTS decidido_em TIMESTAMPTZ;
