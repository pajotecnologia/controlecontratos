// Backend API client (Node/Express + PostgreSQL local). NENHUMA dependência de
// Supabase — só mantemos este caminho/nome de importação para as telas não
// precisarem mudar. Autenticação, query builder e helpers conversam com
// ${VITE_API_URL}/... (ver variável de ambiente).

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const SESSION_KEY = "app_session";

// Tipos locais (substituem os tipos que vinham de @supabase/supabase-js)
export type User = { id: string; email: string };
export type Session = { access_token: string; user: User } | null;

let session: Session = loadSession();
const listeners: Array<(event: string, session: Session) => void> = [];

function loadSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(s: Session, event: string) {
  session = s;
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
  listeners.forEach((cb) => cb(event, s));
}

async function api(path: string, body?: any, opts: { form?: FormData; method?: string } = {}) {
  const headers: Record<string, string> = {};
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  let fetchBody: any;
  if (opts.form) {
    fetchBody = opts.form;
  } else if (body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
    fetchBody = JSON.stringify(body);
  }
  const method = opts.method || (body !== undefined ? "POST" : "GET");
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: fetchBody });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

class QueryBuilder {
  private table: string;
  private action: "select" | "insert" | "update" | "delete" = "select";
  private _select = "*";
  private _values: any = null;
  private _filters: Array<{ column: string; op: string; value: any }> = [];
  private _order: { column: string; ascending: boolean } | null = null;
  private _limit: number | null = null;
  private _single: "single" | "maybeSingle" | null = null;
  private _returning = false;

  constructor(table: string) {
    this.table = table;
  }

  select(cols = "*") {
    if (this.action === "select") this._select = cols;
    else this._returning = true;
    return this;
  }
  insert(values: any) { this.action = "insert"; this._values = values; return this; }
  update(values: any) { this.action = "update"; this._values = values; return this; }
  delete() { this.action = "delete"; return this; }
  eq(column: string, value: any) { this._filters.push({ column, op: "eq", value }); return this; }
  in(column: string, value: any[]) { this._filters.push({ column, op: "in", value }); return this; }
  order(column: string, opts: { ascending?: boolean } = {}) {
    this._order = { column, ascending: opts.ascending !== false };
    return this;
  }
  limit(n: number) { this._limit = n; return this; }
  single() { this._single = "single"; return this; }
  maybeSingle() { this._single = "maybeSingle"; return this; }

  then(resolve: (r: any) => any, reject?: (e: any) => any) {
    return this.exec().then(resolve, reject);
  }

  private async exec() {
    let path: string;
    let body: any;
    if (this.action === "select") {
      path = "/data/select";
      body = { table: this.table, select: this._select, filters: this._filters, order: this._order, limit: this._limit };
    } else if (this.action === "insert") {
      path = "/data/insert";
      body = { table: this.table, values: this._values };
    } else if (this.action === "update") {
      path = "/data/update";
      body = { table: this.table, values: this._values, filters: this._filters };
    } else {
      path = "/data/delete";
      body = { table: this.table, filters: this._filters };
    }
    const { ok, json } = await api(path, body);
    if (!ok) return { data: null, error: { message: json.error || "Erro na requisição" } };
    let data = json.data;
    if (this._single) data = Array.isArray(data) ? (data[0] ?? null) : data;
    return { data, error: null };
  }
}

