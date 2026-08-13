import { useEffect, useRef, useState } from "react";
import { supabase, uploadLogo, notify, getMessageTemplates, createMessageTemplate, updateMessageTemplate, deleteMessageTemplate, getAsaasSettings, saveAsaasSettings, testAsaasConnection } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { maskCEP, maskCNPJ, maskCPF } from "@/lib/masks";
import { Eraser, Plus, Pencil, Trash2, MessageSquare, Mail, CreditCard, Copy, Building2, CheckCircle2, Star } from "lucide-react";

type Company = {
  id: string;
  name: string;
  cnpj?: string;
  cep?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  email?: string;
  telefone?: string;
  nome_responsavel?: string;
  cargo_responsavel?: string;
  cpf_responsavel?: string;
  logo_url?: string;
  assinatura_imagem?: string;
  public_url?: string;
  is_default?: boolean;
};

const Configuracoes = () => {
  // Multi-Company
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isDefault, setIsDefault] = useState(false);

  // Form Company
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyTelefone, setCompanyTelefone] = useState("");
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [cargoResponsavel, setCargoResponsavel] = useState("");
  const [cpfResponsavel, setCpfResponsavel] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [assinaturaEmpresa, setAssinaturaEmpresa] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  // Canvas assinatura empresa
  const canvasEmpresaRef = useRef<HTMLCanvasElement>(null);
  const [desenhando, setDesenhando] = useState(false);
  const [temAssinaturaEmpresa, setTemAssinaturaEmpresa] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasEmpresaRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    setDesenhando(true);
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!desenhando) return;
    const canvas = canvasEmpresaRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke(); setTemAssinaturaEmpresa(true);
  };
  const stopDraw = () => setDesenhando(false);
  const limparAssinaturaEmpresa = () => {
    const canvas = canvasEmpresaRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setAssinaturaEmpresa(""); setTemAssinaturaEmpresa(false);
  };
  const capturarAssinatura = () => {
    const canvas = canvasEmpresaRef.current; if (!canvas) return;
    const img = canvas.toDataURL("image/png");
    setAssinaturaEmpresa(img); setTemAssinaturaEmpresa(true);
  };

  // Evolution
  const [instanceUrl, setInstanceUrl] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [evolutionId, setEvolutionId] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");

  // Templates
  const [templateNovaVenda, setTemplateNovaVenda] = useState("");
  const [templatePagamento, setTemplatePagamento] = useState("");

  // Message templates CRUD
  type MsgTemplate = { id: string; nome: string; evento: string; corpo: string; ativo_whatsapp: boolean; ativo_email: boolean };
  const [msgTemplates, setMsgTemplates] = useState<MsgTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<MsgTemplate | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const emptyTemplate = (): MsgTemplate => ({ id: "", nome: "", evento: "pagamento", corpo: "", ativo_whatsapp: true, ativo_email: false });
  const [templateForm, setTemplateForm] = useState<MsgTemplate>(emptyTemplate());

  const loadMsgTemplates = async () => {
    const data = await getMessageTemplates();
    setMsgTemplates(data);
  };

  const saveTemplateForm = async () => {
    if (!templateForm.nome.trim() || !templateForm.corpo.trim()) {
      return toast({ title: "Preencha o nome e a mensagem", variant: "destructive" });
    }
    const { id, ...rest } = templateForm;
    if (editingTemplate) {
      await updateMessageTemplate(id, rest);
      toast({ title: "Template atualizado!" });
    } else {
      await createMessageTemplate(rest);
      toast({ title: "Template criado!" });
    }
    setShowTemplateForm(false);
    setEditingTemplate(null);
    setTemplateForm(emptyTemplate());
    loadMsgTemplates();
  };

  const deleteTemplateRow = async (id: string) => {
    if (!window.confirm("Excluir este template?")) return;
    await deleteMessageTemplate(id);
    toast({ title: "Template excluído" });
    loadMsgTemplates();
  };

  // ASAAS
  const [asaasApiKey, setAsaasApiKey] = useState("");
  const [asaasAmbiente, setAsaasAmbiente] = useState("sandbox");
  const [asaasAtivo, setAsaasAtivo] = useState(false);
  const [asaasWebhookToken, setAsaasWebhookToken] = useState("");
  const [testingAsaas, setTestingAsaas] = useState(false);

  // SMTP
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [smtpUseTls, setSmtpUseTls] = useState(true);
  const [smtpTemplateNovaVenda, setSmtpTemplateNovaVenda] = useState("");
  const [smtpTemplatePagamento, setSmtpTemplatePagamento] = useState("");
  const [smtpId, setSmtpId] = useState<string | null>(null);
  const [testingSmtp, setTestingSmtp] = useState(false);

  useEffect(() => {
    loadCompanies();
    loadEvolution();
    loadSmtp();
    loadAsaas();
    loadMsgTemplates();
  }, []);

  const loadCompanies = async () => {
    const { data } = await supabase.from("company_settings").select("*").order("created_at", { ascending: true });
    setCompanies((data as any) || []);
  };

  const openNewCompanyModal = () => {
    setEditingCompany(null);
    setCompanyId(null);
    setCompanyName("");
    setCnpj("");
    setCep("");
    setEndereco("");
    setBairro("");
    setCidade("");
    setCompanyEmail("");
    setCompanyTelefone("");
    setNomeResponsavel("");
    setCargoResponsavel("");
    setCpfResponsavel("");
    setLogoFile(null);
    setLogoUrl("");
    setAssinaturaEmpresa("");
    setPublicUrl("");
    setIsDefault(companies.length === 0);
    setTemAssinaturaEmpresa(false);
    limparAssinaturaEmpresa();
    setCompanyDialogOpen(true);
  };

  const openEditCompanyModal = (comp: Company) => {
    setEditingCompany(comp);
    setCompanyId(comp.id);
    setCompanyName(comp.name || "");
    setCnpj(comp.cnpj || "");
    setCep(comp.cep || "");
    setEndereco(comp.endereco || "");
    setBairro(comp.bairro || "");
    setCidade(comp.cidade || "");
    setCompanyEmail(comp.email || "");
    setCompanyTelefone(comp.telefone || "");
    setNomeResponsavel(comp.nome_responsavel || "");
    setCargoResponsavel(comp.cargo_responsavel || "");
    setCpfResponsavel(comp.cpf_responsavel || "");
    setLogoFile(null);
    setLogoUrl(comp.logo_url || "");
    setAssinaturaEmpresa(comp.assinatura_imagem || "");
    setPublicUrl(comp.public_url || "");
    setIsDefault(!!comp.is_default);
    setTemAssinaturaEmpresa(!!comp.assinatura_imagem);
    setCompanyDialogOpen(true);
  };

  const deleteCompany = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir esta empresa?")) return;
    const { error } = await supabase.from("company_settings").delete().eq("id", id);
    if (error) return toast({ title: "Erro ao excluir empresa", description: error.message, variant: "destructive" });
    toast({ title: "Empresa excluída com sucesso!" });
    loadCompanies();
  };

  const setDefaultCompany = async (id: string) => {
    await supabase.from("company_settings").update({ is_default: false }).neq("id", id);
    await supabase.from("company_settings").update({ is_default: true }).eq("id", id);
    toast({ title: "Empresa definida como padrão!" });
    loadCompanies();
    window.dispatchEvent(new Event("company_updated"));
  };

  const loadEvolution = async () => {
    const { data } = await supabase.from("evolution_settings").select("*").limit(1).maybeSingle();
    if (data) {
      setEvolutionId(data.id);
      setInstanceUrl(data.instance_url || "");
      setInstanceName((data as any).instance_name || "");
      setApiKey(data.api_key || "");
      setTemplateNovaVenda(data.template_nova_venda || "");
      setTemplatePagamento(data.template_pagamento || "");
    }
  };

  const loadAsaas = async () => {
    const { ok, json } = await getAsaasSettings();
    if (ok && json) {
      setAsaasApiKey(json.api_key || "");
      setAsaasAmbiente(json.ambiente || "sandbox");
      setAsaasAtivo(!!json.ativo);
      setAsaasWebhookToken(json.webhook_token || "");
    }
  };

  const saveAsaas = async () => {
    const { ok, json } = await saveAsaasSettings({
      api_key: asaasApiKey.trim(),
      ambiente: asaasAmbiente,
      ativo: asaasAtivo,
      webhook_token: asaasWebhookToken.trim(),
    });
    if (!ok) return toast({ title: "Erro ao salvar ASAAS", description: json?.error, variant: "destructive" });
    toast({ title: "Configurações ASAAS salvas!" });
  };

  const testAsaas = async () => {
    if (!asaasApiKey.trim()) {
      return toast({ title: "Informe a API Key antes de testar", variant: "destructive" });
    }
    setTestingAsaas(true);
    try {
      const result = await testAsaasConnection(asaasApiKey.trim(), asaasAmbiente);
      if (result.ok && result.success) {
        toast({ title: `✅ Conectado à conta: ${result.nome || "ASAAS"}` });
      } else {
        toast({ title: "❌ Falha na conexão", description: result.error || "Verifique a API Key e o ambiente", variant: "destructive" });
      }
    } catch {
      toast({ title: "❌ Erro ao testar ASAAS", variant: "destructive" });
    } finally {
      setTestingAsaas(false);
    }
  };

  const webhookUrl = (publicUrl.trim().replace(/\/$/, "") || window.location.origin) + "/asaas/webhook";

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "URL do webhook copiada!" });
  };

  const loadSmtp = async () => {
    const { data } = await supabase.from("smtp_settings").select("*").limit(1).maybeSingle();
    if (data) {
      setSmtpId(data.id);
      setSmtpHost((data as any).host || "");
      setSmtpPort((data as any).port || 587);
      setSmtpUsername((data as any).username || "");
      setSmtpPassword((data as any).password || "");
      setSmtpFromEmail((data as any).from_email || "");
      setSmtpFromName((data as any).from_name || "");
      setSmtpUseTls((data as any).use_tls !== false);
      setSmtpTemplateNovaVenda((data as any).template_nova_venda || "");
      setSmtpTemplatePagamento((data as any).template_pagamento || "");
    }
  };

  const saveSmtp = async () => {
    if (!smtpHost.trim() || !smtpUsername.trim() || !smtpPassword.trim() || !smtpFromEmail.trim()) {
      return toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
    }

    const payload = {
      host: smtpHost,
      port: smtpPort,
      username: smtpUsername,
      password: smtpPassword,
      from_email: smtpFromEmail,
      from_name: smtpFromName,
      use_tls: smtpUseTls,
      template_nova_venda: smtpTemplateNovaVenda,
      template_pagamento: smtpTemplatePagamento,
    } as any;

    if (smtpId) {
      await supabase.from("smtp_settings").update(payload).eq("id", smtpId);
    } else {
      const { data } = await supabase.from("smtp_settings").insert(payload).select().single();
      if (data) setSmtpId(data.id);
    }
    toast({ title: "Configurações SMTP salvas!" });
  };

  const testSmtp = async () => {
    if (!smtpHost.trim() || !smtpFromEmail.trim()) {
      return toast({ title: "Salve as configurações SMTP primeiro", variant: "destructive" });
    }
    setTestingSmtp(true);
    try {
      const { ok, json } = await notify("email", { test: true, test_email: smtpFromEmail });
      if (ok && json.success) {
        toast({ title: "✅ Email de teste enviado com sucesso!" });
      } else {
        toast({ title: "❌ Falha no envio", description: json.error || "Verifique as configurações", variant: "destructive" });
      }
    } catch {
      toast({ title: "❌ Erro ao testar SMTP", variant: "destructive" });
    } finally {
      setTestingSmtp(false);
    }
  };

  const saveCompany = async () => {
    if (!companyName.trim()) {
      return toast({ title: "O Nome da Empresa é obrigatório", variant: "destructive" });
    }

    setSavingCompany(true);
    try {
      let uploadedUrl = logoUrl;
      if (logoFile) {
        const { url, error: uploadError } = await uploadLogo(logoFile);
        if (uploadError || !url) {
          setSavingCompany(false);
          return toast({ title: "Erro no upload da logomarca", description: uploadError || "Falha ao enviar arquivo", variant: "destructive" });
        }
        uploadedUrl = url;
      }

      if (isDefault) {
        await supabase.from("company_settings").update({ is_default: false }).neq("id", "00000000-0000-0000-0000-000000000000");
      }

      const payload = {
        name: companyName.trim(),
        cnpj: cnpj.trim(),
        cep: cep.trim(),
        endereco: endereco.trim(),
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        email: companyEmail.trim(),
        telefone: companyTelefone.trim(),
        nome_responsavel: nomeResponsavel.trim(),
        cargo_responsavel: cargoResponsavel.trim(),
        cpf_responsavel: cpfResponsavel.trim(),
        logo_url: uploadedUrl,
        assinatura_imagem: assinaturaEmpresa || null,
        public_url: publicUrl.trim() || null,
        is_default: isDefault,
      };

      if (editingCompany) {
        const { error } = await supabase.from("company_settings").update(payload).eq("id", editingCompany.id);
        if (error) throw error;
        toast({ title: "Empresa atualizada!" });
      } else {
        const { error } = await supabase.from("company_settings").insert(payload);
        if (error) throw error;
        toast({ title: "Empresa cadastrada com sucesso!" });
      }

      setCompanyDialogOpen(false);
      loadCompanies();
      window.dispatchEvent(new Event("company_updated"));
    } catch (e: any) {
      toast({ title: "Erro ao salvar empresa", description: e.message || "Falha naoperação", variant: "destructive" });
    } finally {
      setSavingCompany(false);
    }
  };

  const saveEvolution = async () => {
    if (!instanceUrl.trim()) {
      return toast({ title: "URL da Instância é obrigatória", variant: "destructive" });
    }
    if (!instanceName.trim()) {
      return toast({ title: "Nome da Instância é obrigatório", variant: "destructive" });
    }
    if (!apiKey.trim()) {
      return toast({ title: "API Key é obrigatória", variant: "destructive" });
    }

    const payload = { instance_url: instanceUrl, instance_name: instanceName, api_key: apiKey } as any;

    if (evolutionId) {
      await supabase.from("evolution_settings").update(payload).eq("id", evolutionId);
    } else {
      const { data } = await supabase.from("evolution_settings").insert(payload).select().single();
      if (data) setEvolutionId(data.id);
    }
    setConnectionStatus("idle");
    toast({ title: "Configurações da Evolution API salvas!" });
  };

  const testConnection = async () => {
    if (!instanceUrl.trim() || !apiKey.trim() || !instanceName.trim()) {
      return toast({ title: "Preencha todos os campos antes de testar", variant: "destructive" });
    }
    setTestingConnection(true);
    setConnectionStatus("idle");
    try {
      const url = instanceUrl.replace(/\/$/, "");
      const res = await fetch(`${url}/instance/connectionState/${instanceName}`, {
        headers: { apikey: apiKey },
      });
      const result = await res.json();
      if (res.ok && result?.instance?.state === "open") {
        setConnectionStatus("success");
        toast({ title: "✅ Conexão estabelecida com sucesso!" });
      } else {
        setConnectionStatus("error");
        toast({ title: "❌ Falha na conexão", description: result?.message || "Instância não conectada", variant: "destructive" });
      }
    } catch (err) {
      setConnectionStatus("error");
      toast({ title: "❌ Erro ao conectar", description: "Verifique a URL e tente novamente", variant: "destructive" });
    } finally {
      setTestingConnection(false);
    }
  };

  const saveTemplates = async () => {
    const payload = { template_nova_venda: templateNovaVenda, template_pagamento: templatePagamento };

    if (evolutionId) {
      await supabase.from("evolution_settings").update(payload).eq("id", evolutionId);
    } else {
      const { data } = await supabase.from("evolution_settings").insert({ ...payload, instance_url: "", api_key: "" }).select().single();
      if (data) setEvolutionId(data.id);
    }
    toast({ title: "Templates de mensagem salvos!" });
  };

  const variablesHelp = (
    <p className="text-xs text-muted-foreground">
      Variáveis disponíveis: <code>{"{{vendedor}}"}</code>, <code>{"{{valor}}"}</code>, <code>{"{{percentual}}"}</code>, <code>{"{{cliente}}"}</code>, <code>{"{{valor_servico}}"}</code>, <code>{"{{mes_referencia}}"}</code>
    </p>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Configurações</h2>
      <Tabs defaultValue="empresa">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="smtp">Email (SMTP)</TabsTrigger>
          <TabsTrigger value="whatsapp">Evolution API</TabsTrigger>
          <TabsTrigger value="asaas">ASAAS</TabsTrigger>
          <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" /> Empresas Cadastradas
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerencie as empresas emissoras de contratos e propostas comerciais.
                </p>
              </div>
              <Button onClick={openNewCompanyModal}>
                <Plus className="h-4 w-4 mr-2" /> Nova Empresa
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((comp) => (
                      <TableRow key={comp.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {comp.logo_url ? (
                              <img src={comp.logo_url} alt="Logo" className="h-10 w-10 rounded object-contain border bg-white" />
                            ) : (
                              <div className="h-10 w-10 rounded bg-slate-100 border flex items-center justify-center text-slate-600 font-bold text-sm">
                                {comp.name ? comp.name.substring(0, 2).toUpperCase() : "EM"}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-900">{comp.name || "Sem Nome"}</div>
                              {comp.nome_responsavel && (
                                <div className="text-xs text-muted-foreground">Resp: {comp.nome_responsavel}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{comp.cnpj || "-"}</TableCell>
                        <TableCell className="text-xs">{comp.cidade || "-"}</TableCell>
                        <TableCell className="text-xs space-y-0.5">
                          {comp.email && <div>{comp.email}</div>}
                          {comp.telefone && <div className="text-muted-foreground">{comp.telefone}</div>}
                          {!comp.email && !comp.telefone && "-"}
                        </TableCell>
                        <TableCell>
                          {comp.is_default ? (
                            <Badge className="bg-emerald-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" /> Padrão</Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500">Secundária</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!comp.is_default && (
                              <Button variant="ghost" size="sm" onClick={() => setDefaultCompany(comp.id)} title="Definir como Padrão" className="text-amber-600 hover:text-amber-700">
                                <Star className="h-4 w-4 mr-1 fill-amber-400 text-amber-500" /> Padrão
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => openEditCompanyModal(comp)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteCompany(comp.id)} className="text-destructive hover:text-destructive" title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {companies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhuma empresa cadastrada. Clique no botão "Nova Empresa" acima.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Modal de Cadastro / Edição de Empresa */}
          <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCompany ? "Editar Empresa" : "Cadastrar Nova Empresa"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Checkbox id="isDefault" checked={isDefault} onCheckedChange={(c) => setIsDefault(!!c)} />
                  <Label htmlFor="isDefault" className="font-semibold cursor-pointer">
                    Definir esta empresa como Empresa Padrão do sistema
                  </Label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Empresa <span className="text-destructive">*</span></Label>
                    <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex.: Minha Empresa Ltda" />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={cnpj} onChange={(e) => setCnpj(maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
                  </div>
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input value={cep} onChange={(e) => setCep(maskCEP(e.target.value))} placeholder="00000-000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Endereço</Label>
                    <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número e complemento" />
                  </div>
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email da Empresa</Label>
                    <Input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="contato@suaempresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone da Empresa</Label>
                    <Input value={companyTelefone} onChange={(e) => setCompanyTelefone(e.target.value)} placeholder="(11) 99999-9999" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome do Responsável</Label>
                    <Input value={nomeResponsavel} onChange={(e) => setNomeResponsavel(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo do Responsável</Label>
                    <Input value={cargoResponsavel} onChange={(e) => setCargoResponsavel(e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>CPF do Responsável</Label>
                    <Input value={cpfResponsavel} onChange={(e) => setCpfResponsavel(maskCPF(e.target.value))} placeholder="000.000.000-00" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Logomarca</Label>
                  {logoUrl && <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded object-contain border bg-white p-1" />}
                  <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                </div>

                <div className="space-y-2">
                  <Label>URL Pública do Sistema</Label>
                  <p className="text-xs text-muted-foreground">Endereço acessível externamente — usado no link de assinatura enviado ao cliente.</p>
                  <Input value={publicUrl} onChange={(e) => setPublicUrl(e.target.value)} placeholder="https://meudominio.com.br" />
                </div>

                <div className="space-y-2">
                  <Label>Assinatura Digital da Empresa</Label>
                  <p className="text-xs text-muted-foreground">Usada automaticamente no rodapé dos contratos assinados.</p>
                  {assinaturaEmpresa && !temAssinaturaEmpresa && (
                    <div className="space-y-1">
                      <img src={assinaturaEmpresa} alt="Assinatura atual" className="max-h-16 border rounded bg-white p-2" />
                      <p className="text-xs text-muted-foreground">Assinatura atual — desenhe abaixo para substituir.</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Desenhe a assinatura no campo abaixo</span>
                    <Button variant="ghost" size="sm" onClick={limparAssinaturaEmpresa} className="text-xs">
                      <Eraser className="h-3 w-3 mr-1" /> Limpar
                    </Button>
                  </div>
                  <div className="rounded-md border bg-slate-50 overflow-hidden max-w-2xl" style={{ touchAction: "none" }}>
                    <canvas
                      ref={canvasEmpresaRef}
                      width={680}
                      height={160}
                      className="w-full cursor-crosshair"
                      style={{ display: "block" }}
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={(e) => { stopDraw(); if (temAssinaturaEmpresa) capturarAssinatura(); }}
                      onMouseLeave={(e) => { stopDraw(); if (temAssinaturaEmpresa) capturarAssinatura(); }}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={(e) => { stopDraw(); capturarAssinatura(); }}
                    />
                  </div>
                  {!temAssinaturaEmpresa && !assinaturaEmpresa && (
                    <p className="text-xs text-muted-foreground text-center">Clique e arraste para assinar</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCompanyDialogOpen(false)}>Cancelar</Button>
                <Button onClick={saveCompany} disabled={savingCompany}>
                  {savingCompany ? "Salvando..." : "Salvar Empresa"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="smtp">
          <Card>
            <CardHeader><CardTitle>Configurações de Email (SMTP)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Servidor SMTP <span className="text-destructive">*</span></Label>
                  <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
                </div>
                <div className="space-y-2">
                  <Label>Porta</Label>
                  <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)} />
                </div>
                <div className="space-y-2">
                  <Label>Usuário (Email) <span className="text-destructive">*</span></Label>
                  <Input value={smtpUsername} onChange={(e) => setSmtpUsername(e.target.value)} placeholder="seu@email.com" />
                </div>
                <div className="space-y-2">
                  <Label>Senha <span className="text-destructive">*</span></Label>
                  <Input type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} placeholder="Senha ou App Password" />
                </div>
                <div className="space-y-2">
                  <Label>Email Remetente <span className="text-destructive">*</span></Label>
                  <Input value={smtpFromEmail} onChange={(e) => setSmtpFromEmail(e.target.value)} placeholder="noreply@suaempresa.com" />
                </div>
                <div className="space-y-2">
                  <Label>Nome do Remetente</Label>
                  <Input value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} placeholder="Minha Empresa" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={smtpUseTls} onCheckedChange={setSmtpUseTls} />
                <Label>Usar TLS/SSL</Label>
              </div>

              <div className="space-y-4 border-t pt-4">
                <Label className="text-base font-semibold">Templates de Email</Label>
                {variablesHelp}
                <div className="space-y-2">
                  <Label>📩 Nova Venda</Label>
                  <Textarea value={smtpTemplateNovaVenda} onChange={(e) => setSmtpTemplateNovaVenda(e.target.value)} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>💰 Comissão Paga</Label>
                  <Textarea value={smtpTemplatePagamento} onChange={(e) => setSmtpTemplatePagamento(e.target.value)} rows={3} />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={saveSmtp}>Salvar</Button>
                <Button variant="outline" onClick={testSmtp} disabled={testingSmtp}>
                  {testingSmtp ? "Enviando..." : "📧 Testar Envio"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Evolution API - Conexão
                {connectionStatus === "success" && <span className="text-sm font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded-full">🟢 Conectado</span>}
                {connectionStatus === "error" && <span className="text-sm font-normal text-red-600 bg-red-50 px-2 py-0.5 rounded-full">🔴 Desconectado</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL da Instância <span className="text-destructive">*</span></Label>
                <Input value={instanceUrl} onChange={(e) => setInstanceUrl(e.target.value)} placeholder="https://sua-instancia.evolution-api.com" />
                <p className="text-xs text-muted-foreground">URL base da sua instância Evolution API (sem barra no final)</p>
              </div>
              <div className="space-y-2">
                <Label>Nome da Instância <span className="text-destructive">*</span></Label>
                <Input value={instanceName} onChange={(e) => setInstanceName(e.target.value)} placeholder="default" />
                <p className="text-xs text-muted-foreground">Nome da instância configurada na Evolution API</p>
              </div>
              <div className="space-y-2">
                <Label>API Key (Global Key) <span className="text-destructive">*</span></Label>
                <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Sua chave de API" />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveEvolution}>Salvar</Button>
                <Button variant="outline" onClick={testConnection} disabled={testingConnection}>
                  {testingConnection ? "Testando..." : "🔌 Testar Conexão"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="asaas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Integração ASAAS
              </CardTitle>
              <p className="text-sm text-muted-foreground">Configure a emissão de boleto e PIX para parcelas em aberto.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label>API Key <span className="text-destructive">*</span></Label>
                  <Input
                    type="password"
                    value={asaasApiKey}
                    onChange={(e) => setAsaasApiKey(e.target.value)}
                    placeholder="$aact_..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ambiente</Label>
                  <Select value={asaasAmbiente} onValueChange={setAsaasAmbiente}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox (Testes)</SelectItem>
                      <SelectItem value="production">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-7">
                  <Switch checked={asaasAtivo} onCheckedChange={setAsaasAtivo} />
                  <Label>Integração ativa</Label>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Token do Webhook</Label>
                  <Input
                    type="password"
                    value={asaasWebhookToken}
                    onChange={(e) => setAsaasWebhookToken(e.target.value)}
                    placeholder="Token definido no painel ASAAS"
                  />
                  <p className="text-xs text-muted-foreground">Use o mesmo token no campo de autenticação do webhook no painel ASAAS.</p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>URL do Webhook</Label>
                  <div className="flex gap-2">
                    <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={copyWebhookUrl} title="Copiar URL">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Cadastre esta URL no painel ASAAS para receber confirmações de pagamento.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveAsaas}>Salvar</Button>
                <Button variant="outline" onClick={testAsaas} disabled={testingAsaas}>
                  {testingAsaas ? "Testando..." : "Testar Conexão"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mensagens">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Templates de Mensagem</CardTitle>
                  <Button size="sm" onClick={() => { setEditingTemplate(null); setTemplateForm(emptyTemplate()); setShowTemplateForm(true); }}>
                    <Plus className="h-4 w-4 mr-1" /> Novo Template
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Cada template pode ser ativado individualmente para WhatsApp e/ou Email.</p>
                {variablesHelp}
              </CardHeader>

              {showTemplateForm && (
                <CardContent className="border-t bg-muted/30 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome do Template <span className="text-destructive">*</span></Label>
                      <Input
                        value={templateForm.nome}
                        onChange={(e) => setTemplateForm((f) => ({ ...f, nome: e.target.value }))}
                        placeholder="Ex: Notificação de nova venda"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Evento</Label>
                      <Input
                        list="eventos-list"
                        value={templateForm.evento}
                        onChange={(e) => setTemplateForm((f) => ({ ...f, evento: e.target.value }))}
                        placeholder="Ex: nova_venda, contrato_assinado..."
                      />
                      <datalist id="eventos-list">
                        <option value="nova_venda" />
                        <option value="pagamento" />
                        <option value="recibo_pagamento" />
                        <option value="contrato_assinatura" />
                        <option value="proposta_assinatura" />
                        <option value="proposta_whatsapp" />
                        <option value="proposta_email" />
                        {[...new Set(msgTemplates.map((t) => t.evento))]
                          .filter((e) => !["nova_venda","pagamento","recibo_pagamento","contrato_assinatura","proposta_assinatura","proposta_whatsapp","proposta_email"].includes(e))
                          .map((e) => <option key={e} value={e} />)}
                      </datalist>
                      <p className="text-xs text-muted-foreground">Escolha um existente ou digite um evento personalizado.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem <span className="text-destructive">*</span></Label>
                    <Textarea
                      value={templateForm.corpo}
                      onChange={(e) => setTemplateForm((f) => ({ ...f, corpo: e.target.value }))}
                      rows={5}
                      placeholder="Olá {{vendedor}}, você tem uma nova venda de {{cliente}}..."
                    />
                    {variablesHelp}
                  </div>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={templateForm.ativo_whatsapp}
                        onCheckedChange={(v) => setTemplateForm((f) => ({ ...f, ativo_whatsapp: v }))}
                      />
                      <Label className="flex items-center gap-1"><MessageSquare className="h-4 w-4" /> WhatsApp</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={templateForm.ativo_email}
                        onCheckedChange={(v) => setTemplateForm((f) => ({ ...f, ativo_email: v }))}
                      />
                      <Label className="flex items-center gap-1"><Mail className="h-4 w-4" /> Email</Label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveTemplateForm}>{editingTemplate ? "Atualizar" : "Salvar"}</Button>
                    <Button variant="outline" onClick={() => { setShowTemplateForm(false); setEditingTemplate(null); setTemplateForm(emptyTemplate()); }}>
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              )}

              <CardContent className={showTemplateForm ? "border-t pt-4" : ""}>
                {msgTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum template cadastrado. Clique em "Novo Template" para criar.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {msgTemplates.map((t) => (
                      <div key={t.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-card">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{t.nome}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.evento === "nova_venda" ? "bg-blue-100 text-blue-700" : t.evento === "pagamento" ? "bg-green-100 text-green-700" : t.evento === "proposta" ? "bg-violet-100 text-violet-700" : t.evento === "recibo" ? "bg-cyan-100 text-cyan-700" : "bg-orange-100 text-orange-700"}`}>
                              {t.evento === "nova_venda" ? "Nova Venda" : t.evento === "pagamento" ? "Comissão Paga" : t.evento === "proposta" ? "Proposta" : t.evento === "recibo" ? "Recibo" : t.evento}
                            </span>
                            {t.ativo_whatsapp && (
                              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                                <MessageSquare className="h-3 w-3" /> WhatsApp
                              </span>
                            )}
                            {t.ativo_email && (
                              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                                <Mail className="h-3 w-3" /> Email
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.corpo}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="icon" variant="ghost" className="h-8 w-8"
                            onClick={() => { setEditingTemplate(t); setTemplateForm(t); setShowTemplateForm(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteTemplateRow(t.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Templates Padrão (Fallback)</CardTitle>
                <p className="text-xs text-muted-foreground">Usados apenas quando nenhum template personalizado estiver ativo para o evento.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><MessageSquare className="h-4 w-4" /> WhatsApp — Nova Venda</Label>
                  <Textarea value={templateNovaVenda} onChange={(e) => setTemplateNovaVenda(e.target.value)} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><MessageSquare className="h-4 w-4" /> WhatsApp — Comissão Paga</Label>
                  <Textarea value={templatePagamento} onChange={(e) => setTemplatePagamento(e.target.value)} rows={3} />
                </div>
                {variablesHelp}
                <Button variant="outline" onClick={saveTemplates}>Salvar Padrões</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Configuracoes;
