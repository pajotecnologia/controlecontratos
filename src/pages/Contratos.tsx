import { useEffect, useState, useMemo } from "react";
import { supabase, previewContrato, enviarParaAssinatura, notifyVendedor } from "@/integrations/api/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table2 from "@tiptap/extension-table";
import TableRow2 from "@tiptap/extension-table-row";
import TableHeader2 from "@tiptap/extension-table-header";
import TableCell2 from "@tiptap/extension-table-cell";
import { FontSize } from "@/lib/editorExtensions";
import ModeloToolbar from "@/components/editor/ModeloToolbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, CalendarIcon, Eye, FileSignature, RefreshCw, Printer, Send, Copy, Download, CheckCircle2, Clock, XCircle, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { maskCurrency, unmaskCurrency, formatCurrency } from "@/lib/masks";
import { SearchableClientSelect } from "@/components/SearchableClientSelect";
import { DataTablePagination } from "@/components/DataTablePagination";

type Contrato = {
  id: string;
  data_emissao: string;
  data_vencimento: string | null;
  valor: number;
  taxa_implantacao?: number;
  forma_pagamento?: string | null;
  forma_reajuste?: string | null;
  modelo_equipamento?: string | null;
  prazo_contrato?: string | null;
  conteudo_personalizado?: string | null;
  cliente_id: string;
  modelo_id: string;
  company_id: string;
  clientes?: { nome: string };
  modelos?: { nome: string; conteudo?: string };
  assinatura_status?: string;
  assinatura_token?: string;
  assinatura_link?: string;
  assinatura_nome?: string;
  assinatura_data?: string;
  assinatura_imagem?: string;
  assinatura_observacao?: string;
};