export const supabase = {
  from(table: string) {
    return new QueryBuilder(table);
  },

  rpc(fn: string, _params?: any) {
    // Único rpc usado: has_role(admin). Resolve via /auth/me.
    return (async () => {
      const { ok, json } = await api("/auth/me", {});
      if (!ok) return { data: false, error: { message: json.error } };
      return { data: !!json.isAdmin, error: null };
    })();
  },

  auth: {
    async getSession() {
      return { data: { session }, error: null };
    },
    async getUser() {
      return { data: { user: session?.user ?? null }, error: null };
    },
    onAuthStateChange(cb: (event: string, session: Session) => void) {
      listeners.push(cb);
      return { data: { subscription: { unsubscribe() { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); } } } };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const { ok, json } = await api("/auth/login", { email, password });
      if (!ok) return { data: null, error: { message: json.error } };
      setSession({ access_token: json.token, user: json.user }, "SIGNED_IN");
      return { data: { session }, error: null };
    },
    async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { full_name?: string } } }) {
      const { ok, json } = await api("/auth/signup", { email, password, full_name: options?.data?.full_name });
      if (!ok) return { data: null, error: { message: json.error } };
      setSession({ access_token: json.token, user: json.user }, "SIGNED_IN");
      return { data: { session }, error: null };
    },
    async signOut() {
      setSession(null, "SIGNED_OUT");
      return { error: null };
    },
    async resetPasswordForEmail(email: string, opts?: { redirectTo?: string }) {
      const { ok, json } = await api("/auth/request-reset", { email, redirect_to: opts?.redirectTo });
      if (!ok) return { data: null, error: { message: json.error } };
      return { data: json, error: null };
    },
    async updateUser({ password }: { password: string }) {
      const { ok, json } = await api("/auth/update-password", { password });
      if (!ok) return { data: null, error: { message: json.error } };
      return { data: null, error: null };
    },
  },
};

// Helpers extras usados fora do padrão supabase (upload de logo e notificações).
export async function uploadArquivo(file: File): Promise<{ url: string | null; error: string | null }> {
  const form = new FormData();
  form.append("file", file);
  const { ok, json } = await api("/upload", undefined, { form });
  if (!ok) return { url: null, error: json.error || "Falha no upload" };
  return { url: json.url, error: null };
}

export async function uploadLogo(file: File): Promise<{ url: string | null; error: string | null }> {
  return uploadArquivo(file);
}

export async function notify(channel: "whatsapp" | "email", body: any) {
  return api(`/notify/${channel}`, body);
}

export async function sendReceipt(parcela_id: string, channel: "whatsapp" | "email", mensagem?: string) {
  return api("/notify/receipt", { parcela_id, channel, mensagem });
}

export async function sendCobrancaSimples(parcela_id: string, channel: "whatsapp" | "email", mensagem?: string) {
  return api("/notify/cobranca", { parcela_id, channel, mensagem });
}

export async function resetPasswordWithToken(token: string, password: string): Promise<{ error: string | null }> {
  const { ok, json } = await api("/auth/reset-password", { token, password });
  return { error: ok ? null : (json.error || "Falha ao redefinir senha") };
}

export async function previewContrato(body: {
  conteudo: string;
  cliente_id?: string;
  valor?: number;
  taxa_implantacao?: number;
  forma_pagamento?: string;
  forma_reajuste?: string;
  modelo_equipamento?: string;
  prazo_contrato?: string;
  data_emissao?: string;
  data_vencimento?: string;
}): Promise<{ conteudo: string; error: string | null }> {
  const { ok, json } = await api("/contratos/preview", body);
  if (!ok) return { conteudo: "", error: json.error || "Falha ao gerar pré-visualização" };
  return { conteudo: json.conteudo || "", error: null };
}


export async function notifyVendedor(tipo: "contrato" | "proposta", id: string, evento: string, canal: "whatsapp" | "email" | "both" = "whatsapp"): Promise<{ success: boolean; results?: any[]; error?: string }> {
  const { ok, json } = await api("/notify/vendedor", { tipo, id, evento, canal });
  if (!ok) return { success: false, error: json.error || "Falha ao enviar notificação" };
  return json;
}

export async function enviarParaAssinatura(contratoId: string): Promise<{ link: string; whatsapp_enviado: boolean; error: string | null }> {
  const { ok, json } = await api(`/contratos/${contratoId}/enviar-assinatura`, {});
  if (!ok) return { link: "", whatsapp_enviado: false, error: json.error || "Falha ao gerar link" };
  return { link: json.link, whatsapp_enviado: json.whatsapp_enviado, error: null };
}

export async function enviarPropostaEmail(propostaId: string, mensagem?: string): Promise<{ error: string | null }> {
  const { ok, json } = await api(`/propostas/${propostaId}/enviar-email`, { mensagem });
  return { error: ok ? null : (json.error || "Falha ao enviar e-mail") };
}

