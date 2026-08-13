--
-- PostgreSQL database dump
--



-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'vendedor'
);


ALTER TYPE public.app_role OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agendamentos_envio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agendamentos_envio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    data_agendamento timestamp with time zone NOT NULL,
    canal character varying(50) NOT NULL,
    referencia_tipo character varying(100) NOT NULL,
    payload jsonb NOT NULL,
    status character varying(20) DEFAULT 'pendente'::character varying,
    tentativas integer DEFAULT 0,
    log_erro text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.agendamentos_envio OWNER TO postgres;

--
-- Name: asaas_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asaas_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_key text DEFAULT ''::text NOT NULL,
    ambiente text DEFAULT 'sandbox'::text NOT NULL,
    ativo boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    webhook_token text DEFAULT ''::text
);


ALTER TABLE public.asaas_settings OWNER TO postgres;

--
-- Name: clientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    telefone text DEFAULT ''::text,
    email text DEFAULT ''::text,
    cpf_cnpj text DEFAULT ''::text,
    endereco text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    nome_responsavel text DEFAULT ''::text,
    cargo_responsavel text DEFAULT ''::text,
    cpf_responsavel text DEFAULT ''::text,
    bairro text DEFAULT ''::text,
    cidade text DEFAULT ''::text,
    estado text DEFAULT ''::text,
    cep text DEFAULT ''::text
);


ALTER TABLE public.clientes OWNER TO postgres;

--
-- Name: company_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    cnpj text DEFAULT ''::text,
    logo_url text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cep text DEFAULT ''::text,
    endereco text DEFAULT ''::text,
    bairro text DEFAULT ''::text,
    cidade text DEFAULT ''::text,
    nome_responsavel text DEFAULT ''::text,
    cargo_responsavel text DEFAULT ''::text,
    cpf_responsavel text DEFAULT ''::text,
    email text DEFAULT ''::text,
    telefone text DEFAULT ''::text,
    assinatura_imagem text DEFAULT ''::text,
    public_url text
);


ALTER TABLE public.company_settings OWNER TO postgres;

--
-- Name: contratos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contratos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    data_emissao date DEFAULT CURRENT_DATE NOT NULL,
    data_vencimento text,
    valor numeric(12,2) DEFAULT 0 NOT NULL,
    company_id uuid,
    cliente_id uuid,
    modelo_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    taxa_implantacao numeric(12,2) DEFAULT 0,
    forma_pagamento text DEFAULT ''::text,
    forma_reajuste text DEFAULT ''::text,
    modelo_equipamento text DEFAULT ''::text,
    prazo_contrato text DEFAULT ''::text,
    assinatura_token text,
    assinatura_status text DEFAULT 'pendente'::text NOT NULL,
    assinatura_observacao text,
    assinatura_imagem text,
    assinatura_data timestamp with time zone,
    assinatura_nome text,
    conteudo_personalizado text,
    assinatura_link text,
    vendedor_id uuid
);


ALTER TABLE public.contratos OWNER TO postgres;

--
-- Name: evolution_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evolution_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_url text DEFAULT ''::text,
    instance_name text DEFAULT ''::text,
    api_key text DEFAULT ''::text,
    message_template text DEFAULT 'Olá {{vendedor}}, sua comissão de R$ {{valor}} ({{percentual}}%) referente ao cliente {{cliente}} foi confirmada!'::text,
    template_nova_venda text DEFAULT 'Olá {{vendedor}}, você foi incluído na venda do cliente {{cliente}} no valor de R$ {{valor_servico}}. Sua comissão: R$ {{valor}} ({{percentual}}%).'::text,
    template_pagamento text DEFAULT 'Olá {{vendedor}}, sua comissão de R$ {{valor}} ({{percentual}}%) referente ao cliente {{cliente}} foi paga! 🎉'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.evolution_settings OWNER TO postgres;

--
-- Name: message_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    evento text DEFAULT 'pagamento'::text NOT NULL,
    corpo text DEFAULT ''::text NOT NULL,
    ativo_whatsapp boolean DEFAULT true NOT NULL,
    ativo_email boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.message_templates OWNER TO postgres;

--
-- Name: modelos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.modelos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    conteudo text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.modelos OWNER TO postgres;

--
-- Name: parcelas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parcelas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    venda_id uuid NOT NULL,
    numero_parcela integer NOT NULL,
    valor numeric(12,2) DEFAULT 0 NOT NULL,
    data_vencimento date NOT NULL,
    data_pagamento timestamp with time zone,
    pago boolean DEFAULT false NOT NULL,
    numero_nf text,
    observacao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    mes_referencia text,
    asaas_cobranca_id text,
    asaas_status text,
    asaas_boleto_url text,
    asaas_pix_qr_code text,
    asaas_pix_copy_paste text,
    asaas_invoice_url text
);


ALTER TABLE public.parcelas OWNER TO postgres;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text DEFAULT ''::text NOT NULL,
    whatsapp text DEFAULT ''::text,
    cpf text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: proposta_itens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.proposta_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposta_id uuid NOT NULL,
    descricao text DEFAULT ''::text,
    imagem_url text DEFAULT ''::text,
    quantidade numeric(12,2) DEFAULT 1,
    valor_unitario numeric(12,2) DEFAULT 0,
    total numeric(12,2) DEFAULT 0,
    ordem integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.proposta_itens OWNER TO postgres;

--
-- Name: propostas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.propostas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    data_proposta date DEFAULT CURRENT_DATE NOT NULL,
    cliente_id uuid,
    tipo_proposta text DEFAULT ''::text,
    titulo text DEFAULT ''::text,
    total numeric(12,2) DEFAULT 0,
    company_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    desconto numeric(12,2) DEFAULT 0,
    assinatura_token text,
    assinatura_status text DEFAULT 'pendente'::text NOT NULL,
    assinatura_observacao text,
    assinatura_imagem text,
    assinatura_data timestamp with time zone,
    assinatura_nome text,
    assinatura_link text,
    vendedor_id uuid
);


ALTER TABLE public.propostas OWNER TO postgres;

--
-- Name: smtp_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.smtp_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    host text DEFAULT ''::text NOT NULL,
    port integer DEFAULT 587 NOT NULL,
    username text DEFAULT ''::text NOT NULL,
    password text DEFAULT ''::text NOT NULL,
    from_email text DEFAULT ''::text NOT NULL,
    from_name text DEFAULT ''::text NOT NULL,
    use_tls boolean DEFAULT true NOT NULL,
    template_nova_venda text DEFAULT 'Olá {{vendedor}}, você foi incluído na venda do cliente {{cliente}} no valor de R$ {{valor_servico}}. Sua comissão: R$ {{valor}} ({{percentual}}%).'::text,
    template_pagamento text DEFAULT 'Olá {{vendedor}}, sua comissão de R$ {{valor}} ({{percentual}}%) referente ao cliente {{cliente}} foi paga! 🎉'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.smtp_settings OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'vendedor'::public.app_role NOT NULL
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: venda_vendedores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.venda_vendedores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    venda_id uuid NOT NULL,
    vendedor_id uuid NOT NULL,
    percentual numeric(5,2) DEFAULT 0 NOT NULL,
    valor_comissao numeric(12,2) DEFAULT 0 NOT NULL,
    comissao_paga boolean DEFAULT false NOT NULL,
    data_pagamento timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.venda_vendedores OWNER TO postgres;

