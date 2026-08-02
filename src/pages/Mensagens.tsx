import { useEffect, useState } from "react";
import { supabase, getMessageTemplates, enviarMensagem } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Send, Users, UserCheck, MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Destinatario = {
  tipo: "cliente" | "vendedor";
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
};

type ResultadoEnvio = {
  id: string;
  nome: string;
  ok: boolean;
  erro?: string;
};

const Mensagens = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [canal, setCanal] = useState<"whatsapp" | "email">("whatsapp");
  const [tipoDestinatario, setTipoDestinatario] = useState<"clientes" | "vendedores">("clientes");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoEnvio[]>([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const [tmpl, resClientes, resVendedores] = await Promise.all([
      getMessageTemplates(),
      supabase.from("clientes").select("id, nome, telefone, email").order("nome"),
      supabase.from("vendedores").select("id, nome, whatsapp, email").order("nome"),
    ]);
    setTemplates(tmpl);
    setClientes(resClientes.data || []);
    setVendedores(resVendedores.data || []);
  };

  const listaAtual: Destinatario[] =
    tipoDestinatario === "clientes"
      ? clientes.map((c) => ({ tipo: "cliente", id: c.id, nome: c.nome, telefone: c.telefone, email: c.email }))
      : vendedores.map((v) => ({ tipo: "vendedor", id: v.id, nome: v.nome, telefone: v.whatsapp, email: v.email }));

  const toggleSelecionado = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (selecionados.size === listaAtual.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(listaAtual.map((d) => d.id)));
    }
  };

  const templateSelecionado = templates.find((t) => t.id === templateId);

  const handleEnviar = async () => {
    if (!templateId) return toast({ title: "Selecione uma mensagem", variant: "destructive" });
    if (selecionados.size === 0) return toast({ title: "Selecione ao menos um destinatário", variant: "destructive" });

    const destinatarios = listaAtual.filter((d) => selecionados.has(d.id));
    setEnviando(true);
    setResultados([]);

    const { resultados: res, error } = await enviarMensagem({ template_id: templateId, destinatarios, canal });
    setEnviando(false);

    if (error) return toast({ title: "Erro ao enviar", description: error, variant: "destructive" });

    setResultados(res);
    const ok = res.filter((r) => r.ok).length;
    const falha = res.filter((r) => !r.ok).length;
    toast({
      title: `Envio concluído: ${ok} enviado(s)${falha > 0 ? `, ${falha} falha(s)` : ""}`,
      variant: falha > 0 ? "destructive" : "default",
    });
  };

  const campoContato = canal === "whatsapp" ? "telefone" : "email";
  const semContato = listaAtual.filter((d) => selecionados.has(d.id) && !d[campoContato as keyof Destinatario]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-violet-600" />
          Envio de Mensagens
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Selecione uma mensagem e envie para clientes ou vendedores.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda: configuração */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-700">Configuração do Envio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template */}
              <div className="space-y-1.5">
                <Label>Mensagem</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma mensagem..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Canal */}
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Select value={canal} onValueChange={(v) => setCanal(v as "whatsapp" | "email")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preview do template */}
              {templateSelecionado && (
                <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  <p className="font-medium text-slate-500 mb-1 text-[10px] uppercase tracking-wide">Pré-visualização</p>
                  {templateSelecionado.corpo}
                </div>
              )}

              {/* Guia de variáveis */}
              <div className="rounded-md border bg-blue-50 border-blue-200 p-3 space-y-2">
                <p className="text-[10px] font-medium text-blue-700 uppercase tracking-wide">Variáveis disponíveis</p>
                <div className="space-y-1">
                  {tipoDestinatario === "clientes" ? (
                    <>
                      <VariavelTag v="nome" desc="Nome do cliente" />
                      <VariavelTag v="telefone" desc="Telefone" />
                      <VariavelTag v="email" desc="E-mail" />
                      <VariavelTag v="cpf_cnpj" desc="CPF/CNPJ" />
                      <VariavelTag v="endereco" desc="Endereço" />
                      <VariavelTag v="cidade" desc="Cidade" />
                      <VariavelTag v="nome_responsavel" desc="Responsável" />
                    </>
                  ) : (
                    <>
                      <VariavelTag v="nome" desc="Nome do vendedor" />
                      <VariavelTag v="telefone" desc="WhatsApp" />
                      <VariavelTag v="email" desc="E-mail" />
                      <VariavelTag v="cpf" desc="CPF" />
                      <VariavelTag v="comissao" desc="% Comissão padrão" />
                    </>
                  )}
                  <VariavelTag v="empresa_nome" desc="Nome da empresa" />
                  <VariavelTag v="empresa_telefone" desc="Tel. empresa" />
                </div>
              </div>

              {/* Aviso de destinatários sem contato */}
              {semContato.length > 0 && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
                  {semContato.length} destinatário(s) sem {canal === "whatsapp" ? "telefone" : "e-mail"} serão ignorados.
                </div>
              )}

              <Button className="w-full" onClick={handleEnviar} disabled={enviando || !templateId || selecionados.size === 0}>
                <Send className="h-4 w-4 mr-2" />
                {enviando ? "Enviando..." : `Enviar para ${selecionados.size} destinatário(s)`}
              </Button>
            </CardContent>
          </Card>

          {/* Resultados */}
          {resultados.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-700">Resultado do Envio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 max-h-60 overflow-y-auto">
                {resultados.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-xs py-1">
                    <span className="truncate text-slate-700">{r.nome}</span>
                    {r.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <span className="text-red-500 text-[10px] flex items-center gap-1">
                        <XCircle className="h-3 w-3" />{r.erro}
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna direita: destinatários */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-700">Destinatários</CardTitle>
                <Badge variant="outline">{selecionados.size} selecionado(s)</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={tipoDestinatario} onValueChange={(v) => { setTipoDestinatario(v as any); setSelecionados(new Set()); }}>
                <div className="px-4 pt-2 border-b">
                  <TabsList className="mb-0">
                    <TabsTrigger value="clientes" className="flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5" /> Clientes ({clientes.length})
                    </TabsTrigger>
                    <TabsTrigger value="vendedores" className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> Vendedores ({vendedores.length})
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="clientes" className="mt-0">
                  <DestinatarioTable
                    itens={listaAtual}
                    selecionados={selecionados}
                    canal={canal}
                    onToggle={toggleSelecionado}
                    onToggleTodos={toggleTodos}
                  />
                </TabsContent>
                <TabsContent value="vendedores" className="mt-0">
                  <DestinatarioTable
                    itens={listaAtual}
                    selecionados={selecionados}
                    canal={canal}
                    onToggle={toggleSelecionado}
                    onToggleTodos={toggleTodos}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

function VariavelTag({ v, desc }: { v: string; desc: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <code className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded font-mono">{`{{${v}}}`}</code>
      <span className="text-slate-500">{desc}</span>
    </div>
  );
}

function DestinatarioTable({
  itens,
  selecionados,
  canal,
  onToggle,
  onToggleTodos,
}: {
  itens: Destinatario[];
  selecionados: Set<string>;
  canal: "whatsapp" | "email";
  onToggle: (id: string) => void;
  onToggleTodos: () => void;
}) {
  const campoContato = canal === "whatsapp" ? "telefone" : "email";
  const todosSelecionados = itens.length > 0 && selecionados.size === itens.length;

  return (
    <div className="overflow-auto max-h-[500px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={todosSelecionados} onCheckedChange={onToggleTodos} />
            </TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>{canal === "whatsapp" ? "Telefone" : "E-mail"}</TableHead>
            <TableHead className="w-20">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((d) => {
            const contato = d[campoContato as keyof Destinatario] as string | undefined;
            return (
              <TableRow key={d.id} className={!contato ? "opacity-50" : ""}>
                <TableCell>
                  <Checkbox
                    checked={selecionados.has(d.id)}
                    onCheckedChange={() => onToggle(d.id)}
                    disabled={!contato}
                  />
                </TableCell>
                <TableCell className="font-medium text-sm">{d.nome}</TableCell>
                <TableCell className="text-sm text-slate-600">{contato || "-"}</TableCell>
                <TableCell>
                  {contato ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">OK</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-red-500 border-red-300">Sem {canal === "whatsapp" ? "tel." : "email"}</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {itens.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                Nenhum registro encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default Mensagens;