export async function enviarPropostaWhatsapp(propostaId: string, mensagem?: string): Promise<{ error: string | null }> {
  const { ok, json } = await api(`/propostas/${propostaId}/enviar-whatsapp`, { mensagem });
  return { error: ok ? null : (json.error || "Falha ao enviar WhatsApp") };
}

export async function enviarPropostaParaAssinatura(propostaId: string): Promise<{ link: string; whatsapp_enviado: boolean; error: string | null }> {
  const { ok, json } = await api(`/propostas/${propostaId}/enviar-assinatura`, {});
  if (!ok) return { link: "", whatsapp_enviado: false, error: json.error || "Falha ao gerar link" };
  return { link: json.link, whatsapp_enviado: json.whatsapp_enviado, error: null };
}
export async function getExtrato(filters: { start?: string; end?: string; cliente_id?: string; vendedor_id?: string; status_pagamento?: string }): Promise<{ data: any[]; resumo: any | null; error: string | null }> {
  const { ok, json } = await api("/reports/extrato", filters);
  if (!ok) return { data: [], resumo: null, error: json.error || "Falha ao gerar relatório" };
  return { data: json.data || [], resumo: json.resumo || null, error: null };
}

export async function getMessageTemplates(): Promise<any[]> {
  const { ok, json } = await api("/message-templates");
  return ok ? json : [];
}

export async function createMessageTemplate(data: { nome: string; evento: string; corpo: string; ativo_whatsapp: boolean; ativo_email: boolean }) {
  return api("/message-templates", data);
}

export async function updateMessageTemplate(id: string, data: { nome: string; evento: string; corpo: string; ativo_whatsapp: boolean; ativo_email: boolean }) {
  return api(`/message-templates/${id}`, data, { method: "PUT" });
}

export async function deleteMessageTemplate(id: string) {
  return api(`/message-templates/${id}`, undefined, { method: "DELETE" });
}

// ASAAS
export async function getAsaasSettings() {
  return api("/asaas/settings");
}
export async function saveAsaasSettings(data: { api_key: string; ambiente: string; ativo: boolean; webhook_token?: string }) {
  return api("/asaas/settings", data);
}
export async function testAsaasConnection(api_key: string, ambiente: string) {
  const { ok, json } = await api("/asaas/test", { api_key, ambiente });
  return { ok, ...json };
}
export async function criarCobrancaAsaas(parcelaId: string, billingType: "BOLETO" | "PIX") {
  const { ok, json } = await api(`/asaas/cobranca/${parcelaId}`, { billingType });
  if (!ok) return { success: false, error: json.error || "Erro ao criar cobrança" };
  return { success: true, ...json };
}
export async function consultarCobrancaAsaas(parcelaId: string) {
  const { ok, json } = await api(`/asaas/cobranca/${parcelaId}`, undefined, { method: "GET" });
  if (!ok) return { success: false, error: json.error };
  return { success: true, ...json };
}
export async function enviarCobrancaAsaas(parcelaId: string, channel: "whatsapp" | "email", mensagem?: string) {
  const { ok, json } = await api(`/asaas/cobranca/${parcelaId}/enviar`, { channel, mensagem });
  if (!ok) return { success: false, error: json.error || "Erro ao enviar cobrança" };
  return { success: true, ...json };
}

export async function enviarMensagem(payload: {
  template_id: string;
  destinatarios: { tipo: string; id: string; nome: string; telefone?: string; email?: string }[];
  canal: "whatsapp" | "email";
}): Promise<{ resultados: { id: string; nome: string; ok: boolean; erro?: string }[]; error: string | null }> {
  const { ok, json } = await api("/notify/enviar-mensagem", payload);
  if (!ok) return { resultados: [], error: json.error || "Falha ao enviar mensagens" };
  return { resultados: json.resultados || [], error: null };
}

export function getApiUrl() {
  return API_URL;
}

export async function agendarEnvio(payload: { data_agendamento: string; canal: string; referencia_tipo: string; payload: any }) {
  return api('/notify/agendar', payload);
}

export async function getAgendamentos() {
  const { ok, json } = await api('/notify/agendamentos');
  return ok ? json : [];
}

export async function cancelarAgendamento(id: string) {
  return api('/notify/agendamentos/' + id, undefined, { method: 'DELETE' });
}

