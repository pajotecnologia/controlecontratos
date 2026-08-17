import { useEffect, useState } from "react";
import { supabase, uploadArquivo, enviarPropostaParaAssinatura, enviarPropostaEmail, enviarPropostaWhatsapp, getMessageTemplates, notifyVendedor, agendarEnvio } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Eye, Printer, FileText, X, Send, Copy, CheckCircle2, Clock, XCircle, Download, Mail, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { maskCurrency, unmaskCurrency, formatCurrency } from "@/lib/masks";
import { SearchableClientSelect } from "@/components/SearchableClientSelect";
import { DataTablePagination } from "@/components/DataTablePagination";

type PropostaItem = {
  id?: string;
  descricao: string;
  imagem_url: string;
  quantidade: number;
  valor_unitario: number;
  total: number;
  // auxiliares para exibição e controle
  valorDisplay?: string;
  isUploading?: boolean;
};

type Proposta = {
  id: string;
  data_proposta: string;
  cliente_id: string;
  tipo_proposta: string | null;
  titulo: string | null;
  desconto: number | null;
  total: number | null;
  company_id: string | null;
  modelo_proposta?: string | null;
  assinatura_status?: string;
  assinatura_token?: string;
  assinatura_link?: string;
  assinatura_nome?: string;
  assinatura_data?: string;
  assinatura_imagem?: string;
  observacoes?: string | null;
  clientes?: { nome: string; cpf_cnpj?: string; endereco?: string; telefone?: string; email?: string };
  company_settings?: any;
  proposta_itens?: PropostaItem[];
};