const Contratos = () => {
  const { user } = useAuth();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [modelos, setModelos] = useState<{ id: string; nome: string; conteudo: string }[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [companies, setCompanies] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [vendedores, setVendedores] = useState<{ id: string; nome: string }[]>([]);
  const [enviandoVendedor, setEnviandoVendedor] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contrato | null>(null);

  const [clienteId, setClienteId] = useState("");
  const [modeloId, setModeloId] = useState("");
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().split("T")[0]);
  const [dataVencimento, setDataVencimento] = useState("");
  const [valorDisplay, setValorDisplay] = useState("");
  const [valorNum, setValorNum] = useState(0);
  const [taxaImplantacaoDisplay, setTaxaImplantacaoDisplay] = useState("");
  const [taxaImplantacaoNum, setTaxaImplantacaoNum] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [formaReajuste, setFormaReajuste] = useState("");
  const [modeloEquipamento, setModeloEquipamento] = useState("");
  const [prazoContrato, setPrazoContrato] = useState("");
  const [conteudoPersonalizado, setConteudoPersonalizado] = useState("");
  const [savingTexto, setSavingTexto] = useState(false);
  const [vendedorId, setVendedorId] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph", "tableCell"] }),
      TextStyle,
      FontFamily.configure({ types: ["textStyle"] }),
      Color,
      FontSize,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: true, allowBase64: false }),
      Table2.configure({ resizable: false, allowTableNodeSelection: false }),
      TableRow2,
      TableHeader2,
      TableCell2,
    ],
    content: "",
    onUpdate: ({ editor }) => setConteudoPersonalizado(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none font-serif text-slate-800 min-h-[400px] px-8 py-6",
      },
    },
  });

  // Preview state
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [gridPreviewHtml, setGridPreviewHtml] = useState<string>("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLoadingGridPreview, setIsLoadingGridPreview] = useState(false);
  // Modal ajuste solicitado
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [ajusteContrato, setAjusteContrato] = useState<Contrato | null>(null);
  const [enviandoLink, setEnviandoLink] = useState<string | null>(null);
  const [linkGerado, setLinkGerado] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("form");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.ceil(contratos.length / pageSize);
  const paginatedContratos = contratos.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    load();
    loadDependencies();

    const onFocus = () => load();
    const onVisibility = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const load = async () => {
    const { data } = await supabase
      .from("contratos")
      .select("*, clientes(nome), modelos(nome, conteudo), assinatura_status, assinatura_token, assinatura_link, assinatura_nome, assinatura_data, assinatura_imagem, assinatura_observacao, conteudo_personalizado")
      .order("created_at", { ascending: false });
    setContratos(data || []);
  };

  const loadDependencies = async () => {
    const [resClientes, resModelos, resCompanies, resVendedores] = await Promise.all([
      supabase.from("clientes").select("id, nome").order("nome"),
      supabase.from("modelos").select("id, nome, conteudo").order("nome"),
      supabase.from("company_settings").select("*").order("created_at", { ascending: true }),
      supabase.from("vendedores").select("id, nome").eq("ativo", true).order("nome"),
    ]);
    setClientes(resClientes.data || []);
    setModelos(resModelos.data || []);
    setVendedores(resVendedores.data || []);
    const comps = resCompanies.data || [];
    setCompanies(comps);
    const defComp = comps.find((c: any) => c.is_default) || comps[0];
    if (defComp) {
      setCompanyId(defComp.id);
      setCompany(defComp);
    }
  };

  const handleValorChange = (displayVal: string) => {
    const masked = maskCurrency(displayVal);
    setValorDisplay(masked);
    setValorNum(unmaskCurrency(masked));
  };

  const handleTaxaImplantacaoChange = (displayVal: string) => {
    const masked = maskCurrency(displayVal);
    setTaxaImplantacaoDisplay(masked);
    setTaxaImplantacaoNum(unmaskCurrency(masked));
  };

  const resetForm = () => {
    setEditing(null);
    setActiveTab("form");
    setClienteId("");
    setModeloId("");
    setDataEmissao(new Date().toISOString().split("T")[0]);
    setDataVencimento("");
    setValorDisplay("");
    setValorNum(0);
    setTaxaImplantacaoDisplay("");
    setTaxaImplantacaoNum(0);
    setFormaPagamento("");
    setFormaReajuste("");
    setModeloEquipamento("");
    setPrazoContrato("");
    setConteudoPersonalizado("");
    setPreviewHtml("");
    setVendedorId("");
    editor?.commands.setContent("");
  };

  const handleSave = async () => {
    if (!clienteId) return toast({ title: "Selecione o cliente", variant: "destructive" });
    if (!modeloId) return toast({ title: "Selecione o modelo", variant: "destructive" });
    if (!dataEmissao) return toast({ title: "Informe a data de emissão", variant: "destructive" });

    const payload = {
      cliente_id: clienteId,
      modelo_id: modeloId,
      company_id: companyId || null,
      vendedor_id: vendedorId || null,
      data_emissao: dataEmissao,
      data_vencimento: dataVencimento || null,
      valor: valorNum,
      taxa_implantacao: taxaImplantacaoNum,
      forma_pagamento: formaPagamento,
      forma_reajuste: formaReajuste,
      modelo_equipamento: modeloEquipamento,
      prazo_contrato: prazoContrato,
      conteudo_personalizado: conteudoPersonalizado || null,
      created_by: user?.id,
    };

    if (editing) {
      const { error } = await supabase.from("contratos").update(payload).eq("id", editing.id);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
      toast({ title: "Contrato atualizado!" });
      if (editing.assinatura_status === "recusado") {
        await handleEnviarAssinatura(editing);
        setActiveTab("editar");
        load();
        return;
      }
    } else {
      const { error } = await supabase.from("contratos").insert(payload);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
      toast({ title: "Contrato registrado!" });
    }

    setOpen(false);
    resetForm();
    load();
  };

  const handleEdit = (c: Contrato) => {
    setEditing(c);
    setClienteId(c.cliente_id || "");
    setModeloId(c.modelo_id || "");
    setDataEmissao(c.data_emissao);
    setDataVencimento(c.data_vencimento || "");
    setValorNum(Number(c.valor || 0));
    setValorDisplay(c.valor ? formatCurrency(Number(c.valor)) : "");
    setTaxaImplantacaoNum(Number(c.taxa_implantacao || 0));
    setTaxaImplantacaoDisplay(c.taxa_implantacao ? formatCurrency(Number(c.taxa_implantacao)) : "");
    setFormaPagamento(c.forma_pagamento || "");
    setFormaReajuste(c.forma_reajuste || "");
    setModeloEquipamento(c.modelo_equipamento || "");
    setPrazoContrato(c.prazo_contrato || "");
    setVendedorId((c as any).vendedor_id || "");
    const cp = c.conteudo_personalizado || "";
    setConteudoPersonalizado(cp);
    editor?.commands.setContent(cp);
    setActiveTab("form");
    setOpen(true);
    setPreviewHtml("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este contrato?")) return;
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Contrato excluído!" });
    load();
  };

  const buildContratoPreview = async (c: Contrato) => {
    // Se tem conteúdo personalizado, usa direto sem variáveis
    if (c.conteudo_personalizado) {
      return { conteudo: c.conteudo_personalizado, error: null };
    }
    if (!c.modelos?.conteudo) {
      return { conteudo: "", error: "Modelo sem conteúdo ou não encontrado." };
    }
    return previewContrato({
      conteudo: c.modelos.conteudo,
      cliente_id: c.cliente_id || undefined,
      valor: Number(c.valor),
      taxa_implantacao: Number(c.taxa_implantacao || 0),
      forma_pagamento: c.forma_pagamento || undefined,
      forma_reajuste: c.forma_reajuste || undefined,
      modelo_equipamento: c.modelo_equipamento || undefined,
      prazo_contrato: c.prazo_contrato || undefined,
      data_emissao: c.data_emissao,
      data_vencimento: c.data_vencimento || undefined,
    });
  };

  const handleViewContrato = async (c: Contrato) => {
    setPreviewTitle(c.clientes?.nome || "Visualizar Contrato");
    setPreviewOpen(true);
    setIsLoadingGridPreview(true);
    setGridPreviewHtml("");

    const { conteudo, error } = await buildContratoPreview(c);
    setIsLoadingGridPreview(false);

    if (error) {
      toast({ title: "Erro ao gerar preview", description: error, variant: "destructive" });
      setGridPreviewHtml("Erro ao carregar pré-visualização.");
      return;
    }

    // Always show signature block — fetch empresa data if contract has a token, else use local company state
    let contratoData: any = null;
    if (c.assinatura_token) {
      try {
        const dataRes = await fetch(`/api/public/assinar/${c.assinatura_token}`);
        if (dataRes.ok) contratoData = (await dataRes.json()).contrato;
      } catch { /* use company fallback below */ }
    }
    if (!contratoData && company) {
      contratoData = {
        empresa_nome: company.name || "",
        empresa_nome_responsavel: company.nome_responsavel || "",
        empresa_cargo_responsavel: company.cargo_responsavel || "",
        empresa_assinatura_imagem: company.assinatura_imagem || "",
      };
    }
    setGridPreviewHtml(conteudo + buildAssinaturaBlockHtml(c, contratoData));
  };

  const buildAssinaturaBlockHtml = (c: Contrato, contratoData: any) => {
    const empresaAssinatura = contratoData?.empresa_assinatura_imagem
      ? `<img src="${contratoData.empresa_assinatura_imagem}" style="max-height:60px;display:block;margin:0 auto 6px;padding:4px;background:#fff;border:1px solid #cbd5e1;border-radius:4px;" />`
      : `<div style="height:50px;border-bottom:1px solid #64748b;margin-bottom:6px;"></div>`;

    const contratanteAssinatura = c.assinatura_imagem
      ? `<img src="${c.assinatura_imagem}" style="max-height:60px;display:block;margin:0 auto 6px;padding:4px;background:#fff;border:1px solid #cbd5e1;border-radius:4px;" />`
      : `<div style="height:50px;border-bottom:1px solid #64748b;margin-bottom:6px;"></div>`;

    const contratanteNome = c.assinatura_nome
      ? `<div style="font-size:13px;font-weight:600;color:#1e293b;">${c.assinatura_nome}</div><div style="font-size:12px;color:#475569;">${c.assinatura_data ? new Date(c.assinatura_data).toLocaleString("pt-BR") : "Aguardando assinatura"}</div>`
      : `<div style="font-size:12px;color:#64748b;">Aguardando assinatura</div>`;

    return `
      <div style="margin-top:50px;border-top:2px solid #e2e8f0;padding-top:20px;display:flex;justify-content:space-between;gap:30px;white-space:normal;">
        <div style="flex:1;text-align:center;padding:15px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
          <div style="font-weight:bold;font-size:13px;margin-bottom:10px;">Contratada</div>
          ${empresaAssinatura}
          <div style="font-size:13px;font-weight:600;color:#1e293b;">${contratoData?.empresa_nome || ""}</div>
          ${contratoData?.empresa_nome_responsavel ? `<div style="font-size:12px;color:#475569;">${contratoData.empresa_nome_responsavel}${contratoData.empresa_cargo_responsavel ? ` — ${contratoData.empresa_cargo_responsavel}` : ""}</div>` : ""}
        </div>
        <div style="flex:1;text-align:center;padding:15px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
          <div style="font-weight:bold;font-size:13px;margin-bottom:10px;">Contratante</div>
          ${contratanteAssinatura}
          ${contratanteNome}
        </div>
      </div>
    `;
  };

  const printContratoHtml = (html: string, title: string) => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast({ title: "Bloqueio de pop-up", description: "Permita pop-ups para imprimir o contrato.", variant: "destructive" });
      return;
    }
    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <title>${title}</title>
    <style>
      @page { margin: 18mm; }
      body { font-family: Georgia, 'Times New Roman', serif; color: #1e293b; font-size: 13px; line-height: 1.7; }
      .documento { white-space: pre-wrap; text-align: justify; }
      .documento img { max-width: 100%; height: auto; }
      .documento img[alt=""] { max-height: 80px; max-width: 200px; object-fit: contain; }
      .documento table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 8px 0; }
      .documento th, .documento td { border: 1px solid #94a3b8; padding: 6px 10px; vertical-align: top; }
      .documento th { background-color: #f1f5f9; font-weight: 600; text-align: left; }
    </style>
  </head>
  <body><div class="documento">${html}</div></body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handlePrintContrato = async (c: Contrato) => {
    const { conteudo, error } = await buildContratoPreview(c);
    if (error) return toast({ title: "Erro ao gerar impressão", description: error, variant: "destructive" });

    let contratoData: any = null;
    if (c.assinatura_token) {
      try {
        const dataRes = await fetch(`/api/public/assinar/${c.assinatura_token}`);
        if (dataRes.ok) contratoData = (await dataRes.json()).contrato;
      } catch { /* use company fallback */ }
    }
    if (!contratoData && company) {
      contratoData = {
        empresa_nome: company.name || "",
        empresa_nome_responsavel: company.nome_responsavel || "",
        empresa_cargo_responsavel: company.cargo_responsavel || "",
        empresa_assinatura_imagem: company.assinatura_imagem || "",
      };
    }
    printContratoHtml(conteudo + buildAssinaturaBlockHtml(c, contratoData), `Contrato - ${c.clientes?.nome || "Cliente"}`);
  };

  const generatePreview = async () => {
    if (!modeloId) {
      setPreviewHtml("Selecione um modelo para visualizar.");
      return;
    }
    const modelo = modelos.find((m) => m.id === modeloId);
    if (!modelo) return;

    setIsLoadingPreview(true);
    const { conteudo, error } = await previewContrato({
      conteudo: modelo.conteudo,
      cliente_id: clienteId || undefined,
      valor: valorNum,
      taxa_implantacao: taxaImplantacaoNum,
      forma_pagamento: formaPagamento || undefined,
      forma_reajuste: formaReajuste || undefined,
      modelo_equipamento: modeloEquipamento || undefined,
      prazo_contrato: prazoContrato || undefined,
      data_emissao: dataEmissao,
      data_vencimento: dataVencimento,
    });
    setIsLoadingPreview(false);

    if (error) {
      toast({ title: "Erro ao gerar preview", description: error, variant: "destructive" });
      setPreviewHtml("Erro ao carregar pré-visualização.");
    } else {
      setPreviewHtml(conteudo);
    }
  };

  const handleEnviarAssinatura = async (c: Contrato) => {
    setEnviandoLink(c.id);
    const { link, whatsapp_enviado, error } = await enviarParaAssinatura(c.id);
    setEnviandoLink(null);
    if (error) return toast({ title: "Erro ao gerar link", description: error, variant: "destructive" });
    setLinkGerado(prev => ({ ...prev, [c.id]: link }));
    if (whatsapp_enviado) {
      toast({ title: "Link enviado por WhatsApp!", description: `Cliente: ${c.clientes?.nome || ""}` });
    } else {
      toast({ title: "Link gerado!", description: "WhatsApp não configurado. Copie o link abaixo." });
    }
    load();
  };

  const copiarLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Link copiado!" });
  };

  const handleDownloadContrato = async (c: Contrato) => {
    if (!c.assinatura_token) return;
    toast({ title: "Gerando PDF, aguarde..." });

    const [previewRes, dataRes] = await Promise.all([
      fetch(`/api/public/assinar/${c.assinatura_token}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      fetch(`/api/public/assinar/${c.assinatura_token}`),
    ]);
    if (!previewRes.ok || !dataRes.ok) {
      return toast({ title: "Erro ao gerar documento", variant: "destructive" });
    }
    const { conteudo } = await previewRes.json();
    const { contrato: contratoData } = await dataRes.json();

    const empresaAssinatura = contratoData.empresa_assinatura_imagem
      ? `<img src="${contratoData.empresa_assinatura_imagem}" style="max-height:60px;display:block;margin:0 auto 6px;padding:4px;background:#fff;border:1px solid #cbd5e1;border-radius:4px;" crossorigin="anonymous" />`
      : `<div style="height:50px;border-bottom:1px solid #64748b;margin-bottom:6px;"></div>`;

    const contratanteAssinaturaDownload = c.assinatura_imagem
      ? `<img src="${c.assinatura_imagem}" style="max-height:60px;display:block;margin:0 auto 6px;padding:4px;background:#fff;border:1px solid #cbd5e1;border-radius:4px;" crossorigin="anonymous" />`
      : `<div style="height:50px;border-bottom:1px solid #64748b;margin-bottom:6px;"></div>`;

    const contratanteNomeDownload = c.assinatura_nome
      ? `<div style="font-size:13px;font-weight:600;color:#1e293b;">${c.assinatura_nome}</div><div style="font-size:12px;color:#475569;">${c.assinatura_data ? new Date(c.assinatura_data).toLocaleString("pt-BR") : ""}</div>`
      : `<div style="font-size:12px;color:#64748b;">Aguardando assinatura</div>`;

    const assinaturaHtml = `
      <div style="margin-top:50px;border-top:2px solid #e2e8f0;padding-top:20px;display:flex;justify-content:space-between;gap:30px;">
        <div style="flex:1;text-align:center;padding:15px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
          <div style="font-weight:bold;font-size:13px;margin-bottom:10px;">Contratada</div>
          ${empresaAssinatura}
          <div style="font-size:13px;font-weight:600;color:#1e293b;">${contratoData.empresa_nome || ""}</div>
          ${contratoData.empresa_nome_responsavel ? `<div style="font-size:12px;color:#475569;">${contratoData.empresa_nome_responsavel}${contratoData.empresa_cargo_responsavel ? ` — ${contratoData.empresa_cargo_responsavel}` : ""}</div>` : ""}
        </div>
        <div style="flex:1;text-align:center;padding:15px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
          <div style="font-weight:bold;font-size:13px;margin-bottom:10px;">Contratante</div>
          ${contratanteAssinaturaDownload}
          ${contratanteNomeDownload}
        </div>
      </div>
    `;

    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;background:#fff;padding:40px 50px;box-sizing:border-box;";
    container.innerHTML = `
      <style>
        .doc-pdf { font-family: Georgia, 'Times New Roman', serif; color: #1e293b; font-size: 13px; line-height: 1.7; text-align: justify; white-space: normal; }
        .doc-pdf p { margin: 0 0 10px; }
        .doc-pdf h1, .doc-pdf h2, .doc-pdf h3 { margin: 16px 0 8px; font-weight: bold; }
        .doc-pdf img { max-width: 100%; height: auto; }
        .doc-pdf table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 8px 0; }
        .doc-pdf th, .doc-pdf td { border: 1px solid #94a3b8; padding: 6px 10px; vertical-align: top; }
        .doc-pdf th { background-color: #f1f5f9; font-weight: bold; text-align: left; }
      </style>
      <div class="doc-pdf">${conteudo}</div>
      ${assinaturaHtml}
    `;
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

      pdf.save(`contrato-${c.clientes?.nome || "assinado"}.pdf`);
    } catch {
      if (document.body.contains(container)) document.body.removeChild(container);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    }
  };

  const handleVerAjuste = (c: Contrato) => {
    setAjusteContrato(c);
    setAjusteOpen(true);
  };

  const loadEditorContent = async () => {
    if (conteudoPersonalizado) return;
    if (!modeloId) return;
    const modelo = modelos.find((m) => m.id === modeloId);
    if (!modelo) return;
    const { conteudo } = await previewContrato({
      conteudo: modelo.conteudo,
      cliente_id: clienteId || undefined,
      valor: valorNum,
      taxa_implantacao: taxaImplantacaoNum,
      forma_pagamento: formaPagamento || undefined,
      forma_reajuste: formaReajuste || undefined,
      modelo_equipamento: modeloEquipamento || undefined,
      prazo_contrato: prazoContrato || undefined,
      data_emissao: dataEmissao,
      data_vencimento: dataVencimento,
    });
    if (conteudo) {
      setConteudoPersonalizado(conteudo);
      editor?.commands.setContent(conteudo);
    }
  };

  const handleSaveTexto = async () => {
    if (!editing) return;
    setSavingTexto(true);
    const { error } = await supabase
      .from("contratos")
      .update({ conteudo_personalizado: conteudoPersonalizado || null })
      .eq("id", editing.id);
    setSavingTexto(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    toast({ title: "Texto do contrato salvo!" });
    load();
  };

  const badgeAssinatura = (status?: string) => {
    if (!status || status === "pendente") return null;
    if (status === "enviado") return <Badge variant="outline" className="text-amber-700 border-amber-400 text-[10px]"><Clock className="h-3 w-3 mr-1" />Aguardando</Badge>;
    if (status === "assinado") return <Badge className="bg-emerald-600 text-white text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Assinado</Badge>;
    if (status === "recusado") return <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-1" />Ajuste solicitado</Badge>;
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Contratos</h2>
          <p className="text-sm text-muted-foreground">Emissão e controle de documentos contratuais.</p>
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
              <Plus className="mr-2 h-4 w-4" /> Novo Contrato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5 text-violet-600" />
                {editing ? "Editar Contrato" : "Novo Contrato"}
              </DialogTitle>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === "preview") generatePreview(); if (v === "editar") loadEditorContent(); }} className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="form">Dados do Contrato</TabsTrigger>
                <TabsTrigger value="editar" className="flex items-center gap-2">
                  <Pencil className="h-4 w-4" /> Editar Texto
                </TabsTrigger>
                <TabsTrigger value="preview" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" /> Visualizar Documento
                </TabsTrigger>
              </TabsList>

              <TabsContent value="form" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Empresa Emissora</Label>
                    <Select value={companyId} onValueChange={(val) => { setCompanyId(val); setCompany(companies.find(c => c.id === val)); }}>
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
                    <Label>Cliente *</Label>
                    <SearchableClientSelect
                      clients={clientes}
                      value={clienteId}
                      onValueChange={setClienteId}
                      placeholder="Pesquisar ou selecionar cliente..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Modelo de Contrato</Label>
                    <Select value={modeloId} onValueChange={setModeloId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o modelo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {modelos.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Label>Data de Emissão</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal", !dataEmissao && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dataEmissao ? format(new Date(dataEmissao + "T12:00:00"), "dd/MM/yyyy") : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dataEmissao ? new Date(dataEmissao + "T12:00:00") : undefined}
                          onSelect={(date) => {
                            if (date) setDataEmissao(format(date, "yyyy-MM-dd"));
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Data de Vencimento (Opcional)</Label>
                    <Input value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} placeholder="Ex.: Todo dia 10, ou 10/05/2024" />
                  </div>

                  <div className="space-y-2">
                    <Label>Valor do Contrato (R$)</Label>
                    <Input value={valorDisplay} onChange={(e) => handleValorChange(e.target.value)} placeholder="0,00" />
                  </div>

                  <div className="space-y-2">
                    <Label>Taxa de Implantação (R$)</Label>
                    <Input value={taxaImplantacaoDisplay} onChange={(e) => handleTaxaImplantacaoChange(e.target.value)} placeholder="0,00" />
                  </div>

                  <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <Input value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} placeholder="Ex.: Boleto mensal, PIX, cartão" />
                  </div>

                  <div className="space-y-2">
                    <Label>Forma de Reajuste Anual</Label>
                    <Input value={formaReajuste} onChange={(e) => setFormaReajuste(e.target.value)} placeholder="Ex.: IPCA, IGP-M, sem reajuste" />
                  </div>

                  <div className="space-y-2">
                    <Label>Modelo do Equipamento</Label>
                    <Input value={modeloEquipamento} onChange={(e) => setModeloEquipamento(e.target.value)} placeholder="Ex.: POS Android X, Tablet Y" />
                  </div>

                  <div className="space-y-2">
                    <Label>Prazo do Contrato</Label>
                    <Input value={prazoContrato} onChange={(e) => setPrazoContrato(e.target.value)} placeholder="Ex.: 12 meses, indeterminado" />
                  </div>
                </div>

                <div className="pt-4 border-t flex justify-end">
                  <Button onClick={handleSave} className="w-full md:w-auto">
                    Salvar Contrato
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="editar" className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">
                  O texto abaixo substitui o modelo original apenas para este contrato. Edite livremente. Se estiver vazio, clique em "Carregar do modelo" para preencher com as variáveis já preenchidas.
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadEditorContent}>
                      <RefreshCw className="h-3 w-3 mr-2" /> Carregar do modelo
                    </Button>
                    {conteudoPersonalizado && (
                      <Button variant="ghost" size="sm" onClick={() => { setConteudoPersonalizado(""); editor?.commands.setContent(""); }} className="text-destructive">
                        Limpar personalização
                      </Button>
                    )}
                  </div>
                  {editing && (
                    <Button size="sm" onClick={handleSaveTexto} disabled={savingTexto}>
                      {savingTexto ? "Salvando..." : "Salvar texto"}
                    </Button>
                  )}
                </div>
                <div className="rounded-md border bg-slate-50 overflow-hidden shadow-inner">
                  <ModeloToolbar editor={editor} />
                  <div className="bg-white min-h-[400px]">
                    {!conteudoPersonalizado && (
                      <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                        Clique em "Carregar do modelo" para começar a editar o texto do contrato.
                      </div>
                    )}
                    <EditorContent editor={editor} />
                  </div>
                </div>
                {editing && (() => {
                  const c = contratos.find((x) => x.id === editing.id) ?? editing;
                  const linkAtual = linkGerado[c.id] || c.assinatura_link || "";
                  return (
                    <div className="pt-3 border-t space-y-2">
                      <p className="text-xs font-medium text-slate-600">Envio para assinatura</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {(c.assinatura_status === "pendente" || c.assinatura_status === "recusado") && !linkGerado[c.id] && (
                          <Button variant="outline" size="sm" onClick={() => handleEnviarAssinatura(c)} disabled={enviandoLink === c.id}>
                            <Send className="h-3 w-3 mr-2" />
                            {enviandoLink === c.id ? "Enviando..." : "Enviar por WhatsApp"}
                          </Button>
                        )}
                        {(linkGerado[c.id] || c.assinatura_status === "enviado" || c.assinatura_status === "assinado") && linkAtual && (
                          <Button variant="outline" size="sm" onClick={() => copiarLink(linkAtual)}>
                            <Copy className="h-3 w-3 mr-2" /> Copiar link
                          </Button>
                        )}
                        {badgeAssinatura(c.assinatura_status)}
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="preview" className="min-h-[400px]">
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50 border-b px-4 py-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Pré-visualização do Documento</span>
                    <Button variant="ghost" size="sm" onClick={generatePreview} disabled={isLoadingPreview}>
                      <RefreshCw className={cn("h-4 w-4 mr-2", isLoadingPreview && "animate-spin")} /> Atualizar
                    </Button>
                  </div>
                  <CardContent className="p-6 bg-white min-h-[350px]">
                    {isLoadingPreview ? (
                      <div className="flex h-full items-center justify-center text-muted-foreground">Gerando documento...</div>
                    ) : previewHtml ? (
                      <div
                        className="rounded-md border bg-white p-6 font-serif text-sm leading-7 text-slate-800 whitespace-pre-wrap text-justify"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        Selecione um modelo e preencha os dados para visualizar.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data Emissão</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Assinatura</TableHead>
              <TableHead className="w-[200px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedContratos.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{format(new Date(c.data_emissao + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                <TableCell className="font-medium">{c.clientes?.nome || "-"}</TableCell>
                <TableCell>{c.modelos?.nome || "-"}</TableCell>
                <TableCell>R$ {formatCurrency(Number(c.valor || 0))}</TableCell>
                <TableCell>
                  {c.data_vencimento || "-"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    {badgeAssinatura(c.assinatura_status)}
                    {c.assinatura_status === "recusado" && c.assinatura_observacao && (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] w-full border-amber-400 text-amber-700 hover:bg-amber-50" onClick={() => handleVerAjuste(c)}>
                        <MessageSquare className="h-3 w-3 mr-1" /> Ver ajuste
                      </Button>
                    )}
                    {c.assinatura_status === "pendente" && !linkGerado[c.id] && (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] w-full" onClick={() => handleEnviarAssinatura(c)} disabled={enviandoLink === c.id}>
                        <Send className="h-3 w-3 mr-1" /> Assinar
                      </Button>
                    )}
                    {(linkGerado[c.id] || c.assinatura_status === "enviado" || c.assinatura_status === "assinado") && (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] w-full" onClick={() => copiarLink(linkGerado[c.id] || c.assinatura_link || "")}>
                        <Copy className="h-3 w-3 mr-1" /> Copiar link
                      </Button>
                    )}
                    {c.assinatura_status === "assinado" && (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] w-full border-emerald-400 text-emerald-700 hover:bg-emerald-50" onClick={() => handleDownloadContrato(c)}>
                        <Download className="h-3 w-3 mr-1" /> Baixar
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    <Button variant="ghost" size="icon" onClick={() => handleViewContrato(c)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handlePrintContrato(c)}>
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {c.assinatura_status === "assinado" && (
                      <Button variant="ghost" size="icon" title="Baixar contrato assinado" onClick={() => handleDownloadContrato(c)}>
                        <Download className="h-4 w-4 text-emerald-600" />
                      </Button>
                    )}
                    {(c as any).vendedor_id && (
                      <Button
                        variant="ghost" size="icon"
                        title="Notificar vendedor por WhatsApp"
                        disabled={enviandoVendedor === c.id}
                        onClick={async () => {
                          setEnviandoVendedor(c.id);
                          const r = await notifyVendedor("contrato", c.id, "contrato_assinatura", "whatsapp");
                          setEnviandoVendedor(null);
                          if (r.success) toast({ title: "Vendedor notificado por WhatsApp!" });
                          else toast({ title: "Erro ao notificar", description: r.error, variant: "destructive" });
                        }}
                      >
                        <MessageSquare className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {contratos.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum contrato cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={contratos.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contrato - {previewTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={!gridPreviewHtml || isLoadingGridPreview}
              onClick={() => printContratoHtml(gridPreviewHtml, `Contrato - ${previewTitle || "Cliente"}`)}
            >
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
          </div>
          <div className="rounded-md border bg-white p-6 font-serif text-sm leading-7 text-slate-800 whitespace-pre-wrap text-justify min-h-[320px]">
            {isLoadingGridPreview ? (
              <div className="flex h-full items-center justify-center text-muted-foreground py-12">Gerando documento...</div>
            ) : gridPreviewHtml ? (
              <div dangerouslySetInnerHTML={{ __html: gridPreviewHtml }} />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground py-12">Nenhum conteúdo gerado.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuste solicitado</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {ajusteContrato?.assinatura_nome && (
              <p className="mb-2">
                <span className="font-medium text-foreground">{ajusteContrato.assinatura_nome}</span>
                {ajusteContrato.assinatura_data && ` em ${format(new Date(ajusteContrato.assinatura_data), "dd/MM/yyyy 'às' HH:mm")}`}
              </p>
            )}
            <p className="whitespace-pre-wrap rounded-md border bg-amber-50 p-3 text-slate-800">
              {ajusteContrato?.assinatura_observacao || "Nenhuma observação informada."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Contratos;