--
-- Name: vendas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente text NOT NULL,
    cliente_id uuid,
    valor_servico numeric(12,2) DEFAULT 0 NOT NULL,
    data_venda date DEFAULT CURRENT_DATE NOT NULL,
    mes_referencia text NOT NULL,
    cliente_pagou boolean DEFAULT false NOT NULL,
    data_pagamento_cliente timestamp with time zone,
    observacao_pagamento text,
    recorrente boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    numero_nota_fiscal text,
    contrato_id uuid,
    numero_parcela integer DEFAULT 1 NOT NULL,
    total_parcelas integer DEFAULT 1 NOT NULL,
    data_vencimento date,
    qtde_parcelas integer DEFAULT 1 NOT NULL,
    valor_parcela numeric(12,2) DEFAULT NULL::numeric,
    primeiro_vencimento date
);


ALTER TABLE public.vendas OWNER TO postgres;

--
-- Name: vendedores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendedores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    nome text NOT NULL,
    whatsapp text DEFAULT ''::text,
    cpf text DEFAULT ''::text,
    email text DEFAULT ''::text,
    comissao_padrao numeric(5,2) DEFAULT 10.00 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vendedores OWNER TO postgres;

--
-- Data for Name: agendamentos_envio; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.agendamentos_envio (id, data_agendamento, canal, referencia_tipo, payload, status, tentativas, log_erro, created_at) VALUES ('6005b034-f0e1-4320-b8a5-1f46c88f3350', '2026-08-02 18:00:00-03', 'email', 'proposta_email', '{"body": {"mensagem": "Segue em anexo a proposta comercial: PROPOSTA COMERCIAL no valor de R$ 1.600,00."}, "path": "/propostas/297fa1bf-53d2-4bab-8061-107d91c5da21/enviar-email"}', 'enviado', 0, NULL, '2026-08-02 17:58:17.927013-03');
INSERT INTO public.agendamentos_envio (id, data_agendamento, canal, referencia_tipo, payload, status, tentativas, log_erro, created_at) VALUES ('b13c9a7a-2a75-4709-83fe-ce0d6dc3166f', '2026-08-02 19:01:00-03', 'whatsapp', 'proposta_whatsapp', '{"body": {"mensagem": "Olá pajo tecnologia, segue sua proposta comercial:\n\n*PROPOSTA COMERCIAL*\nTipo: prestação de servicos\nItens: 1\n*Valor Total: R$ 1.600,00*"}, "path": "/propostas/297fa1bf-53d2-4bab-8061-107d91c5da21/enviar-whatsapp"}', 'pendente', 0, NULL, '2026-08-02 18:01:41.735527-03');
INSERT INTO public.agendamentos_envio (id, data_agendamento, canal, referencia_tipo, payload, status, tentativas, log_erro, created_at) VALUES ('baca8bfe-e9d5-4c3b-9228-e116ec88d7fb', '2026-08-02 19:02:00-03', 'email', 'proposta_email', '{"body": {"mensagem": "Segue em anexo a proposta comercial: PROPOSTA COMERCIAL no valor de R$ 1.600,00."}, "path": "/propostas/297fa1bf-53d2-4bab-8061-107d91c5da21/enviar-email"}', 'pendente', 0, NULL, '2026-08-02 18:02:15.274834-03');
INSERT INTO public.agendamentos_envio (id, data_agendamento, canal, referencia_tipo, payload, status, tentativas, log_erro, created_at) VALUES ('0c19ec67-67f9-4228-80e0-326ec3d77404', '2026-08-02 20:04:00-03', 'whatsapp', 'proposta_whatsapp', '{"body": {"mensagem": "Olá pajo tecnologia, segue sua proposta comercial:\n\n*PROPOSTA COMERCIAL*\nTipo: prestação de servicos\nItens: 1\n*Valor Total: R$ 1.600,00*"}, "path": "/propostas/297fa1bf-53d2-4bab-8061-107d91c5da21/enviar-whatsapp"}', 'pendente', 0, NULL, '2026-08-02 18:04:58.967809-03');
INSERT INTO public.agendamentos_envio (id, data_agendamento, canal, referencia_tipo, payload, status, tentativas, log_erro, created_at) VALUES ('b37a7a24-3ced-4a7f-836f-9700078641c9', '2026-08-02 20:09:00-03', 'whatsapp', 'proposta_whatsapp', '{"body": {"mensagem": "Olá pajo tecnologia, segue sua proposta comercial:\n\n*PROPOSTA COMERCIAL*\nTipo: prestação de servicos\nItens: 1\n*Valor Total: R$ 1.600,00*"}, "path": "/propostas/297fa1bf-53d2-4bab-8061-107d91c5da21/enviar-whatsapp"}', 'pendente', 0, NULL, '2026-08-02 18:09:39.948437-03');


--
-- Data for Name: asaas_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: clientes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.clientes (id, nome, telefone, email, cpf_cnpj, endereco, created_at, updated_at, nome_responsavel, cargo_responsavel, cpf_responsavel, bairro, cidade, estado, cep) VALUES ('60761776-d32f-48e1-95a9-96b46c80a2e0', 'RECRIAR', '(87) 99654-0551', 'paulojsilva@live.com', '', '', '2026-07-08 19:25:17.360176-03', '2026-07-09 07:21:01.4726-03', '', '', '', '', '', '', '');
INSERT INTO public.clientes (id, nome, telefone, email, cpf_cnpj, endereco, created_at, updated_at, nome_responsavel, cargo_responsavel, cpf_responsavel, bairro, cidade, estado, cep) VALUES ('cbe64cf5-0d67-47fa-83da-823592cff5bf', 'Garanhuns Palace', '(87) 99654-0551', 'financeiro@garanhunspalace.com.br', '29.180.323/0001-96', 'Av. Rui Barbosa, 626', '2026-07-04 12:15:13.396351-03', '2026-07-17 19:32:54.240111-03', 'GIVALDO CALADO DE FREITAS FILHO', 'DIRETOR', '746.926.314-49', 'sadsadsaasdsad', 'sadsad', '', '');
INSERT INTO public.clientes (id, nome, telefone, email, cpf_cnpj, endereco, created_at, updated_at, nome_responsavel, cargo_responsavel, cpf_responsavel, bairro, cidade, estado, cep) VALUES ('6d35d1be-0b39-4389-80c2-dbca655e1e2b', 'pajo tecnologia', '(87) 99654-0551', 'paulojsilva@live.com', '746.926.314-49', 'Ivailton Areias, 235', '2026-07-03 18:10:51.980323-03', '2026-07-18 10:52:41.109761-03', 'Paulo Jose', 'Diretor', '746.926.314-49', 'Viana e Moura', 'Garanhuns', 'PE', '55294-891');


--
-- Data for Name: company_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.company_settings (id, name, cnpj, logo_url, created_at, updated_at, cep, endereco, bairro, cidade, nome_responsavel, cargo_responsavel, cpf_responsavel, email, telefone, assinatura_imagem, public_url) VALUES ('f3d229bb-a015-42ed-8bca-04cd304deee1', 'PAJO TECNOLOGIA', '29.180.323/0001-96', '/uploads/logo-1783701495910.png', '2026-07-04 20:04:14.923324-03', '2026-07-17 18:27:41.027211-03', '55294-891', 'IVAILTON AREIAS, 235', 'VIANA E MOURA', 'GARANHUNS', 'Paulo José', 'DIRETOR', '746.926.314-49', 'pajotecnologia@gmail.com', '87996540551', 'data:image/png;base64,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', NULL);