const Propostas = () => {
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Proposta | null>(null);

  // Campos do formulário
  const [clienteId, setClienteId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [modeloProposta, setModeloProposta] = useState("classico");
  const [dataProposta, setDataProposta] = useState(new Date().toISOString().split("T")[0]);
  const [tipoProposta, setTipoProposta] = useState("");
  const [titulo, setTitulo] = useState("PROPOSTA COMERCIAL");
  const [itens, setItens] = useState<PropostaItem[]>([]);
  const [descontoDisplay, setDescontoDisplay] = useState("");
  const [descontoNum, setDescontoNum] = useState(0);
  const [totalManualDisplay, setTotalManualDisplay] = useState("");
  const [totalManualNum, setTotalManualNum] = useState(0);
  const [observacoes, setObservacoes] = useState("");

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewProposta, setPreviewProposta] = useState<Proposta | null>(null);

  // Assinatura
  const [enviandoLink, setEnviandoLink] = useState<string | null>(null);
  const [linkGerado, setLinkGerado] = useState<Record<string, string>>({});
  const [enviandoEmail, setEnviandoEmail] = useState<string | null>(null);
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState<string | null>(null);
  const [vendedores, setVendedores] = useState<{ id: string; nome: string }[]>([]);
  const [vendedorId, setVendedorId] = useState("");
  const [enviandoVendedor, setEnviandoVendedor] = useState<string | null>(null);
  const [agendarEnvioAtivo, setAgendarEnvioAtivo] = useState(false);
  const [dataAgendamento, setDataAgendamento] = useState("");

  // Envio com escolha de mensagem (email/whatsapp)
  const [msgTemplates, setMsgTemplates] = useState<{ id: string; nome: string; evento: string; corpo: string; ativo_whatsapp: boolean; ativo_email: boolean }[]>([]);
  const [sendDialog, setSendDialog] = useState<{ proposta: Proposta; canal: "email" | "whatsapp" } | null>(null);
  const [sendTemplateId, setSendTemplateId] = useState("");
  const [sendMensagem, setSendMensagem] = useState("");
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);

  const defaultMensagem = (p: Proposta, canal: "email" | "whatsapp") => {
    const fmtMoeda = (v: number) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    if (canal === "email") {
      return `Segue em anexo a proposta comercial: ${p.titulo || "Proposta Comercial"} no valor de R$ ${fmtMoeda(Number(p.total || 0))}.`;
    }
    return `Olá ${p.clientes?.nome || "Cliente"}, segue sua proposta comercial:\n\n*${p.titulo || "PROPOSTA COMERCIAL"}*\n${p.tipo_proposta ? `Tipo: ${p.tipo_proposta}\n` : ""}Itens: ${p.proposta_itens?.length || 0}\n*Valor Total: R$ ${fmtMoeda(Number(p.total || 0))}*`;
  };

  const abrirEnvio = (p: Proposta, canal: "email" | "whatsapp") => {
    setSendDialog({ proposta: p, canal });
    
    // Procura o primeiro template ativo para este canal
    const activeTemplates = msgTemplates.filter((t) => (t.evento || "").toLowerCase().includes("proposta") && (canal === "email" ? t.ativo_email : t.ativo_whatsapp));
    if (activeTemplates.length > 0) {
      setSendTemplateId(activeTemplates[0].id);
      setSendMensagem(activeTemplates[0].corpo);
    } else {
      setSendTemplateId("");
      setSendMensagem(defaultMensagem(p, canal));
    }
  };

  const templatesDoCanal = (canal: "email" | "whatsapp") =>
    msgTemplates.filter((t) => (canal === "email" ? t.ativo_email : t.ativo_whatsapp));

  const handleConfirmarEnvio = async () => {
    if (!sendDialog) return;
    const { proposta: p, canal } = sendDialog;
    
    if (agendarEnvioAtivo) {
      if (!dataAgendamento) return toast({ title: "Informe a data e hora do agendamento", variant: "destructive" });
      setEnviandoMensagem(true);
      const dataIso = new Date(dataAgendamento).toISOString();
      const payloadPath = canal === "email" ? `/propostas/${p.id}/enviar-email` : `/propostas/${p.id}/enviar-whatsapp`;
      const payload = { mensagem: sendMensagem };
      const res = await agendarEnvio({ data_agendamento: dataIso, canal, referencia_tipo: "proposta_" + canal, payload: { path: payloadPath, body: payload } });
      setEnviandoMensagem(false);
      if (res?.error) return toast({ title: "Erro ao agendar", description: res.error, variant: "destructive" });
      toast({ title: "Proposta agendada com sucesso!" });
      setSendDialog(null);
      setAgendarEnvioAtivo(false);
      setDataAgendamento("");
      return;
    }

    setEnviandoMensagem(true);
    const { error } = canal === "email"
      ? await enviarPropostaEmail(p.id, sendMensagem)
      : await enviarPropostaWhatsapp(p.id, sendMensagem);
    setEnviandoMensagem(false);
    if (error) return toast({ title: canal === "email" ? "Erro ao enviar e-mail" : "Erro ao enviar WhatsApp", description: error, variant: "destructive" });
    toast({ title: canal === "email" ? "E-mail enviado!" : "WhatsApp enviado!", description: `Proposta enviada para ${p.clientes?.nome || ""}` });
    setSendDialog(null);
  };

  const handleEnviarAssinatura = async (p: Proposta) => {
    setEnviandoLink(p.id);
    const { link, whatsapp_enviado, error } = await enviarPropostaParaAssinatura(p.id);
    setEnviandoLink(null);
    if (error) return toast({ title: "Erro ao gerar link", description: error, variant: "destructive" });
    setLinkGerado(prev => ({ ...prev, [p.id]: link }));
    if (whatsapp_enviado) {
      toast({ title: "Link enviado por WhatsApp!", description: `Cliente: ${p.clientes?.nome || ""}` });
    } else {
      toast({ title: "Link gerado!", description: "WhatsApp não configurado. Copie o link abaixo." });
    }
    load();
  };

  const copiarLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Link copiado!" });
  };

  const handleDownloadProposta = async (p: Proposta) => {
    toast({ title: "Gerando PDF, aguarde..." });
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;background:#fff;padding:40px 50px;box-sizing:border-box;";
    container.innerHTML = buildPropostaHtml(p);
    document.body.appendChild(container);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      document.body.removeChild(container);
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      let remaining = imgH;
      let offset = 0;
      pdf.addImage(imgData, "JPEG", 0, offset, pageW, imgH);
      remaining -= pageH;
      while (remaining > 0) {
        offset -= pageH;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, offset, pageW, imgH);
        remaining -= pageH;
      }
      pdf.save(`proposta-${p.clientes?.nome || "cliente"}.pdf`);
    } catch {
      if (document.body.contains(container)) document.body.removeChild(container);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    }
  };

  const badgeAssinatura = (status?: string) => {
    if (!status || status === "pendente") return null;
    if (status === "enviado") return <Badge variant="outline" className="text-amber-700 border-amber-400 text-[10px]"><Clock className="h-3 w-3 mr-1" />Aguardando</Badge>;
    if (status === "assinado") return <Badge className="bg-emerald-600 text-white text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Assinada</Badge>;
    if (status === "recusado") return <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-1" />Ajuste solicitado</Badge>;
    return null;
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.ceil(propostas.length / pageSize);
  const paginatedPropostas = propostas.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    load();
    loadDependencies();
  }, []);

  const load = async () => {
    // Select propostas com join em clientes, company_settings e proposta_itens
    const { data } = await supabase
      .from("propostas")
      .select("*, clientes(nome, cpf_cnpj, endereco, telefone, email), company_settings(*), proposta_itens(*), assinatura_link")
      .order("created_at", { ascending: false });
    setPropostas(data || []);
  };

  const loadDependencies = async () => {
    const [resClientes, resCompanies, resVendedores] = await Promise.all([
      supabase.from("clientes").select("id, nome").order("nome"),
      supabase.from("company_settings").select("*").order("created_at", { ascending: true }),
      supabase.from("vendedores").select("id, nome").eq("ativo", true).order("nome"),
    ]);
    setClientes(resClientes.data || []);
    const comps = resCompanies.data || [];
    setCompanies(comps);
    const defComp = comps.find((c: any) => c.is_default) || comps[0];
    if (defComp) {
      setCompany(defComp);
      setCompanyId(defComp.id);
    }
    setVendedores(resVendedores.data || []);
    const { data: templates } = await getMessageTemplates();
    setMsgTemplates(templates || []);
  };

  const resetForm = () => {
    setEditing(null);
    setClienteId("");
    setVendedorId("");
    const defComp = companies.find((c: any) => c.is_default) || companies[0];
    setCompanyId(defComp?.id || "");
    setModeloProposta("classico");
    setDataProposta(new Date().toISOString().split("T")[0]);
    setTipoProposta("");
    setTitulo("PROPOSTA COMERCIAL");
    setItens([]);
    setDescontoDisplay("");
    setDescontoNum(0);
    setTotalManualDisplay("");
    setTotalManualNum(0);
    setObservacoes("");
  };

  const handleAddItem = () => {
    setItens([
      ...itens,
      {
        descricao: "",
        imagem_url: "",
        quantidade: 1,
        valor_unitario: 0,
        total: 0,
        valorDisplay: "",
        isUploading: false,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    const newItens = [...itens];
    newItens.splice(index, 1);
    setItens(newItens);
  };

  const handleItemChange = (index: number, field: keyof PropostaItem, val: any) => {
    const newItens = [...itens];
    const item = { ...newItens[index] };

    if (field === "descricao") {
      item.descricao = val;
    } else if (field === "quantidade") {
      const q = parseFloat(val) || 0;
      item.quantidade = q;
      item.total = q * item.valor_unitario;
    } else if (field === "valorDisplay") {
      const masked = maskCurrency(val);
      item.valorDisplay = masked;
      const num = unmaskCurrency(masked);
      item.valor_unitario = num;
      item.total = item.quantidade * num;
    }

    newItens[index] = item;
    setItens(newItens);
  };

  const handleUploadImage = async (index: number, file: File) => {
    if (!file) return;

    const newItens = [...itens];
    newItens[index].isUploading = true;
    setItens(newItens);

    const { url, error } = await uploadArquivo(file);

    const updatedItens = [...itens];
    updatedItens[index].isUploading = false;

    if (error || !url) {
      toast({ title: "Erro no upload", description: error || "Falha ao enviar imagem", variant: "destructive" });
    } else {
      updatedItens[index].imagem_url = url;
      toast({ title: "Imagem enviada com sucesso!" });
    }
    setItens(updatedItens);
  };

  const handleDescontoChange = (val: string) => {
    const masked = maskCurrency(val);
    setDescontoDisplay(masked);
    setDescontoNum(unmaskCurrency(masked));
  };

  const handleTotalManualChange = (val: string) => {
    const masked = maskCurrency(val);
    setTotalManualDisplay(masked);
    setTotalManualNum(unmaskCurrency(masked));
  };

  const calculateTotalGeral = () => {
    return itens.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  const handleSave = async () => {
    if (!clienteId) return toast({ title: "Selecione o cliente", variant: "destructive" });
    if (itens.length === 0) return toast({ title: "Adicione pelo menos um item", variant: "destructive" });

    const totalGeral = calculateTotalGeral();
    // O total final salvo é o manual (se informado > 0) ou calculado menos desconto
    const totalFinal = totalManualNum > 0 ? totalManualNum : Math.max(totalGeral - descontoNum, 0);

    const payloadProposta = {
      cliente_id: clienteId,
      vendedor_id: vendedorId || null,
      company_id: companyId || null,
      modelo_proposta: modeloProposta || "classico",
      data_proposta: dataProposta,
      tipo_proposta: tipoProposta,
      titulo: titulo,
      desconto: descontoNum,
      total: totalFinal,
      observacoes: observacoes,
    };

    try {
      let propostaId = "";
      if (editing) {
        propostaId = editing.id;
        const { error } = await supabase.from("propostas").update(payloadProposta).eq("id", propostaId);
        if (error) throw error;

        // Excluir os itens antigos para reinserir
        const { error: delError } = await supabase.from("proposta_itens").delete().eq("proposta_id", propostaId);
        if (delError) throw delError;
      } else {
        const { data, error } = await supabase.from("propostas").insert(payloadProposta).select().single();
        if (error) throw error;
        propostaId = data.id;
      }

      // Inserir os itens
      const payloadItens = itens.map((item, idx) => ({
        proposta_id: propostaId,
        descricao: item.descricao,
        imagem_url: item.imagem_url,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        total: item.total,
        ordem: idx,
      }));

      const { error: itensError } = await supabase.from("proposta_itens").insert(payloadItens);
      if (itensError) throw itensError;

      toast({ title: editing ? "Proposta atualizada!" : "Proposta criada com sucesso!" });
      setOpen(false);
      resetForm();
      load();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const handleEdit = (p: Proposta) => {
    setEditing(p);
    setClienteId(p.cliente_id);
    setCompanyId(p.company_id || "");
    setModeloProposta((p as any).modelo_proposta || "classico");
    setDataProposta(p.data_proposta);
    setTipoProposta(p.tipo_proposta || "");
    setTitulo(p.titulo || "PROPOSTA COMERCIAL");
    setObservacoes(p.observacoes || "");

    // Mapear itens para preencher form
    const itemData = (p.proposta_itens || []).map((item) => ({
      ...item,
      quantidade: Number(item.quantidade),
      valor_unitario: Number(item.valor_unitario),
      total: Number(item.total),
      valorDisplay: formatCurrency(Number(item.valor_unitario)),
      isUploading: false,
    }));
    setItens(itemData);

    const descNum = Number(p.desconto || 0);
    setDescontoNum(descNum);
    setDescontoDisplay(descNum > 0 ? formatCurrency(descNum) : "");

    // Ao editar, preenche o total manual com o total salvo para permitir ajuste
    const totalNum = Number(p.total || 0);
    setTotalManualNum(totalNum);
    setTotalManualDisplay(totalNum > 0 ? formatCurrency(totalNum) : "");
    setVendedorId((p as any).vendedor_id || "");
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir esta proposta?")) return;
    const { error } = await supabase.from("propostas").delete().eq("id", id);
    if (error) return toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    toast({ title: "Proposta excluída!" });
    load();
  };

  const buildPropostaHtml = (p: Proposta) => {
    const cli = p.clientes || {};
    const comp = (p as any).company_settings || companies.find(c => c.id === p.company_id) || companies.find(c => c.is_default) || companies[0] || company || {};
    const modelo = (p as any).modelo_proposta || modeloProposta || "classico";

    let logoHtml = "";
    if (comp.logo_url) {
      let logoSrc = comp.logo_url;
      if (logoSrc.startsWith("/")) {
        logoSrc = `${window.location.protocol}//${window.location.host}${logoSrc}`;
      }
      logoHtml = `<img src="${logoSrc}" alt="Logo" style="max-height: 80px; max-width: 220px; object-fit: contain;" />`;
    }

    const compEndereco = [comp.endereco, comp.bairro, comp.cidade, comp.cep ? `CEP: ${comp.cep}` : ""]
      .filter(Boolean)
      .join(" - ");

    const compContato = [comp.telefone ? `Tel.: ${comp.telefone}` : "", comp.email ? `Email: ${comp.email}` : ""]
      .filter(Boolean)
      .join(" | ");

    const cliEndereco = cli.endereco || "-";
    const dataEmissaoFormatada = p.data_proposta
      ? format(new Date(p.data_proposta + "T12:00:00"), "dd/MM/yyyy")
      : "-";
    const dataAssinaturaFormatada = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    const desc = Number(p.desconto || 0);
    const totalGeral = (p.proposta_itens || []).reduce((sum, item) => sum + Number(item.total || 0), 0);
    const finalTotal = Number(p.total || 0);

    // =========================================================================
    // MODELO 2: MINIMALISTA SEM MOLDURA (Logo no topo centralizada, Sem bordas/caixas)
    // =========================================================================
    if (modelo === "moderno") {
      let logoHtmlHeader = "";
      if (comp.logo_url) {
        let logoSrc = comp.logo_url;
        if (logoSrc.startsWith("/")) {
          logoSrc = `${window.location.protocol}//${window.location.host}${logoSrc}`;
        }
        logoHtmlHeader = `<img src="${logoSrc}" alt="Logo" style="max-height: 90px; max-width: 260px; object-fit: contain; margin: 0 auto 8px auto; display: block;" />`;
      }

      const rowsHtmlModerno = (p.proposta_itens || [])
        .map((item, idx) => {
          let imgHtml = "";
          if (item.imagem_url) {
            let imgSrc = item.imagem_url;
            if (imgSrc.startsWith("/")) imgSrc = `${window.location.protocol}//${window.location.host}${imgSrc}`;
            imgHtml = `<br/><img src="${imgSrc}" alt="Item" style="max-height: 80px; max-width: 130px; object-fit: contain; margin-top: 6px;" />`;
          }
          return `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 4px; text-align: left;">
              <span style="color: #64748b; margin-right: 6px;">${idx + 1}.</span>
              <strong style="color: #0f172a;">${item.descricao}</strong>
              ${imgHtml}
            </td>
            <td style="padding: 12px 4px; text-align: center; color: #475569;">${item.quantidade}</td>
            <td style="padding: 12px 4px; text-align: right; color: #475569;">R$ ${formatCurrency(Number(item.valor_unitario))}</td>
            <td style="padding: 12px 4px; text-align: right; font-weight: 700; color: #0f172a;">R$ ${formatCurrency(Number(item.total))}</td>
          </tr>
        `;
        })
        .join("");

      return `
        <div style="font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #1e293b; max-width: 800px; margin: 0 auto; background: #ffffff; padding: 40px 30px; border: none; box-shadow: none;">
          <!-- 1. LOGOMARCA NO TOPO CENTRALIZADA -->
          <div style="text-align: center; margin-bottom: 20px;">
            ${logoHtmlHeader || `<div style="font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">${comp.name || "LOGOMARCA"}</div>`}
            <div style="font-size: 12px; color: #64748b; margin-top: 6px;">
              ${comp.name ? `<strong style="color: #0f172a;">${comp.name}</strong>` : ""}
              ${comp.cnpj ? ` • CNPJ: ${comp.cnpj}` : ""}
              ${compEndereco ? ` • ${compEndereco}` : ""}
            </div>
            ${compContato ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${compContato}</div>` : ""}
          </div>

          <!-- Divisor sutil sem moldura -->
          <div style="height: 1px; background: #e2e8f0; margin: 20px 0 28px 0;"></div>

          <!-- 2. TÍTULO E TIPO DA PROPOSTA -->
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #2563eb;">
              ${p.tipo_proposta || "PROPOSTA COMERCIAL"}
            </div>
            <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 4px 0 2px 0;">
              ${p.titulo || "PROPOSTA COMERCIAL"}
            </h1>
            <div style="font-size: 12px; color: #64748b;">Data de Emissão: ${dataEmissaoFormatada}</div>
          </div>

          <!-- 3. DADOS DO CLIENTE (Texto limpo, sem moldura ou caixa de fundo) -->
          <div style="margin-bottom: 32px; font-size: 13px;">
            <div style="font-weight: 800; font-size: 11px; color: #2563eb; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px;">Informações do Cliente</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; line-height: 1.6;">
              <div><span style="color: #64748b;">Cliente:</span> <strong style="color: #0f172a;">${cli.nome || "-"}</strong></div>
              <div><span style="color: #64748b;">CPF/CNPJ:</span> <strong style="color: #0f172a;">${cli.cpf_cnpj || "-"}</strong></div>
              <div><span style="color: #64748b;">Telefone:</span> <strong style="color: #0f172a;">${cli.telefone || "-"}</strong></div>
              <div><span style="color: #64748b;">E-mail:</span> <strong style="color: #0f172a;">${cli.email || "-"}</strong></div>
              <div style="grid-column: span 2;"><span style="color: #64748b;">Endereço:</span> <strong style="color: #0f172a;">${cliAddressFormat(cliEndereco)}</strong></div>
            </div>
          </div>

          <!-- 4. TABELA DE ITENS (Sem moldura nem bordas laterais) -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; border: none;">
            <thead>
              <tr style="border-bottom: 2px solid #0f172a; color: #0f172a;">
                <th style="padding: 10px 4px; text-align: left; font-weight: 800; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Descrição</th>
                <th style="padding: 10px 4px; text-align: center; font-weight: 800; text-transform: uppercase; font-size: 11px; width: 60px;">Qtd</th>
                <th style="padding: 10px 4px; text-align: right; font-weight: 800; text-transform: uppercase; font-size: 11px; width: 120px;">Unitário</th>
                <th style="padding: 10px 4px; text-align: right; font-weight: 800; text-transform: uppercase; font-size: 11px; width: 120px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtmlModerno}
            </tbody>
          </table>

          <!-- 5. VALOR TOTAL (Sem molduras/caixas) -->
          <div style="display: flex; justify-content: flex-end; margin-bottom: 35px; text-align: right;">
            <div>
              ${desc > 0 ? `<div style="font-size: 12px; color: #dc2626; margin-bottom: 4px; font-weight: 600;">Desconto: - R$ ${formatCurrency(desc)}</div>` : ""}
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">VALOR TOTAL</div>
              <div style="font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">R$ ${formatCurrency(finalTotal)}</div>
            </div>
          </div>

          ${p.observacoes ? `
          <!-- 6. OBSERVAÇÕES (Sem bordas) -->
          <div style="margin-bottom: 40px; font-size: 13px;">
            <div style="font-weight: 800; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Observações</div>
            <div style="white-space: pre-wrap; color: #475569; line-height: 1.5;">${p.observacoes.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          </div>
          ` : ""}

          <!-- 7. ASSINATURAS (Linhas limpas sem caixas) -->
          <div style="margin-top: 50px; font-size: 12px;">
            <div style="display: flex; justify-content: space-around; text-align: center; margin-bottom: 30px;">
              <div style="width: 250px;">
                ${comp.assinatura_imagem
                  ? `<img src="${comp.assinatura_imagem}" style="max-height:55px;display:block;margin:0 auto 4px;" />`
                  : `<div style="border-top: 1px solid #cbd5e1; margin-top: 40px; margin-bottom: 6px;"></div>`}
                <strong style="color: #0f172a; display: block;">${comp.name || "Assinatura Empresa"}</strong>
                <div style="font-size: 10px; color: #64748b;">${comp.nome_responsavel || ""}</div>
              </div>
              <div style="width: 250px;">
                <div style="border-top: 1px solid #cbd5e1; margin-top: 40px; margin-bottom: 6px;"></div>
                <strong style="color: #0f172a; display: block;">${cli.nome || "Assinatura Cliente"}</strong>
                <div style="font-size: 10px; color: #64748b;">Aceite do Cliente</div>
              </div>
            </div>
          </div>

          <!-- Rodapé Limpo -->
          <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; font-style: italic;">
            Emitido em ${dataAssinaturaFormatada}.
          </div>
        </div>
      `;
    }

    // =========================================================================
    // MODELO 3: ELEGANTE / EXECUTIVO (Georgia Serif, Linha Fina Ouro)
    // =========================================================================
    if (modelo === "elegante") {
      const rowsHtmlElegante = (p.proposta_itens || [])
        .map((item, idx) => {
          let imgHtml = "";
          if (item.imagem_url) {
            let imgSrc = item.imagem_url;
            if (imgSrc.startsWith("/")) imgSrc = `${window.location.protocol}//${window.location.host}${imgSrc}`;
            imgHtml = `<br/><img src="${imgSrc}" alt="Item" style="max-height: 80px; max-width: 130px; object-fit: contain; margin-top: 6px; border: 1px solid #d97706;" />`;
          }
          return `
          <tr style="border-bottom: 1px solid #f3ebd8;">
            <td style="padding: 10px 10px; text-align: left; font-family: Georgia, serif;">
              <span style="color: #d97706; font-weight: bold; margin-right: 6px;">${idx + 1}.</span>
              <span style="color: #0f172a; font-weight: 600;">${item.descricao}</span>
              ${imgHtml}
            </td>
            <td style="padding: 10px 10px; text-align: center; color: #374151; font-family: Arial, sans-serif;">${item.quantidade}</td>
            <td style="padding: 10px 10px; text-align: right; color: #4b5563; font-family: Arial, sans-serif;">R$ ${formatCurrency(Number(item.valor_unitario))}</td>
            <td style="padding: 10px 10px; text-align: right; font-weight: bold; color: #92400e; font-family: Georgia, serif;">R$ ${formatCurrency(Number(item.total))}</td>
          </tr>
        `;
        })
        .join("");

      return `
        <div style="font-family: Georgia, 'Times New Roman', serif; color: #1f2937; max-width: 800px; margin: 0 auto; background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
          <!-- Top Bar Ouro Fina -->
          <div style="height: 3px; background: #d97706; margin-bottom: 28px;"></div>

          <!-- Header Executivo Centralizado -->
          <div style="text-align: center; border-bottom: 1px solid #f3ebd8; padding-bottom: 20px; margin-bottom: 28px;">
            ${logoHtml ? `<div style="margin-bottom: 12px;">${logoHtml}</div>` : ""}
            <div style="font-size: 22px; font-weight: bold; color: #0f172a; letter-spacing: 1px; text-transform: uppercase;">${comp.name || "Sua Empresa"}</div>
            <div style="font-size: 12px; color: #6b7280; font-family: Arial, sans-serif; margin-top: 4px;">
              ${comp.cnpj ? `CNPJ: ${comp.cnpj}` : ""} ${compEndereco ? ` • ${compEndereco}` : ""}
            </div>
            ${compContato ? `<div style="font-size: 12px; color: #6b7280; font-family: Arial, sans-serif; margin-top: 2px;">${compContato}</div>` : ""}
          </div>

          <!-- Título Proposta -->
          <div style="text-align: center; margin-bottom: 28px;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #d97706; font-weight: bold; font-family: Arial, sans-serif;">PROPOSTA COMERCIAL</div>
            <h1 style="font-size: 22px; font-weight: normal; color: #0f172a; margin: 4px 0; font-style: italic;">${p.titulo || "PROPOSTA COMERCIAL"}</h1>
            <div style="font-size: 12px; color: #6b7280; font-family: Arial, sans-serif; margin-top: 2px;">Emissão: ${dataEmissaoFormatada}</div>
          </div>

          <!-- Dados do Cliente (Parchment Clean Box) -->
          <div style="background-color: #fdfbf7; border: 1px solid #f3ebd8; padding: 18px; margin-bottom: 28px; border-radius: 4px;">
            <div style="font-size: 11px; font-weight: bold; color: #92400e; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #f3ebd8; padding-bottom: 6px; margin-bottom: 10px; font-family: Arial, sans-serif;">DADOS DO CLIENTE</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; font-family: Arial, sans-serif;">
              <div><strong style="color: #1e293b;">Cliente:</strong> ${cli.nome || "-"}</div>
              <div><strong style="color: #1e293b;">CPF/CNPJ:</strong> ${cli.cpf_cnpj || "-"}</div>
              <div><strong style="color: #1e293b;">Telefone:</strong> ${cli.telefone || "-"}</div>
              <div><strong style="color: #1e293b;">E-mail:</strong> ${cli.email || "-"}</div>
              <div style="grid-column: span 2;"><strong style="color: #1e293b;">Endereço:</strong> ${cliAddressFormat(cliEndereco)}</div>
              ${p.tipo_proposta ? `<div><strong style="color: #1e293b;">Tipo:</strong> ${p.tipo_proposta}</div>` : ""}
            </div>
          </div>

          <!-- Tabela Executiva Clean -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 13px;">
            <thead>
              <tr style="background-color: #0f172a; color: #ffffff; font-family: Arial, sans-serif;">
                <th style="padding: 10px 12px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Descrição do Serviço / Produto</th>
                <th style="padding: 10px 12px; text-align: center; font-weight: 600; font-size: 11px; text-transform: uppercase; width: 60px;">Qtd</th>
                <th style="padding: 10px 12px; text-align: right; font-weight: 600; font-size: 11px; text-transform: uppercase; width: 120px;">Unitário</th>
                <th style="padding: 10px 12px; text-align: right; font-weight: 600; font-size: 11px; text-transform: uppercase; width: 120px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtmlElegante}
            </tbody>
          </table>

          <!-- Totais com faixa executiva Onyx -->
          <div style="background: #0f172a; color: #ffffff; padding: 14px 20px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; font-family: Arial, sans-serif;">
            <div>
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Valor Total da Proposta</div>
              ${desc > 0 ? `<div style="font-size: 12px; color: #f87171; margin-top: 2px;">Desconto: - R$ ${formatCurrency(desc)}</div>` : ""}
            </div>
            <div style="font-size: 22px; font-weight: bold; color: #f59e0b; font-family: Georgia, serif;">R$ ${formatCurrency(finalTotal)}</div>
          </div>
          ${p.observacoes ? `
          <div style="border-left: 3px solid #d97706; padding: 14px 18px; background: #fdfbf7; margin-bottom: 32px; font-size: 13px; font-family: Arial, sans-serif;">
            <div style="font-weight: bold; color: #92400e; margin-bottom: 4px; font-size: 12px; text-transform: uppercase;">Observações</div>
            <div style="white-space: pre-wrap; color: #4b5563; line-height: 1.5;">${p.observacoes.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          </div>
          ` : ""}

          <!-- Assinatura Executiva -->
          <div style="margin-top: 45px; font-family: Arial, sans-serif; font-size: 12px;">
            <div style="text-align: center; color: #6b7280; margin-bottom: 35px; font-style: italic;">Documento emitido em ${dataAssinaturaFormatada}.</div>
            <div style="display: flex; justify-content: space-around; text-align: center;">
              <div style="width: 250px;">
                ${comp.assinatura_imagem
                  ? `<img src="${comp.assinatura_imagem}" style="max-height:55px;display:block;margin:0 auto 4px;" />`
                  : `<div style="border-top: 1px solid #4b5563; margin-top: 40px; margin-bottom: 6px;"></div>`}
                <strong style="color: #0f172a; display: block;">${comp.name || "Assinatura Empresa"}</strong>
                <div style="font-size: 10px; color: #6b7280;">${comp.nome_responsavel || ""}</div>
              </div>
              <div style="width: 250px;">
                <div style="border-top: 1px solid #4b5563; margin-top: 40px; margin-bottom: 6px;"></div>
                <strong style="color: #0f172a; display: block;">${cli.nome || "Assinatura Cliente"}</strong>
                <div style="font-size: 10px; color: #6b7280;">Aceite do Cliente</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // =========================================================================
    // MODELO 1: CLÁSSICO / CORPORATIVO TRADICIONAL (DEFAULT)
    // =========================================================================
    const rowsHtml = (p.proposta_itens || [])
      .map((item, idx) => {
        let imgHtml = "";
        if (item.imagem_url) {
          let imgSrc = item.imagem_url;
          if (imgSrc.startsWith("/")) {
            imgSrc = `${window.location.protocol}//${window.location.host}${imgSrc}`;
          }
          imgHtml = `<br/><img src="${imgSrc}" alt="Item" style="max-height: 100px; max-width: 150px; object-fit: contain; margin-top: 5px; border-radius: 4px; border: 1px solid #e2e8f0;" />`;
        }
        return `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: left;">
            <div><strong>${idx + 1}.</strong> ${item.descricao}</div>
            ${imgHtml}
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${item.quantidade}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">R$ ${formatCurrency(Number(item.valor_unitario))}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">R$ ${formatCurrency(Number(item.total))}</td>
        </tr>
      `;
      })
      .join("");

    let descRowHtml = "";
    if (desc > 0) {
      descRowHtml = `
        <tr style="font-weight: bold;">
          <td colspan="3" style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-size: 13px;">Valor dos Itens:</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-size: 13px;">R$ ${formatCurrency(totalGeral)}</td>
        </tr>
        <tr style="font-weight: bold; color: #dc2626;">
          <td colspan="3" style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-size: 13px;">Desconto:</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-size: 13px;">- R$ ${formatCurrency(desc)}</td>
        </tr>
      `;
    }

    return `
      <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 20px; max-width: 800px; margin: 0 auto; background: #ffffff; border-top: 6px solid #0f172a; border-bottom: 2px solid #cbd5e1;">
        <!-- Cabeçalho -->
        <div style="text-align: center; border-bottom: 2px solid #334155; padding-bottom: 16px; margin-bottom: 24px;">
          ${logoHtml}
          <div style="font-size: 20px; font-weight: bold; color: #0f172a; margin-top: 6px;">${comp.name || "Sua Empresa"}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            ${comp.cnpj ? `CNPJ: ${comp.cnpj}` : ""} ${compEndereco ? ` | ${compEndereco}` : ""}
          </div>
          ${compContato ? `<div style="font-size: 12px; color: #64748b;">${compContato}</div>` : ""}
        </div>

        <!-- Título Proposta -->
        <div style="text-align: center; margin-bottom: 25px;">
          <h1 style="font-size: 22px; margin: 0 0 5px 0; font-weight: bold; color: #0f172a;">${p.titulo || "PROPOSTA COMERCIAL"}</h1>
          <div style="font-size: 13px; color: #64748b;">Data de Emissão: ${dataEmissaoFormatada}</div>
        </div>

        <!-- Informações do Cliente -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 25px; font-size: 13px;">
          <div style="font-weight: bold; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; color: #0f172a;">DADOS DO CLIENTE</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <div><strong>Cliente:</strong> ${cli.nome || "-"}</div>
            <div><strong>CPF/CNPJ:</strong> ${cli.cpf_cnpj || "-"}</div>
            <div><strong>Endereço:</strong> ${cliAddressFormat(cliEndereco)}</div>
            <div><strong>Telefone:</strong> ${cli.telefone || "-"}</div>
            <div><strong>E-mail:</strong> ${cli.email || "-"}</div>
            <div><strong>Tipo de Proposta:</strong> ${p.tipo_proposta || "-"}</div>
          </div>
        </div>

        <!-- Tabela de Itens -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px;">
          <thead>
            <tr style="background-color: #334155; color: #ffffff;">
              <th style="border: 1px solid #334155; padding: 10px; text-align: left; font-weight: bold;">Descrição do Produto / Serviço</th>
              <th style="border: 1px solid #334155; padding: 10px; text-align: center; font-weight: bold; width: 80px;">Qtd</th>
              <th style="border: 1px solid #334155; padding: 10px; text-align: right; font-weight: bold; width: 120px;">Val. Unitário</th>
              <th style="border: 1px solid #334155; padding: 10px; text-align: right; font-weight: bold; width: 120px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${descRowHtml}
            <tr style="font-weight: bold; background-color: #f8fafc;">
              <td colspan="3" style="border: 1px solid #cbd5e1; padding: 12px; text-align: right; font-size: 14px;">VALOR TOTAL DA PROPOSTA:</td>
              <td style="border: 1px solid #cbd5e1; padding: 12px; text-align: right; font-size: 14px; color: #0f172a;">R$ ${formatCurrency(finalTotal)}</td>
            </tr>
          </tbody>
        </table>

        ${p.observacoes ? `
        <!-- Observações -->
        <div style="margin-bottom: 30px; font-size: 13px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px;">
          <div style="font-weight: bold; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; color: #0f172a;">OBSERVAÇÕES</div>
          <div style="white-space: pre-wrap; color: #334155; line-height: 1.5;">${p.observacoes.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>
        ` : ""}

        <!-- Espaço para assinatura -->
        <div style="margin-top: 60px; font-size: 13px;">
          <div style="text-align: right; margin-bottom: 40px; color: #64748b;">
            Emitido em ${dataAssinaturaFormatada}.
          </div>
          <div style="display: flex; justify-content: space-around; margin-top: 50px; text-align: center;">
            <div style="width: 250px;">
              ${comp.assinatura_imagem
                ? `<img src="${comp.assinatura_imagem}" style="max-height:60px;display:block;margin:0 auto 5px;" />`
                : `<div style="border-top: 1px solid #94a3b8; margin-bottom: 5px;"></div>`}
              <strong>${comp.name || "Assinatura da Empresa"}</strong>
              <div style="font-size: 11px; color: #64748b;">${comp.nome_responsavel || ""}</div>
            </div>
            <div style="width: 250px;">
              <div style="border-top: 1px solid #94a3b8; margin-bottom: 5px;"></div>
              <strong>${cli.nome || "Assinatura do Cliente"}</strong>
              <div style="font-size: 11px; color: #64748b;">Aceite em ___/___/______</div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const cliAddressFormat = (addr: string) => {
    return addr.length > 50 ? addr.substring(0, 47) + "..." : addr;
  };

  const handleViewProposta = (p: Proposta) => {
    setPreviewTitle(p.clientes?.nome || "Proposta");
    setPreviewHtml(buildPropostaHtml(p));
    setPreviewProposta(p);
    setPreviewOpen(true);
  };

  const handlePrintProposta = (p: Proposta) => {
    const html = buildPropostaHtml(p);
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      return toast({ title: "Bloqueio de pop-up", description: "Permita pop-ups para imprimir.", variant: "destructive" });
    }
    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>Proposta - ${p.clientes?.nome || "Cliente"}</title>
          <style>
            @page { margin: 15mm; }
            body { font-family: Arial, sans-serif; background: #ffffff; }
            img { max-height: 80px; max-width: 200px; object-fit: contain; }
          </style>
        </head>
        <body><div>${html}</div></body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Propostas Comerciais</h2>
          <p className="text-sm text-muted-foreground">Emissão e gerenciamento de propostas.</p>
        </div>

        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nova Proposta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-violet-600" />
                {editing ? "Editar Proposta" : "Nova Proposta"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <SearchableClientSelect
                    clients={clientes}
                    value={clienteId}
                    onValueChange={setClienteId}
                    placeholder="Pesquisar ou selecionar cliente..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data da Proposta</Label>
                  <Input type="date" value={dataProposta} onChange={(e) => setDataProposta(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Vendedor (opcional)</Label>
                  <Select value={vendedorId || "_none"} onValueChange={(v) => setVendedorId(v === "_none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhum vendedor vinculado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhum</SelectItem>
                      {vendedores.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo da Proposta</Label>
                  <Input
                    value={tipoProposta}
                    onChange={(e) => setTipoProposta(e.target.value)}
                    placeholder="Ex.: Prestação de Serviço, Venda de Produto"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Empresa Emissora</Label>
                  <Select value={companyId} onValueChange={setCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.is_default ? " (Padrão)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Modelo de Proposta (Layout Visual)</Label>
                  <Select value={modeloProposta} onValueChange={setModeloProposta}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o modelo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="classico">🏢 Modelo 1: Corporativo Tradicional</SelectItem>
                      <SelectItem value="moderno">🚀 Modelo 2: Sem Moldura (Logo no Topo)</SelectItem>
                      <SelectItem value="elegante">👑 Modelo 3: Executivo / Serifado Elegante</SelectItem>
                      <SelectItem value="compacto">📑 Modelo 4: Fatura / Orçamento Compacto</SelectItem>
                      <SelectItem value="lateral">📊 Modelo 5: Sidebar Lateral Moderna</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Título do Documento</Label>
                  <Input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex.: PROPOSTA COMERCIAL"
                  />
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <Label>Texto Livre / Observações</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações adicionais ou texto livre da proposta..."
                  className="min-h-[100px]"
                />
              </div>

              {/* Grid Editável de Itens */}
              <div className="border rounded-md p-4 space-y-4 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Itens da Proposta</h3>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {itens.map((item, idx) => (
                    <Card key={idx} className="relative border-slate-200">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveItem(idx)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <CardContent className="p-4 pt-8 grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-5 space-y-1">
                          <Label className="text-xs">Descrição do Produto / Serviço</Label>
                          <Input
                            value={item.descricao}
                            onChange={(e) => handleItemChange(idx, "descricao", e.target.value)}
                            placeholder="Descreva o produto ou serviço..."
                          />
                        </div>

                        <div className="md:col-span-3 space-y-1">
                          <Label className="text-xs">Imagem (Upload)</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept="image/*"
                              className="text-xs"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadImage(idx, file);
                              }}
                            />
                            {item.imagem_url && (
                              <div className="h-9 w-9 border rounded overflow-hidden flex items-center justify-center bg-white shrink-0">
                                <img src={item.imagem_url} alt="Miniatura" className="h-full w-full object-contain" />
                              </div>
                            )}
                            {item.isUploading && (
                              <span className="text-[10px] text-muted-foreground animate-pulse shrink-0">Enviando...</span>
                            )}
                          </div>
                        </div>

                        <div className="md:col-span-1.5 space-y-1">
                          <Label className="text-xs">Qtd</Label>
                          <Input
                            type="number"
                            step="any"
                            value={item.quantidade}
                            onChange={(e) => handleItemChange(idx, "quantidade", e.target.value)}
                          />
                        </div>

                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-xs">Valor Unitário (R$)</Label>
                          <Input
                            value={item.valorDisplay || ""}
                            onChange={(e) => handleItemChange(idx, "valorDisplay", e.target.value)}
                            placeholder="0,00"
                          />
                        </div>

                        <div className="md:col-span-1.5 space-y-1 flex flex-col justify-end">
                          <div className="text-[10px] text-muted-foreground">Total Item</div>
                          <div className="text-xs font-semibold h-9 flex items-center">
                            R$ {formatCurrency(item.total || 0)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {itens.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-6 border border-dashed rounded-md">
                      Nenhum item adicionado. Clique em "Adicionar Item" acima.
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <Label>Total dos Itens</Label>
                    <div className="h-10 rounded-md border bg-slate-50 px-3 flex items-center font-semibold">
                      R$ {formatCurrency(calculateTotalGeral())}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Desconto (R$)</Label>
                    <Input value={descontoDisplay} onChange={(e) => handleDescontoChange(e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Total Ajustado (R$)</Label>
                    <Input value={totalManualDisplay} onChange={(e) => handleTotalManualChange(e.target.value)} placeholder="Se vazio, usa total - desconto" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-slate-800">
                    Total Final: R$ {formatCurrency(totalManualNum > 0 ? totalManualNum : Math.max(calculateTotalGeral() - descontoNum, 0))}
                  </div>
                  <Button onClick={handleSave}>
                    Salvar Proposta
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Empresa / Modelo</TableHead>
              <TableHead>Tipo de Proposta</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Assinatura</TableHead>
              <TableHead className="w-[160px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPropostas.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{format(new Date(p.data_proposta + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                <TableCell className="font-medium">{p.clientes?.nome || "-"}</TableCell>
                <TableCell className="text-xs space-y-1">
                  <div className="font-medium text-slate-800">{(p.company_settings?.name) || (companies.find(c => c.id === p.company_id)?.name) || "Empresa"}</div>
                  {((p as any).modelo_proposta === "moderno") && <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-[10px]">Tech Moderno</Badge>}
                  {((p as any).modelo_proposta === "elegante") && <Badge variant="secondary" className="bg-amber-50 text-amber-800 text-[10px]">Executivo</Badge>}
                  {(!((p as any).modelo_proposta) || (p as any).modelo_proposta === "classico") && <Badge variant="outline" className="text-slate-600 text-[10px]">Clássico</Badge>}
                </TableCell>
                <TableCell>{p.tipo_proposta || "-"}</TableCell>
                <TableCell>R$ {formatCurrency(Number(p.total || 0))}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    {badgeAssinatura(p.assinatura_status)}
                    {(!p.assinatura_status || p.assinatura_status === "pendente") && !linkGerado[p.id] && (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] w-full" onClick={() => handleEnviarAssinatura(p)} disabled={enviandoLink === p.id}>
                        <Send className="h-3 w-3 mr-1" /> Assinar
                      </Button>
                    )}
                    {(linkGerado[p.id] || p.assinatura_status === "enviado") && (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] w-full" onClick={() => copiarLink(linkGerado[p.id] || p.assinatura_link || "")}>
                        <Copy className="h-3 w-3 mr-1" /> Link
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleViewProposta(p)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handlePrintProposta(p)}>
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Baixar PDF" onClick={() => handleDownloadProposta(p)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Enviar por e-mail" onClick={() => abrirEnvio(p, "email")} disabled={enviandoEmail === p.id}>
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Enviar por WhatsApp" onClick={() => abrirEnvio(p, "whatsapp")} disabled={enviandoWhatsapp === p.id}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {(p as any).vendedor_id && (
                      <Button
                        variant="ghost" size="icon"
                        title="Notificar vendedor por WhatsApp"
                        disabled={enviandoVendedor === p.id}
                        onClick={async () => {
                          setEnviandoVendedor(p.id);
                          const r = await notifyVendedor("proposta", p.id, "proposta_assinatura", "whatsapp");
                          setEnviandoVendedor(null);
                          if (r.success) toast({ title: "Vendedor notificado por WhatsApp!" });
                          else toast({ title: "Erro ao notificar", description: r.error, variant: "destructive" });
                        }}
                      >
                        <MessageSquare className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {propostas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma proposta cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={propostas.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualizar Proposta</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { if (previewProposta) handleDownloadProposta(previewProposta); }}>
              <Download className="mr-2 h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => { if (previewProposta) abrirEnvio(previewProposta, "email"); }} disabled={!!enviandoEmail}>
              <Mail className="mr-2 h-4 w-4" /> E-mail
            </Button>
            <Button variant="outline" size="sm" onClick={() => { if (previewProposta) abrirEnvio(previewProposta, "whatsapp"); }} disabled={!!enviandoWhatsapp}>
              <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={() => { if (previewProposta) handlePrintProposta(previewProposta); }}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
          </div>
          <div
            className="rounded-md border bg-white p-6 min-h-[350px] overflow-auto shadow-inner"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!sendDialog} onOpenChange={(o) => { if (!o) setSendDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Enviar Proposta por {sendDialog?.canal === "email" ? "E-mail" : "WhatsApp"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Select
                value={sendTemplateId}
                onValueChange={(v) => {
                  setSendTemplateId(v);
                  const t = msgTemplates.find((tp) => tp.id === v);
                  if (t) setSendMensagem(t.corpo);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mensagem padrão" />
                </SelectTrigger>
                <SelectContent>
                  {sendDialog && templatesDoCanal(sendDialog.canal).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem</Label>
              <Textarea
                rows={6}
                value={sendMensagem}
                onChange={(e) => setSendMensagem(e.target.value)}
              />
            </div>
            <div className="pt-2 border-t space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox id="agendarProposta" checked={agendarEnvioAtivo} onCheckedChange={(v) => setAgendarEnvioAtivo(!!v)} />
                <Label htmlFor="agendarProposta" className="cursor-pointer font-medium text-slate-700">Agendar para envio futuro</Label>
              </div>
              {agendarEnvioAtivo && (
                <Input type="datetime-local" value={dataAgendamento} onChange={(e) => setDataAgendamento(e.target.value)} />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialog(null)}>Cancelar</Button>
            <Button onClick={handleConfirmarEnvio} disabled={enviandoMensagem}>
              {enviandoMensagem ? "Processando..." : (agendarEnvioAtivo ? "Agendar" : "Enviar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Propostas;
