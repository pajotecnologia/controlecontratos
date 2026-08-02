export type VariavelModelo = {
  tag: string;
  rotulo: string;
  exemplo: string;
};

export const variaveisEmpresa: VariavelModelo[] = [
  { tag: "{{empresa_nome}}", rotulo: "Nome da empresa", exemplo: "PAJO TECNOLOGIA" },
  { tag: "{{empresa_cnpj}}", rotulo: "CNPJ da empresa", exemplo: "29.180.323/0001-96" },
  { tag: "{{empresa_cep}}", rotulo: "CEP da empresa", exemplo: "55294-891" },
  { tag: "{{empresa_endereco}}", rotulo: "Endereço da empresa", exemplo: "Rua Ivailton Areias, 235" },
  { tag: "{{empresa_bairro}}", rotulo: "Bairro da empresa", exemplo: "Viana e Moura" },
  { tag: "{{empresa_cidade}}", rotulo: "Cidade da empresa", exemplo: "Garanhuns" },
  { tag: "{{empresa_email}}", rotulo: "Email da empresa", exemplo: "contato@empresa.com" },
  { tag: "{{empresa_telefone}}", rotulo: "Telefone da empresa", exemplo: "(87) 99999-0000" },
  { tag: "{{empresa_endereco_completo}}", rotulo: "Endereço completo da empresa", exemplo: "Rua Ivailton Areias, 235 - Viana e Moura - Garanhuns - CEP: 55294-891" },
  { tag: "{{empresa_nome_responsavel}}", rotulo: "Nome do responsável pela empresa", exemplo: "Alexandre Pajo" },
  { tag: "{{empresa_cargo_responsavel}}", rotulo: "Cargo do responsável", exemplo: "Diretor Executivo" },
  { tag: "{{empresa_cpf_responsavel}}", rotulo: "CPF do responsável", exemplo: "999.888.777-11" },
  { tag: "{{empresa_logo}}", rotulo: "Logomarca da empresa", exemplo: "[LOGOMARCA]" },
  { tag: "{{empresa_cabecalho}}", rotulo: "Cabeçalho completo da empresa", exemplo: "[CABEÇALHO DA EMPRESA]" },
  { tag: "{{empresa_assinatura}}", rotulo: "Assinatura digital da empresa", exemplo: "[ASSINATURA EMPRESA]" },
];

export const variaveisCliente: VariavelModelo[] = [
  { tag: "{{cliente_nome}}", rotulo: "Nome do cliente", exemplo: "João da Silva" },
  { tag: "{{cliente_telefone}}", rotulo: "Telefone do cliente", exemplo: "(87) 99999-0000" },
  { tag: "{{cliente_email}}", rotulo: "E-mail do cliente", exemplo: "joao@email.com" },
  { tag: "{{cliente_cpf_cnpj}}", rotulo: "CPF/CNPJ do cliente", exemplo: "123.456.789-00" },
  { tag: "{{cliente_endereco}}", rotulo: "Endereço do cliente", exemplo: "Av. Central, 100" },
  { tag: "{{cliente_bairro}}", rotulo: "Bairro do cliente", exemplo: "Centro" },
  { tag: "{{cliente_cidade}}", rotulo: "Cidade do cliente", exemplo: "Recife" },
  { tag: "{{cliente_estado}}", rotulo: "Estado do cliente", exemplo: "PE" },
  { tag: "{{cliente_cep}}", rotulo: "CEP do cliente", exemplo: "50000-000" },
  { tag: "{{cliente_endereco_completo}}", rotulo: "Endereço completo do cliente", exemplo: "Av. Central, 100 - Centro - Recife - PE - CEP: 50000-000" },
  { tag: "{{cliente_nome_responsavel}}", rotulo: "Nome do responsável do cliente", exemplo: "Carlos Augusto" },
  { tag: "{{cliente_cpf_responsavel}}", rotulo: "CPF do responsável do cliente", exemplo: "888.777.666-55" },
  { tag: "{{cliente_cargo_responsavel}}", rotulo: "Cargo do responsável do cliente", exemplo: "Gerente Geral" },
];

export const variaveisContrato: VariavelModelo[] = [
  { tag: "{{data_atual}}", rotulo: "Data atual", exemplo: new Date().toLocaleDateString("pt-BR") },
  { tag: "{{data_emissao}}", rotulo: "Data de emissão do contrato", exemplo: new Date().toLocaleDateString("pt-BR") },
  { tag: "{{data_vencimento}}", rotulo: "Data de vencimento do contrato", exemplo: "10/08/2026" },
  { tag: "{{valor}}", rotulo: "Valor do contrato", exemplo: "1.500,00" },
  { tag: "{{taxa_implantacao}}", rotulo: "Taxa de implantação", exemplo: "150,00" },
  { tag: "{{forma_pagamento}}", rotulo: "Forma de pagamento", exemplo: "Boleto bancário D+3" },
  { tag: "{{forma_reajuste}}", rotulo: "Forma de reajuste anual", exemplo: "IPCA acumulado" },
  { tag: "{{modelo_equipamento}}", rotulo: "Modelo do equipamento", exemplo: "POS Gertec GP730" },
  { tag: "{{prazo_contrato}}", rotulo: "Prazo do contrato", exemplo: "12 meses" },
];

export const todasVariaveisModelo = [...variaveisEmpresa, ...variaveisCliente, ...variaveisContrato];

export const tagsVariaveisModelo = todasVariaveisModelo.map((variavel) => variavel.tag);

export const exemplosVariaveisModelo = Object.fromEntries(
  todasVariaveisModelo.map((variavel) => [variavel.tag, variavel.exemplo])
) as Record<string, string>;