--
-- Data for Name: contratos; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.contratos (id, data_emissao, data_vencimento, valor, company_id, cliente_id, modelo_id, created_by, created_at, updated_at, taxa_implantacao, forma_pagamento, forma_reajuste, modelo_equipamento, prazo_contrato, assinatura_token, assinatura_status, assinatura_observacao, assinatura_imagem, assinatura_data, assinatura_nome, conteudo_personalizado, assinatura_link, vendedor_id) VALUES ('2aebb417-ed92-46bb-ae39-202cc9e0ffab', '2026-07-20', 'Dia 10', 120.00, 'f3d229bb-a015-42ed-8bca-04cd304deee1', '60761776-d32f-48e1-95a9-96b46c80a2e0', 'a5ca1f1c-a027-4dac-9dcc-9048e691f6c0', '31ef2775-ee04-4ffd-bb33-7b952065c86f', '2026-07-20 20:09:27.256436-03', '2026-07-21 12:35:39.23402-03', 0.00, 'boleto', 'IPCA', 'EVO40', '12 MESES', 'y5OrtLUAV0uMuGha', 'assinado', NULL, 'data:image/png;base64,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', '2026-07-21 12:35:39.23402-03', 'Paulo Jose da Silva', '<p style="text-align: justify;"><img src="/uploads/logo-1783701495910.png" alt="PAJO TECNOLOGIA"> <br><br><strong>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE SOFTWARE (SaaS) E LOCAÇÃO DE EQUIPAMENTO </strong><br><br>1. DAS PARTES <br><strong>CONTRATANTE</strong>:<br>• Razão Social: RECRIAR <br>• CNPJ: <br>• Endereço: <br>• Representante Legal:, ,</p><p style="text-align: justify;"></p><p style="text-align: justify;"><strong>CONTRATADA:</strong> <br>• Razão Social: PAJO TECNOLOGIA <br>• CNPJ: 29.180.323/0001-96<br>• Endereço: IVAILTON AREIAS, 235 , VIANA E MOURA, GARANHUNS, 55294-891 <br>• Representante Legal: Paulo José,DIRETOR,746.926.314-49</p><p style="text-align: justify;"><br><br>2. DO OBJETO <br>O presente contrato tem por objeto: <br>• Licenciamento de Software: Uso do sistema de ponto eletrônico em nuvem [EZPOINT]. <br>• Locação de Hardware: Disponibilização de [01] Relógio(s) de Ponto Facial, Modelo EVO 40. <br><br>3. DO PRAZO <br>• Vigência: O contrato terá duração de 12 MESES. <br>• Início: A partir de 20/07/2026. <br>• Renovação: Automática por igual período, salvo manifestação em contrário com 30 dias de antecedência. [1] <br>4. DOS VALORES E CONDIÇÕES DE PAGAMENTO <br>• Mensalidade (Software + Locação): R$ 120,00 mensais. <br>• Taxa de Implantação (Se houver): R$ 0,00 em parcela única. <br>• Vencimento: Dia 10. <br>• Forma de Pagamento: boleto. <br>• Reajuste: Anual com base no índice IPCA. <br>• Data de emissão: 20/07/2026 <br><br>5. DA PERDA, ROUBO OU MAU USO DO EQUIPAMENTO (EVO40)<br>• Responsabilidade de Guarda: A CONTRATANTE é a única guardiã jurídica do aparelho EVO40, respondendo por sua integridade física. <br>• Sinistros (Roubo/Furto): Em caso de roubo ou furto, a CONTRATANTE deve apresentar o Boletim de Ocorrência (B.O.) em até [48 horas] à CONTRATADA. <br>• Indenização: Em caso de perda, roubo, furto ou danos decorrentes de mau uso (quedas, derramamento de líquidos, ligação em voltagem errada ou vandalismo), a CONTRATANTE deverá indenizar a CONTRATADA no valor de R$ [1.100,00] para reposição do equipamento. <br><br>6. DA PROTEÇÃO DE DADOS (LGPD) As partes declaram-se cientes e comprometem-se a cumprir as disposições da Lei Geral de Proteção de Dados (Lei nº 13.709/2018). <br>• Natureza dos Dados: O sistema tratará dados pessoais e biométricos (faciais) dos colaboradores da CONTRATANTE. <br>• Papéis: A CONTRATANTE figura como Controladora dos dados (responsável por coletar o consentimento dos funcionários), e a CONTRATADA figura como Operadora (apenas armazena e processa os dados em nuvem). <br>• Segurança: A CONTRATADA utilizará servidores em nuvem seguros, com criptografia e controle de acesso estrito. Os dados serão eliminados definitivamente do sistema em até [30 dias] após o término definitivo deste contrato. <br><br>7. DOS DEVERES DAS PARTES <br>• Da CONTRATADA: Garantir a estabilidade do sistema em nuvem, fornecer suporte técnico remoto comercial e substituir o aparelho EVO40 em caso de vício ou defeito de fabricação. <br>• Da CONTRATANTE: Efetuar os pagamentos pontualmente sob pena de suspensão do acesso ao sistema.<br><br>8. DA RESCISÃO E MULTA • Rescisão Antecipada: Caso a CONTRATANTE rescinda o contrato antes dos 24 meses, pagará multa rescisória. <br>• Valor da Multa: Equivalente a [50%] das mensalidades restantes para o término do contrato. <br>• Devolução do Equipamento: O aparelho EVO40 deve ser devolvido em perfeito estado em até [8] dias úteis após o término do contrato.<br><br>9. DO FORO Para dirimir quaisquer dúvidas relativas a este contrato, as partes elegem o Foro da Comarca de [Garanhuns - PE]. <br><br>[Garanhuns - PE], 20/07/2026. <br><br>________________________________________ <br>CONTRATANTE</p><p></p><p>________________________________________</p><p>CONTRATADA</p><p><br>As partes acima identificadas firmam o presente contrato.</p><p>corrigido,tidook</p><p></p><p>OIO OIO IOIOIOI   - feito o ajustes</p>', '/a/y5OrtLUAV0uMuGha', NULL);
INSERT INTO public.contratos (id, data_emissao, data_vencimento, valor, company_id, cliente_id, modelo_id, created_by, created_at, updated_at, taxa_implantacao, forma_pagamento, forma_reajuste, modelo_equipamento, prazo_contrato, assinatura_token, assinatura_status, assinatura_observacao, assinatura_imagem, assinatura_data, assinatura_nome, conteudo_personalizado, assinatura_link, vendedor_id) VALUES ('4c1dd236-a6b1-43c3-973a-0be36384801d', '2026-07-10', 'Todo dia 10', 370.00, 'f3d229bb-a015-42ed-8bca-04cd304deee1', 'cbe64cf5-0d67-47fa-83da-823592cff5bf', 'a5ca1f1c-a027-4dac-9dcc-9048e691f6c0', '1be6ccf9-7dec-46e0-8413-115217912a9e', '2026-07-09 19:10:53.820156-03', '2026-07-24 11:11:54.323808-03', 500.00, 'Boleto Mensal / PIX', 'IGP-M', 'Evo 40+ -SERIAL AYTE16053619', '24 meses', 'Y6SwPaGek8jeD2Hn', 'assinado', NULL, 'data:image/png;base64,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', '2026-07-17 14:05:28.24242-03', 'Joao Jose da Silva', '<p style="text-align: justify;"><span style="font-family: Verdana, Geneva, sans-serif;"><img src="/uploads/logo-1783701495910.png" alt="PAJO TECNOLOGIA"> <br><br><strong>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE SOFTWARE (SaaS) E LOCAÇÃO DE EQUIPAMENTO </strong><br><br>1. DAS PARTES <br><strong>CONTRATANTE</strong>:<br>• Razão Social: Garanhuns Palace <br>• CNPJ: 29.180.323/0001-96 <br>• Endereço: Av. Rui Barbosa, 626 <br>• Representante Legal: GIVALDO CALADO DE FREITAS FILHO, 746.926.314-49, DIRETOR</span></p><p style="text-align: justify;"></p><p style="text-align: justify;"><span style="font-family: Verdana, Geneva, sans-serif;"><strong>CONTRATADA:</strong> <br>• Razão Social: PAJO TECNOLOGIA <br>• CNPJ: 29.180.323/0001-96<br>• Endereço: IVAILTON AREIAS, 235 - VIANA E MOURA - GARANHUNS - PE CEP: 55294-891 <br>• Representante Legal: Paulo José - DIRETOR - 746.926.314-49</span></p><p style="text-align: justify;"><span style="font-family: Verdana, Geneva, sans-serif;"><br>2. DO OBJETO <br>O presente contrato tem por objeto: <br>• Licenciamento de Software: Uso do sistema de ponto eletrônico em nuvem [EZPOINT]. <br>• Locação de Hardware: Disponibilização de [01] Relógio(s) de Ponto Facial, Modelo EVO 40. <br><br>3. DO PRAZO <br>• Vigência: O contrato terá duração de 24 meses. <br>• Início: A partir de 10/07/2026. <br>• Renovação: Automática por igual período, salvo manifestação em contrário com 30 dias de antecedência.<br>4. DOS VALORES E CONDIÇÕES DE PAGAMENTO <br>• Mensalidade (Software + Locação): R$ 370,00 mensais. <br>• Taxa de Implantação (Se houver): R$ 500,00 em parcela única. <br>• Vencimento: Todo dia 10. <br>• Forma de Pagamento: Boleto Mensal / PIX. <br>• Reajuste: Anual com base no índice IGP-M. <br>• Data de emissão: 10/07/2026 <br><br>5. DA PERDA, ROUBO OU MAU USO DO EQUIPAMENTO (Evo 40+ -SERIAL AYTE16053619)<br>• Responsabilidade de Guarda: A CONTRATANTE é a única guardiã jurídica do aparelho Evo 40+ -SERIAL AYTE16053619, respondendo por sua integridade física. <br>• Sinistros (Roubo/Furto): Em caso de roubo ou furto, a CONTRATANTE deve apresentar o Boletim de Ocorrência (B.O.) em até [48 horas] à CONTRATADA. <br>• Indenização: Em caso de perda, roubo, furto ou danos decorrentes de mau uso (quedas, derramamento de líquidos, ligação em voltagem errada ou vandalismo), a CONTRATANTE deverá indenizar a CONTRATADA no valor de R$ [1.100,00] para reposição do equipamento. <br><br>6. DA PROTEÇÃO DE DADOS (LGPD) As partes declaram-se cientes e comprometem-se a cumprir as disposições da Lei Geral de Proteção de Dados (Lei nº 13.709/2018). <br>• Natureza dos Dados: O sistema tratará dados pessoais e biométricos (faciais) dos colaboradores da CONTRATANTE. <br>• Papéis: A CONTRATANTE figura como Controladora dos dados (responsável por coletar o consentimento dos funcionários), e a CONTRATADA figura como Operadora (apenas armazena e processa os dados em nuvem). <br>• Segurança: A CONTRATADA utilizará servidores em nuvem seguros, com criptografia e controle de acesso estrito. Os dados serão eliminados definitivamente do sistema em até [30 dias] após o término definitivo deste contrato. <br><br>7. DOS DEVERES DAS PARTES <br>• Da CONTRATADA: Garantir a estabilidade do sistema em nuvem, fornecer suporte técnico remoto comercial e substituir o aparelho Evo 40+ -SERIAL AYTE16053619 em caso de vício ou defeito de fabricação. <br>• Da CONTRATANTE: Efetuar os pagamentos pontualmente sob pena de suspensão do acesso ao sistema.<br><br>8. DA RESCISÃO E MULTA • Rescisão Antecipada: Caso a CONTRATANTE rescinda o contrato antes dos 24 meses, pagará multa rescisória. <br>• Valor da Multa: Equivalente a [50%] das mensalidades restantes para o término do contrato. <br>• Devolução do Equipamento: O aparelho Evo 40+ -SERIAL AYTE16053619 deve ser devolvido em perfeito estado em até [8] dias úteis após o término do contrato.<br><br>9. DO FORO Para dirimir quaisquer dúvidas relativas a este contrato, as partes elegem o Foro da Comarca de [Garanhuns - PE]. <br><br>[Garanhuns - PE], 17/07/2026. <br><br>________________________________________<br>CONTRATANTE</span></p><p></p><p><span style="font-family: Verdana, Geneva, sans-serif;">________________________________________</span></p><p><span style="font-family: Verdana, Geneva, sans-serif;">CONTRATADA</span></p><p><span style="font-family: Verdana, Geneva, sans-serif;"><br>As partes acima identificadas firmam o presente contrato.</span></p><p></p><p></p>', NULL, NULL);


--
-- Data for Name: evolution_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.evolution_settings (id, instance_url, instance_name, api_key, message_template, template_nova_venda, template_pagamento, created_at, updated_at) VALUES ('6419147a-f4a8-41ed-aa3b-2322aec9bb88', 'https://evolution-evolution-api.k7c5qe.easypanel.host/', '80cebbad-f7e2-4e26-a7fb-174c997edcf9_bd664b81-0a51-407f-adc8-d9cb7052ce6f', '80C0F247-250B-40A3-A385-50564D185628', 'Olá {{vendedor}}, sua comissão de R$ {{valor}} ({{percentual}}%) referente ao cliente {{cliente}} foi confirmada!', 'Olá  {{cliente}} , ficamos felizes que você fará parte de nossa carteira de clientes, estamos a disposição para qualquer esclarecimento. Seu contrato ficou no valor de R$ {{valor_servico}}', 'Olá {{vendedor}}, sua comissão foi paga! Vamos a luta, mês que vem tem mais.  
Referente: {{mes_referencia}} Cliente: {{cliente}} - Valor: {{valor}}  e Valor do Serviço : {{valor_servico}}', '2026-07-18 12:09:52.153906-03', '2026-07-20 20:00:55.788337-03');


--
-- Data for Name: message_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.message_templates (id, nome, evento, corpo, ativo_whatsapp, ativo_email, created_at, updated_at) VALUES ('a16ecbae-7e92-4b1b-88fa-86bdf35c6cd8', 'Lembrete de Conta em Aberto', 'Conta em Aberto', 'Olá {{cliente}}, passando apenas para lembrar do boleto referente ao {{mes_referente}}, que consta em aberto. ', true, true, '2026-07-19 11:09:20.840066-03', '2026-07-19 17:29:40.907898-03');
INSERT INTO public.message_templates (id, nome, evento, corpo, ativo_whatsapp, ativo_email, created_at, updated_at) VALUES ('99b90cf5-fa76-46d6-a620-e633fd0558e0', 'tete de mensagem', 'pagamento', 'Olá , {{cliente}}, até o momento nao identificamos o pagamento referente ao mês  {{mes_referencia}}, no valor de R$ {{valor_servico}}', true, true, '2026-07-27 20:25:44.589622-03', '2026-07-27 20:25:44.589622-03');


--
-- Data for Name: modelos; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.modelos (id, nome, conteudo, created_at, updated_at) VALUES ('a5ca1f1c-a027-4dac-9dcc-9048e691f6c0', 'PONTO + LOCACAO', '<p style="text-align: justify;"><span style="font-family: Verdana, Geneva, sans-serif;">{{empresa_logo}} <br><br><strong>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE SOFTWARE (SaaS) E LOCAÇÃO DE EQUIPAMENTO </strong><br><br>1. DAS PARTES <br><strong>CONTRATANTE</strong>:<br>• Razão Social: {{cliente_nome}} <br>• CNPJ: {{cliente_cpf_cnpj}} <br>• Endereço: {{cliente_endereco}} <br>• Representante Legal:{{cliente_nome_responsavel}}, {{cliente_cpf_responsavel}}, {{cliente_cargo_responsavel}}</span></p><p style="text-align: justify;"></p><p style="text-align: justify;"><span style="font-family: Verdana, Geneva, sans-serif;"><strong>CONTRATADA:</strong> <br>• Razão Social: {{empresa_nome}} <br>• CNPJ: {{empresa_cnpj}}<br>• Endereço: {{empresa_endereco}} , {{empresa_bairro}}, {{empresa_cidade}}, {{empresa_cep}} <br>• Representante Legal: {{empresa_nome_responsavel}},{{empresa_cargo_responsavel}},{{empresa_cpf_responsavel}}</span></p><p style="text-align: justify;"><span style="font-family: Verdana, Geneva, sans-serif;"><br><br>2. DO OBJETO <br>O presente contrato tem por objeto: <br>• Licenciamento de Software: Uso do sistema de ponto eletrônico em nuvem [EZPOINT]. <br>• Locação de Hardware: Disponibilização de [01] Relógio(s) de Ponto Facial, Modelo EVO 40. <br><br>3. DO PRAZO <br>• Vigência: O contrato terá duração de {{prazo_contrato}}. <br>• Início: A partir de {{data_emissao}}. <br>• Renovação: Automática por igual período, salvo manifestação em contrário com 30 dias de antecedência. <br>4. DOS VALORES E CONDIÇÕES DE PAGAMENTO <br>• Mensalidade (Software + Locação): R$ {{valor}} mensais. <br>• Taxa de Implantação (Se houver): R$ {{taxa_implantacao}} em parcela única. <br>• Vencimento: {{data_vencimento}}. <br>• Forma de Pagamento: {{forma_pagamento}}. <br>• Reajuste: Anual com base no índice {{forma_reajuste}}. <br>• Data de emissão: {{data_emissao}} <br><br>5. DA PERDA, ROUBO OU MAU USO DO EQUIPAMENTO ({{modelo_equipamento}})<br>• Responsabilidade de Guarda: A CONTRATANTE é a única guardiã jurídica do aparelho {{modelo_equipamento}}, respondendo por sua integridade física. <br>• Sinistros (Roubo/Furto): Em caso de roubo ou furto, a CONTRATANTE deve apresentar o Boletim de Ocorrência (B.O.) em até [48 horas] à CONTRATADA. <br>• Indenização: Em caso de perda, roubo, furto ou danos decorrentes de mau uso (quedas, derramamento de líquidos, ligação em voltagem errada ou vandalismo), a CONTRATANTE deverá indenizar a CONTRATADA no valor para reposição do equipamento. <br> <br>6. DA PROTEÇÃO DE DADOS (LGPD) As partes declaram-se cientes e comprometem-se a cumprir as disposições da Lei Geral de Proteção de Dados (Lei nº 13.709/2018). <br>• Natureza dos Dados: O sistema tratará dados pessoais e biométricos (faciais) dos colaboradores da CONTRATANTE. <br>• Papéis: A CONTRATANTE figura como Controladora dos dados (responsável por coletar o consentimento dos funcionários), e a CONTRATADA figura como Operadora (apenas armazena e processa os dados em nuvem). <br>• Segurança: A CONTRATADA utilizará servidores em nuvem seguros, com criptografia e controle de acesso estrito. Os dados serão eliminados definitivamente do sistema em até [30 dias] após o término definitivo deste contrato. <br><br>7. DOS DEVERES DAS PARTES <br>• Da CONTRATADA: Garantir a estabilidade do sistema em nuvem, fornecer suporte técnico remoto comercial e substituir o aparelho {{modelo_equipamento}} em caso de vício ou defeito de fabricação. <br>• Da CONTRATANTE: Efetuar os pagamentos pontualmente sob pena de suspensão do acesso ao sistema.<br><br>8. DA RESCISÃO E MULTA • Rescisão Antecipada: Caso a CONTRATANTE rescinda o contrato antes dos 24 meses, pagará multa rescisória. <br>• Valor da Multa: Equivalente a [50%] das mensalidades restantes para o término do contrato. <br>• Devolução do Equipamento: O aparelho {{modelo_equipamento}} deve ser devolvido em perfeito estado em até [8] dias úteis após o término do contrato.<br><br>9. DO FORO Para dirimir quaisquer dúvidas relativas a este contrato, as partes elegem o Foro da Comarca de [Garanhuns - PE]. <br><br>[Garanhuns - PE], {{data_atual}}. <br><br>________________________________________ <br>CONTRATANTE</span></p><p></p><p><span style="font-family: Verdana, Geneva, sans-serif;">________________________________________</span></p><p><span style="font-family: Verdana, Geneva, sans-serif;">CONTRATADA</span></p><p><span style="font-family: Verdana, Geneva, sans-serif;"><br>As partes acima identificadas firmam o presente contrato.</span></p>', '2026-07-09 18:29:28.405752-03', '2026-07-24 11:08:22.938222-03');


--
-- Data for Name: parcelas; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('abf24055-8ce6-44df-9d23-b0b6b07778bd', '296c4b3c-ff5c-4abb-b0be-bd2acde7787e', 2, 1200.00, '2026-08-06', NULL, false, NULL, NULL, '2026-07-08 19:09:40.509214-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('8b002bd3-1fb8-4816-8996-170fd1d87f44', '296c4b3c-ff5c-4abb-b0be-bd2acde7787e', 3, 1200.00, '2026-09-06', NULL, false, NULL, NULL, '2026-07-08 19:09:40.509214-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('e4c9f7fe-1fd5-42d0-b587-9e551bd24dd1', '296c4b3c-ff5c-4abb-b0be-bd2acde7787e', 4, 1200.00, '2026-10-06', NULL, false, NULL, NULL, '2026-07-08 19:09:40.509214-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('2ac1c64b-4e7c-42c7-b75e-629bc233fbc9', '296c4b3c-ff5c-4abb-b0be-bd2acde7787e', 5, 1200.00, '2026-11-06', NULL, false, NULL, NULL, '2026-07-08 19:09:40.509214-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('f1dcae92-4889-49db-9b17-9c74dca1ad37', '296c4b3c-ff5c-4abb-b0be-bd2acde7787e', 6, 1200.00, '2026-12-06', NULL, false, NULL, NULL, '2026-07-08 19:09:40.509214-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('a6d40c80-b626-48c9-82f3-37bef2e915de', '296c4b3c-ff5c-4abb-b0be-bd2acde7787e', 7, 1200.00, '2027-01-06', NULL, false, NULL, NULL, '2026-07-08 19:09:40.509214-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('b7674e77-9490-4490-ba94-d7912a0f42c3', '296c4b3c-ff5c-4abb-b0be-bd2acde7787e', 8, 1200.00, '2027-02-06', NULL, false, NULL, NULL, '2026-07-08 19:09:40.509214-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('c6947a33-c0b3-4f3d-839d-3797da9a3c6e', '296c4b3c-ff5c-4abb-b0be-bd2acde7787e', 9, 1200.00, '2027-03-06', NULL, false, NULL, NULL, '2026-07-08 19:09:40.509214-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('2a166c93-50f8-46c9-a78c-a8a0357633ac', '296c4b3c-ff5c-4abb-b0be-bd2acde7787e', 10, 1200.00, '2027-04-06', NULL, false, NULL, NULL, '2026-07-08 19:09:40.509214-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('7659a5d9-0009-4c43-b438-0088bda642e4', '296c4b3c-ff5c-4abb-b0be-bd2acde7787e', 11, 1200.00, '2027-05-06', NULL, false, NULL, NULL, '2026-07-08 19:09:40.509214-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('565b2668-e3eb-4584-903f-24c2734eeedf', '296c4b3c-ff5c-4abb-b0be-bd2acde7787e', 12, 1200.00, '2027-06-06', NULL, false, NULL, NULL, '2026-07-08 19:09:40.509214-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('90700eb3-e2a8-42eb-b727-e99d56399889', '802fe3ec-d7f8-4259-933c-92a71431e771', 2, 850.00, '2026-08-05', NULL, false, NULL, NULL, '2026-07-08 19:18:47.860784-03', 'Julho/2026', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('c2b9b0b1-9468-4e17-8833-a34698f2f252', '802fe3ec-d7f8-4259-933c-92a71431e771', 3, 850.00, '2026-09-05', NULL, false, NULL, NULL, '2026-07-08 19:18:47.860784-03', 'Agosto/2026', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('bb90df4f-15a0-4622-865f-65d3f74e4f10', '802fe3ec-d7f8-4259-933c-92a71431e771', 4, 850.00, '2026-10-05', NULL, false, NULL, NULL, '2026-07-08 19:18:47.860784-03', 'Setembro/2026', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('a735cc9e-8d67-4f59-8a08-062922a2bf47', '802fe3ec-d7f8-4259-933c-92a71431e771', 5, 850.00, '2026-11-05', NULL, false, NULL, NULL, '2026-07-08 19:18:47.860784-03', 'Outubro/2026', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('ce0960d0-a23a-4b3e-9b57-46cc35d1ec79', '802fe3ec-d7f8-4259-933c-92a71431e771', 6, 850.00, '2026-12-05', NULL, false, NULL, NULL, '2026-07-08 19:18:47.860784-03', 'Novembro/2026', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('f5927dcb-f76d-4fe7-8e74-5263d0382685', '802fe3ec-d7f8-4259-933c-92a71431e771', 7, 850.00, '2027-01-05', NULL, false, NULL, NULL, '2026-07-08 19:18:47.860784-03', 'Dezembro/2026', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('e0272473-1418-4838-8fce-3ae93f301fc7', '802fe3ec-d7f8-4259-933c-92a71431e771', 8, 850.00, '2027-02-05', NULL, false, NULL, NULL, '2026-07-08 19:18:47.860784-03', 'Janeiro/2027', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('97e34125-ec7b-4938-911f-e9050fc15f3b', '802fe3ec-d7f8-4259-933c-92a71431e771', 9, 850.00, '2027-03-05', NULL, false, NULL, NULL, '2026-07-08 19:18:47.860784-03', 'Fevereiro/2027', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('8193841c-63f7-4238-b010-82e93a63fe09', '802fe3ec-d7f8-4259-933c-92a71431e771', 10, 850.00, '2027-04-05', NULL, false, NULL, NULL, '2026-07-08 19:18:47.860784-03', 'Março/2027', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('8734899e-bd3a-42d3-8634-5c7e1f132fbf', '802fe3ec-d7f8-4259-933c-92a71431e771', 11, 850.00, '2027-05-05', NULL, false, NULL, NULL, '2026-07-08 19:18:47.860784-03', 'Abril/2027', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('a1a1f7ec-8d47-46ba-b17e-8835ae7d8c86', '802fe3ec-d7f8-4259-933c-92a71431e771', 12, 850.00, '2027-06-05', NULL, false, NULL, NULL, '2026-07-08 19:18:47.860784-03', 'Maio/2027', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('28f0620c-965b-4ccd-b1cb-2e4162a27665', '77df4a2c-2767-48dc-b081-9b33766c69ce', 2, 120.00, '2026-08-20', NULL, false, NULL, NULL, '2026-07-08 19:25:48.421645-03', 'Julho/2026', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('9127184d-d1d3-40e2-a4ab-33087ac9581a', '77df4a2c-2767-48dc-b081-9b33766c69ce', 3, 120.00, '2026-09-20', NULL, false, NULL, NULL, '2026-07-08 19:25:48.421645-03', 'Agosto/2026', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('c0ad92ae-5958-4a19-93a2-fbcfc3c53b6d', '77df4a2c-2767-48dc-b081-9b33766c69ce', 4, 120.00, '2026-10-20', NULL, false, NULL, NULL, '2026-07-08 19:25:48.421645-03', 'Setembro/2026', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('63080101-1f8d-41d8-9791-92336608c8e9', '77df4a2c-2767-48dc-b081-9b33766c69ce', 5, 120.00, '2026-11-20', NULL, false, NULL, NULL, '2026-07-08 19:25:48.421645-03', 'Outubro/2026', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('6d39f251-095b-4f78-91ac-ec82116dd274', '77df4a2c-2767-48dc-b081-9b33766c69ce', 6, 120.00, '2026-12-20', NULL, false, NULL, NULL, '2026-07-08 19:25:48.421645-03', 'Novembro/2026', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('ef3cd3b6-7ef1-423a-a4b0-d8da2971a52e', '77df4a2c-2767-48dc-b081-9b33766c69ce', 7, 120.00, '2027-01-20', NULL, false, NULL, NULL, '2026-07-08 19:25:48.421645-03', 'Dezembro/2026', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('f6286953-72e1-4602-a43b-66bc2a0f53c4', '77df4a2c-2767-48dc-b081-9b33766c69ce', 8, 120.00, '2027-02-20', NULL, false, NULL, NULL, '2026-07-08 19:25:48.421645-03', 'Janeiro/2027', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('8ab384c3-48c8-4be2-969f-db36ca4dce80', '77df4a2c-2767-48dc-b081-9b33766c69ce', 9, 120.00, '2027-03-20', NULL, false, NULL, NULL, '2026-07-08 19:25:48.421645-03', 'Fevereiro/2027', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('4b2ec35a-d2b1-4ffc-beb1-ac8938b36c6c', '77df4a2c-2767-48dc-b081-9b33766c69ce', 10, 120.00, '2027-04-20', NULL, false, NULL, NULL, '2026-07-08 19:25:48.421645-03', 'Março/2027', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('843bdec2-fe15-48b8-ba1d-07dc9dde4051', '77df4a2c-2767-48dc-b081-9b33766c69ce', 11, 120.00, '2027-05-20', NULL, false, NULL, NULL, '2026-07-08 19:25:48.421645-03', 'Abril/2027', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('08e01a08-0b71-42e1-83ba-d3b5f16d03a2', '77df4a2c-2767-48dc-b081-9b33766c69ce', 12, 120.00, '2027-06-20', NULL, false, NULL, NULL, '2026-07-08 19:25:48.421645-03', 'Maio/2027', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('a176b5ef-56e7-452f-a87f-f828a3c83dc8', '77df4a2c-2767-48dc-b081-9b33766c69ce', 1, 120.00, '2026-07-20', '2026-07-22 12:00:00-03', true, '2233', 'teste de pagamento', '2026-07-08 19:25:48.421645-03', 'Junho/2026', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('7715f841-a8c6-4f42-aa64-ee7782a88733', '802fe3ec-d7f8-4259-933c-92a71431e771', 1, 850.00, '2026-07-05', '2026-07-09 12:00:00-03', true, '5555', NULL, '2026-07-08 19:18:47.860784-03', 'Junho/2026', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.parcelas (id, venda_id, numero_parcela, valor, data_vencimento, data_pagamento, pago, numero_nf, observacao, created_at, mes_referencia, asaas_cobranca_id, asaas_status, asaas_boleto_url, asaas_pix_qr_code, asaas_pix_copy_paste, asaas_invoice_url) VALUES ('8aad87d9-3e89-4e94-9e67-8487fff49cba', '296c4b3c-ff5c-4abb-b0be-bd2acde7787e', 1, 1200.00, '2026-07-06', '2026-07-09 12:00:00-03', true, '5555', NULL, '2026-07-08 19:09:40.509214-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.password_reset_tokens (id, user_id, token, expires_at, used, created_at) VALUES ('8b727346-862f-4851-9c9e-0005761eb830', '31ef2775-ee04-4ffd-bb33-7b952065c86f', '3c71eda6dccd42870c05097858a348a5157bbd45166c7b881e9579a73b55ab9d', '2026-07-18 10:37:44.044-03', false, '2026-07-18 09:37:44.045479-03');
INSERT INTO public.password_reset_tokens (id, user_id, token, expires_at, used, created_at) VALUES ('99c2b0ff-fd10-4964-a984-475c8a077cb9', '31ef2775-ee04-4ffd-bb33-7b952065c86f', 'c0742764676fd9576f523045101eb2b9fe97397f9d88aff91e310ad6524963a5', '2026-07-19 13:57:03.288-03', false, '2026-07-19 12:57:03.292895-03');


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.profiles (id, user_id, full_name, whatsapp, cpf, created_at, updated_at) VALUES ('ee25d62d-716c-4c98-a051-ea69453df6d6', '1be6ccf9-7dec-46e0-8413-115217912a9e', 'Admin Teste', '', '', '2026-07-03 18:02:03.535093-03', '2026-07-03 18:02:03.535093-03');
INSERT INTO public.profiles (id, user_id, full_name, whatsapp, cpf, created_at, updated_at) VALUES ('bfffe325-07b1-46a4-b362-2c35bf5c0db0', '462d21cd-fcf7-463e-819b-bdb2a00f9f56', 'Vendedor Teste', '', '', '2026-07-03 18:46:16.595517-03', '2026-07-03 18:46:16.595517-03');
INSERT INTO public.profiles (id, user_id, full_name, whatsapp, cpf, created_at, updated_at) VALUES ('3703fb3f-3e38-4016-b56b-41dc50675d30', '31ef2775-ee04-4ffd-bb33-7b952065c86f', 'paulo', '', '', '2026-07-08 17:52:58.327506-03', '2026-07-08 17:52:58.327506-03');
INSERT INTO public.profiles (id, user_id, full_name, whatsapp, cpf, created_at, updated_at) VALUES ('80edcdd3-6ca6-466c-9ea5-8537db1894d0', '58d49947-05d6-4b2b-b02e-3f49f61ffeff', 'dev-test', '', '', '2026-07-19 17:22:20.321546-03', '2026-07-19 17:22:20.321546-03');


--
-- Data for Name: proposta_itens; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.proposta_itens (id, proposta_id, descricao, imagem_url, quantidade, valor_unitario, total, ordem, created_at) VALUES ('ad87a56f-0b87-4539-8a63-eb388eccbd69', '297fa1bf-53d2-4bab-8061-107d91c5da21', 'EVO 40 - RECONHECIMENTO FACIAL', '/uploads/logo-1783713154759.png', 6.00, 267.00, 1602.00, 0, '2026-07-18 11:27:01.146841-03');


--
-- Data for Name: propostas; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.propostas (id, data_proposta, cliente_id, tipo_proposta, titulo, total, company_id, created_by, created_at, updated_at, desconto, assinatura_token, assinatura_status, assinatura_observacao, assinatura_imagem, assinatura_data, assinatura_nome, assinatura_link, vendedor_id) VALUES ('297fa1bf-53d2-4bab-8061-107d91c5da21', '2026-07-10', '6d35d1be-0b39-4389-80c2-dbca655e1e2b', 'prestação de servicos', 'PROPOSTA COMERCIAL', 1600.00, 'f3d229bb-a015-42ed-8bca-04cd304deee1', NULL, '2026-07-10 16:46:32.178742-03', '2026-07-18 11:27:01.055283-03', 0.00, 'Yi6HBdpJG83Jl4m3', 'enviado', NULL, NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: smtp_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.smtp_settings (id, host, port, username, password, from_email, from_name, use_tls, template_nova_venda, template_pagamento, created_at, updated_at) VALUES ('20c22dac-1f65-444c-80c3-d06dd0193874', 'smtp.gmail.com', 587, 'pajotecnologia@gmail.com', 'vqgwrenitcwvsikx', 'pajotecnologia@gmail.com', 'Pajo Tecnologia', true, '', '', '2026-07-18 10:37:26.37269-03', '2026-07-18 10:37:26.37269-03');


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.user_roles (id, user_id, role) VALUES ('d0d22797-2544-47ef-ae5c-c5e0fdfcb5e6', '1be6ccf9-7dec-46e0-8413-115217912a9e', 'admin');
INSERT INTO public.user_roles (id, user_id, role) VALUES ('ad8026b9-c95d-4838-9236-a6f41d6ef811', '462d21cd-fcf7-463e-819b-bdb2a00f9f56', 'vendedor');
INSERT INTO public.user_roles (id, user_id, role) VALUES ('2b50959c-9f95-4303-882c-d66f098f5f33', '31ef2775-ee04-4ffd-bb33-7b952065c86f', 'admin');
INSERT INTO public.user_roles (id, user_id, role) VALUES ('0d285c5b-a860-449f-b3b2-0cb6366dbe8b', '58d49947-05d6-4b2b-b02e-3f49f61ffeff', 'admin');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users (id, email, password_hash, created_at) VALUES ('462d21cd-fcf7-463e-819b-bdb2a00f9f56', 'vendedor@teste.com', '$2a$10$BYpTW91ETD.ek7av9FLkxuE2RYIhJlbJtuGFtdOraUv9hS22FvlFC', '2026-07-03 18:46:16.587838-03');
INSERT INTO public.users (id, email, password_hash, created_at) VALUES ('1be6ccf9-7dec-46e0-8413-115217912a9e', 'admin@teste.com', '$2a$10$/60x/ef7eIz.hf70xZgGPuRiShRlgIwoLGsvSIaCCSC1k801iQ/u2', '2026-07-03 18:02:03.522768-03');
INSERT INTO public.users (id, email, password_hash, created_at) VALUES ('31ef2775-ee04-4ffd-bb33-7b952065c86f', 'pajotecnologia@gmail.com', '$2a$10$mCDXer4AiFOjxoKrcYCeee5jBsatQggSODmkKimVCEhBXpIcnjr0q', '2026-07-08 17:52:58.314129-03');
INSERT INTO public.users (id, email, password_hash, created_at) VALUES ('58d49947-05d6-4b2b-b02e-3f49f61ffeff', 'dev-test@local.test', '$2a$10$VQnkc.bMInSXVr2qG/lYBuWxL8hqfVdvQZx3XX8xWPd9sk7/4eVmi', '2026-07-19 17:22:20.281421-03');


--
-- Data for Name: venda_vendedores; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: vendas; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.vendas (id, cliente, cliente_id, valor_servico, data_venda, mes_referencia, cliente_pagou, data_pagamento_cliente, observacao_pagamento, recorrente, created_by, created_at, updated_at, numero_nota_fiscal, contrato_id, numero_parcela, total_parcelas, data_vencimento, qtde_parcelas, valor_parcela, primeiro_vencimento) VALUES ('296c4b3c-ff5c-4abb-b0be-bd2acde7787e', 'Garanhuns Palace', 'cbe64cf5-0d67-47fa-83da-823592cff5bf', 14400.00, '2025-12-01', 'Junho/2026', false, NULL, NULL, false, '1be6ccf9-7dec-46e0-8413-115217912a9e', '2026-07-08 19:09:40.467451-03', '2026-07-08 19:09:40.467451-03', NULL, NULL, 1, 1, NULL, 12, 1200.00, '2026-07-06');
INSERT INTO public.vendas (id, cliente, cliente_id, valor_servico, data_venda, mes_referencia, cliente_pagou, data_pagamento_cliente, observacao_pagamento, recorrente, created_by, created_at, updated_at, numero_nota_fiscal, contrato_id, numero_parcela, total_parcelas, data_vencimento, qtde_parcelas, valor_parcela, primeiro_vencimento) VALUES ('802fe3ec-d7f8-4259-933c-92a71431e771', 'Empresa X', '6d35d1be-0b39-4389-80c2-dbca655e1e2b', 10200.00, '2025-12-01', 'Junho/2026', false, NULL, NULL, false, '1be6ccf9-7dec-46e0-8413-115217912a9e', '2026-07-08 19:18:47.846719-03', '2026-07-08 19:18:47.846719-03', NULL, NULL, 1, 1, NULL, 12, 850.00, '2026-07-05');
INSERT INTO public.vendas (id, cliente, cliente_id, valor_servico, data_venda, mes_referencia, cliente_pagou, data_pagamento_cliente, observacao_pagamento, recorrente, created_by, created_at, updated_at, numero_nota_fiscal, contrato_id, numero_parcela, total_parcelas, data_vencimento, qtde_parcelas, valor_parcela, primeiro_vencimento) VALUES ('77df4a2c-2767-48dc-b081-9b33766c69ce', 'RECRIAR', '60761776-d32f-48e1-95a9-96b46c80a2e0', 1440.00, '2026-01-01', 'Junho/2026', false, NULL, NULL, false, '1be6ccf9-7dec-46e0-8413-115217912a9e', '2026-07-08 19:25:48.405371-03', '2026-07-08 19:25:48.405371-03', NULL, NULL, 1, 1, NULL, 12, 120.00, '2026-07-20');


--
-- Data for Name: vendedores; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.vendedores (id, user_id, nome, whatsapp, cpf, email, comissao_padrao, ativo, created_at, updated_at) VALUES ('13f7c585-a23b-48f2-b604-ecd35175feca', NULL, 'Joao', '(87) 99654-0551', '', 'paulojsilva@live.com', 10.00, true, '2026-07-03 18:10:52.503642-03', '2026-07-21 07:54:13.469125-03');


--
-- Name: agendamentos_envio agendamentos_envio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamentos_envio
    ADD CONSTRAINT agendamentos_envio_pkey PRIMARY KEY (id);


--
-- Name: asaas_settings asaas_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asaas_settings
    ADD CONSTRAINT asaas_settings_pkey PRIMARY KEY (id);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: company_settings company_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_pkey PRIMARY KEY (id);


--
-- Name: contratos contratos_assinatura_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_assinatura_token_key UNIQUE (assinatura_token);


--
-- Name: contratos contratos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_pkey PRIMARY KEY (id);


--
-- Name: evolution_settings evolution_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evolution_settings
    ADD CONSTRAINT evolution_settings_pkey PRIMARY KEY (id);


--
-- Name: message_templates message_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_pkey PRIMARY KEY (id);


--
-- Name: modelos modelos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modelos
    ADD CONSTRAINT modelos_pkey PRIMARY KEY (id);


--
-- Name: parcelas parcelas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parcelas
    ADD CONSTRAINT parcelas_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: proposta_itens proposta_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proposta_itens
    ADD CONSTRAINT proposta_itens_pkey PRIMARY KEY (id);


--
-- Name: propostas propostas_assinatura_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.propostas
    ADD CONSTRAINT propostas_assinatura_token_key UNIQUE (assinatura_token);


--
-- Name: propostas propostas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.propostas
    ADD CONSTRAINT propostas_pkey PRIMARY KEY (id);


--
-- Name: smtp_settings smtp_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.smtp_settings
    ADD CONSTRAINT smtp_settings_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: venda_vendedores venda_vendedores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venda_vendedores
    ADD CONSTRAINT venda_vendedores_pkey PRIMARY KEY (id);


--
-- Name: vendas vendas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendas
    ADD CONSTRAINT vendas_pkey PRIMARY KEY (id);


--
-- Name: vendedores vendedores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendedores
    ADD CONSTRAINT vendedores_pkey PRIMARY KEY (id);


--
-- Name: idx_contratos_cliente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contratos_cliente ON public.contratos USING btree (cliente_id);


--
-- Name: idx_contratos_modelo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contratos_modelo ON public.contratos USING btree (modelo_id);


--
-- Name: idx_contratos_vendedor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contratos_vendedor ON public.contratos USING btree (vendedor_id);


--
-- Name: idx_parcelas_venda; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parcelas_venda ON public.parcelas USING btree (venda_id);


--
-- Name: idx_proposta_itens_proposta; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_proposta_itens_proposta ON public.proposta_itens USING btree (proposta_id);


--
-- Name: idx_propostas_cliente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_propostas_cliente ON public.propostas USING btree (cliente_id);


--
-- Name: idx_propostas_vendedor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_propostas_vendedor ON public.propostas USING btree (vendedor_id);


--
-- Name: idx_user_roles_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id);


--
-- Name: idx_venda_vendedores_venda; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_venda_vendedores_venda ON public.venda_vendedores USING btree (venda_id);


--
-- Name: idx_venda_vendedores_vendedor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_venda_vendedores_vendedor ON public.venda_vendedores USING btree (vendedor_id);


--
-- Name: idx_vendas_cliente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendas_cliente ON public.vendas USING btree (cliente_id);


--
-- Name: idx_vendas_contrato; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendas_contrato ON public.vendas USING btree (contrato_id);


--
-- Name: idx_vendedores_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendedores_user ON public.vendedores USING btree (user_id);


--
-- Name: clientes set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: company_settings set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contratos set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contratos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: evolution_settings set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.evolution_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: modelos set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.modelos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: propostas set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.propostas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: smtp_settings set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.smtp_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vendas set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.vendas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vendedores set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.vendedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contratos contratos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: contratos contratos_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company_settings(id) ON DELETE SET NULL;


--
-- Name: contratos contratos_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: contratos contratos_modelo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES public.modelos(id) ON DELETE SET NULL;


--
-- Name: contratos contratos_vendedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES public.vendedores(id) ON DELETE SET NULL;


--
-- Name: parcelas parcelas_venda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parcelas
    ADD CONSTRAINT parcelas_venda_id_fkey FOREIGN KEY (venda_id) REFERENCES public.vendas(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: proposta_itens proposta_itens_proposta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proposta_itens
    ADD CONSTRAINT proposta_itens_proposta_id_fkey FOREIGN KEY (proposta_id) REFERENCES public.propostas(id) ON DELETE CASCADE;


--
-- Name: propostas propostas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.propostas
    ADD CONSTRAINT propostas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: propostas propostas_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.propostas
    ADD CONSTRAINT propostas_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company_settings(id) ON DELETE SET NULL;


--
-- Name: propostas propostas_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.propostas
    ADD CONSTRAINT propostas_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: propostas propostas_vendedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.propostas
    ADD CONSTRAINT propostas_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES public.vendedores(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: venda_vendedores venda_vendedores_venda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venda_vendedores
    ADD CONSTRAINT venda_vendedores_venda_id_fkey FOREIGN KEY (venda_id) REFERENCES public.vendas(id) ON DELETE CASCADE;


--
-- Name: venda_vendedores venda_vendedores_vendedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venda_vendedores
    ADD CONSTRAINT venda_vendedores_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES public.vendedores(id) ON DELETE CASCADE;


--
-- Name: vendas vendas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendas
    ADD CONSTRAINT vendas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: vendas vendas_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendas
    ADD CONSTRAINT vendas_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: vendedores vendedores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendedores
    ADD CONSTRAINT vendedores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--




