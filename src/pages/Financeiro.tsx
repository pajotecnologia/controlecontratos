import { useEffect, useState } from "react";
import { supabase, notify, sendReceipt, sendCobrancaSimples, getMessageTemplates, getAsaasSettings, criarCobrancaAsaas, consultarCobrancaAsaas, enviarCobrancaAsaas, agendarEnvio } from "@/integrations/api/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, X, CalendarIcon, ChevronLeft, ChevronRight, MessageCircle, Mail, MoreVertical, ReceiptText, Send, Printer, CreditCard, QrCode, Copy, ExternalLink, RefreshCw, SquarePen, ArrowDownLeft, ArrowUpRight, BarChart3, Tag } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { maskCurrency, unmaskCurrency, formatCurrency } from "@/lib/masks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContasPagarTab } from "@/components/ContasPagarTab";
import { FluxoCaixaTab } from "@/components/FluxoCaixaTab";
import { CategoriasDespesaTab } from "@/components/CategoriasDespesaTab";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Vendedor = { id: string; nome: string; comissao_padrao: number; whatsapp: string | null };
type Cliente = { id: string; nome: string };
type ContratoVendedor = { vendedor_id: string; percentual: number; valor_comissao: number };
type Parcela = {
  id?: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  mes_referencia?: string;
  data_pagamento?: string | null;
  pago: boolean;
  numero_nf?: string | null;
  observacao?: string | null;
  asaas_cobranca_id?: string | null;
  asaas_status?: string | null;
  asaas_boleto_url?: string | null;
  asaas_pix_qr_code?: string | null;
  asaas_pix_copy_paste?: string | null;
  asaas_invoice_url?: string | null;
};

const sendNotification = async (vvId: string, template_type: "nova_venda" | "pagamento", channel: "whatsapp" | "email" | "both" = "both") => {
  try {
    const body = { venda_vendedor_id: vvId, template_type };
    const promises: Promise<any>[] = [];
    if (channel === "whatsapp" || channel === "both") promises.push(notify("whatsapp", body));
    if (channel === "email" || channel === "both") promises.push(notify("email", body));
    await Promise.allSettled(promises);
  } catch {
    // silent
  }
};

const buildReciboHtml = (contrato: any, parcela: any, company: any) => {
  const comp = company || {};
  let logoHtml = "";
  if (comp.logo_url) {
    let src = comp.logo_url;
    if (src.startsWith("/")) src = `${window.location.protocol}//${window.location.host}${src}`;
    logoHtml = `<img src="${src}" alt="Logo" style="max-height:80px;max-width:200px;object-fit:contain;margin-bottom:8px;" />`;
  }
  const compEndereco = [comp.endereco, comp.bairro, comp.cidade, comp.cep ? `CEP: ${comp.cep}` : ""].filter(Boolean).join(" - ");
  const compContato = [comp.telefone ? `Tel.: ${comp.telefone}` : "", comp.email ? `Email: ${comp.email}` : ""].filter(Boolean).join(" | ");
  const dataEmissao = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const dataPag = parcela.data_pagamento
    ? format(new Date(parcela.data_pagamento), "dd/MM/yyyy", { locale: ptBR })
    : "-";
  const dataVenc = parcela.data_vencimento
    ? format(new Date(parcela.data_vencimento + "T12:00:00"), "dd/MM/yyyy")
    : "-";
  const cli = contrato.clientes || {};
  const nomeCliente = cli.nome || contrato.cliente || "-";
  const valorFmt = Number(parcela.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const isPago = Boolean(parcela.pago);

  return `
    <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 10px; max-width: 800px; margin: 0 auto;">
      <!-- Cabeçalho idêntico à Proposta Comercial -->
      <div style="text-align: center; border-bottom: 2px solid #334155; padding-bottom: 12px; margin-bottom: 20px;">
        ${logoHtml}
        <div style="font-size: 18px; font-weight: bold; color: #0f172a;">${comp.name || "Sua Empresa"}</div>
        <div style="font-size: 12px; color: #64748b;">
          ${comp.cnpj ? `CNPJ: ${comp.cnpj}` : ""} ${compEndereco ? ` | ${compEndereco}` : ""}
        </div>
        ${compContato ? `<div style="font-size: 12px; color: #64748b;">${compContato}</div>` : ""}
      </div>

      <!-- Título -->
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="font-size: 22px; margin: 0 0 5px 0; font-weight: bold; color: #0f172a;">
          ${isPago ? "RECIBO DE PAGAMENTO" : "DEMONSTRATIVO DE PARCELA (EM ABERTO)"}
        </h1>
        <div style="font-size: 13px; color: #64748b;">
          Parcela ${parcela.numero_parcela} de ${contrato.qtde_parcelas || 1}${parcela.mes_referencia ? ` — ${parcela.mes_referencia}` : ""}
        </div>
        <div style="font-size: 12px; color: #64748b;">Emitido em ${dataEmissao}</div>
      </div>

      <!-- Dados do Cliente -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin-bottom: 25px; font-size: 13px;">
        <div style="font-weight: bold; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 8px; color: #0f172a;">DADOS DO CLIENTE</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <div><strong>Cliente:</strong> ${nomeCliente}</div>
          <div><strong>CPF/CNPJ:</strong> ${cli.cpf_cnpj || "-"}</div>
          <div><strong>Endereço:</strong> ${cli.endereco || "-"}</div>
          <div><strong>Telefone:</strong> ${cli.telefone || "-"}</div>
          <div><strong>E-mail:</strong> ${cli.email || "-"}</div>
          <div><strong>Status da Parcela:</strong> ${isPago ? "<span style='color:#16a34a;font-weight:bold;'>QUITADA</span>" : "<span style='color:#d97706;font-weight:bold;'>EM ABERTO</span>"}</div>
        </div>
      </div>

      <!-- Tabela de Lançamento -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-weight: bold;">Descrição do Contrato / Lançamento</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold; width: 90px;">Parcela</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold; width: 110px;">Vencimento</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold; width: 120px;">Pagamento</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-weight: bold; width: 120px;">Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 10px;">
              Contrato: ${contrato.cliente || "Serviço Prestado"}${parcela.mes_referencia ? ` (${parcela.mes_referencia})` : ""}
            </td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${parcela.numero_parcela}ª / ${contrato.qtde_parcelas || 1}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${dataVenc}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${isPago ? (dataPag !== "-" ? dataPag : "Quitada") : "Em aberto"}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">R$ ${valorFmt}</td>
          </tr>
          <tr style="font-weight: bold; background-color: #f8fafc;">
            <td colspan="4" style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-size: 14px;">VALOR TOTAL DA PARCELA:</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-size: 14px; color: #0f172a;">R$ ${valorFmt}</td>
          </tr>
        </tbody>
      </table>

      <!-- Observações / Detalhes de Pagamento -->
      ${(parcela.numero_nf || parcela.observacao || parcela.asaas_pix_copy_paste) ? `
      <div style="margin-bottom: 25px; font-size: 13px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px;">
        <div style="font-weight: bold; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 8px; color: #0f172a;">OBSERVAÇÕES E INFORMAÇÕES DE PAGAMENTO</div>
        ${parcela.numero_nf ? `<div style="margin-bottom:4px;"><strong>Nota Fiscal Nº:</strong> ${parcela.numero_nf}</div>` : ""}
        ${parcela.observacao ? `<div style="white-space: pre-wrap; color: #334155; margin-bottom:4px;"><strong>Observação:</strong> ${parcela.observacao}</div>` : ""}
        ${parcela.asaas_pix_copy_paste ? `<div style="margin-top:6px; background:#fff; border:1px dashed #cbd5e1; padding:8px; border-radius:4px;"><strong>Chave PIX Copia e Cola:</strong><br/><code style="font-size:11px; word-break:break-all;">${parcela.asaas_pix_copy_paste}</code></div>` : ""}
      </div>
      ` : ""}

      <!-- Declaração -->
      <div style="text-align: center; font-size: 13px; color: #475569; margin-bottom: 40px;">
        ${isPago
          ? `Declaramos para os devidos fins que recebemos de <strong>${nomeCliente}</strong> a importância de <strong>R$ ${valorFmt}</strong> referente à quitação da parcela ${parcela.numero_parcela}${parcela.mes_referencia ? ` (${parcela.mes_referencia})` : ""}.`
          : `Demonstrativo de cobrança referente à parcela ${parcela.numero_parcela}${parcela.mes_referencia ? ` (${parcela.mes_referencia})` : ""} no valor de <strong>R$ ${valorFmt}</strong> com vencimento em <strong>${dataVenc}</strong>.`
        }
      </div>

      <!-- Assinatura -->
      <div style="display: flex; justify-content: space-around; margin-top: 40px; text-align: center; font-size: 13px;">
        <div style="width: 250px;">
          ${comp.assinatura_imagem
            ? `<img src="${comp.assinatura_imagem}" style="max-height:60px;display:block;margin:0 auto 5px;" />`
            : `<div style="border-top: 1px solid #94a3b8; margin-bottom: 5px;"></div>`
          }
          <strong>${comp.name || "Assinatura da Empresa"}</strong>
          ${comp.nome_responsavel ? `<div style="font-size: 11px; color: #64748b;">${comp.nome_responsavel}</div>` : ""}
        </div>
        <div style="width: 250px;">
          <div style="border-top: 1px solid #94a3b8; margin-bottom: 5px;"></div>
          <strong>${nomeCliente}</strong>
          <div style="font-size: 11px; color: #64748b;">Assinatura do Cliente</div>
        </div>
      </div>
    </div>
  `;
};

const Financeiro = () => {
  const { isAdmin, user } = useAuth();
  const [contratos, setContratos] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [reciboHtml, setReciboHtml] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [valorServicoDisplay, setValorServicoDisplay] = useState("");
  const [valorServicoNum, setValorServicoNum] = useState(0);
  const [dataVenda, setDataVenda] = useState(new Date().toISOString().split("T")[0]);
  const [mesReferencia, setMesReferencia] = useState(MESES[new Date().getMonth()]);
  const [anoReferencia, setAnoReferencia] = useState(new Date().getFullYear());
  const [contratoVendedores, setContratoVendedores] = useState<ContratoVendedor[]>([]);
  const [sentNotifications, setSentNotifications] = useState<Record<string, Set<string>>>({});
  const [confirmSend, setConfirmSend] = useState<{ vvId: string; channel: "whatsapp" | "email"; templateType: "nova_venda" | "pagamento" } | null>(null);
  const [sendingReceipt, setSendingReceipt] = useState<string | null>(null);
  const [msgTemplates, setMsgTemplates] = useState<{ id: string; nome: string; evento: string; corpo: string; ativo_whatsapp: boolean; ativo_email: boolean }[]>([]);
  const [reciboSendDialog, setReciboSendDialog] = useState<{ parcelaId: string; canal: "whatsapp" | "email" } | null>(null);
  const [reciboSendTemplateId, setReciboSendTemplateId] = useState("");
  const [reciboSendMensagem, setReciboSendMensagem] = useState("");
  const [agendarRecibo, setAgendarRecibo] = useState(false);
  const [dataAgendamentoRecibo, setDataAgendamentoRecibo] = useState("");

  // Parcelas
  const [qtdeParcelas, setQtdeParcelas] = useState(1);
  const [valorParcelaDisplay, setValorParcelaDisplay] = useState("");
  const [valorParcelaNum, setValorParcelaNum] = useState(0);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(new Date().toISOString().split("T")[0]);
  const [parcelasPreview, setParcelasPreview] = useState<Parcela[]>([]);

  // Baixa de parcela
  const [baixaDialog, setBaixaDialog] = useState<{ contratoId: string; parcela: Parcela } | null>(null);
  const [baixaNumeroNf, setBaixaNumeroNf] = useState("");
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaObs, setBaixaObs] = useState("");

  // Desmarcar / corrigir parcela
  const [desmarcarDialog, setDesmarcarDialog] = useState<{ contratoId: string; parcela: Parcela } | null>(null);
  const [desmarcarNumeroNf, setDesmarcarNumeroNf] = useState("");
  const [desmarcarData, setDesmarcarData] = useState(new Date().toISOString().split("T")[0]);
  const [desmarcarObs, setDesmarcarObs] = useState("");
  const [desmarcarJustificativa, setDesmarcarJustificativa] = useState("");

  // ASAAS
  const [asaasAtivoSystem, setAsaasAtivoSystem] = useState(false);
  const [pixModal, setPixModal] = useState<{ qrCode?: string | null; copyPaste?: string | null; parcela: Parcela } | null>(null);
  const [cobrancaSendDialog, setCobrancaSendDialog] = useState<{ parcelaId: string; canal: "whatsapp" | "email" } | null>(null);
  const [cobrancaSendMensagem, setCobrancaSendMensagem] = useState("");
  const [sendingCobranca, setSendingCobranca] = useState<string | null>(null);
  const [generatingAsaas, setGeneratingAsaas] = useState<string | null>(null);
  const [checkingAsaas, setCheckingAsaas] = useState<string | null>(null);

  // Edição de parcela individual
  const [editParcelaDialog, setEditParcelaDialog] = useState<{ parcela: Parcela } | null>(null);
  const [editParcelaValorDisplay, setEditParcelaValorDisplay] = useState("");
  const [editParcelaValorNum, setEditParcelaValorNum] = useState(0);
  const [editParcelaVencimento, setEditParcelaVencimento] = useState("");
  const [editParcelaMesRef, setEditParcelaMesRef] = useState("");

  const [cobrancaSendTemplateId, setCobrancaSendTemplateId] = useState("");

  // Cobrança simples (sem ASAAS)
  const [cobrancaSimplesDialog, setCobrancaSimplesDialog] = useState<{ parcelaId: string; canal: "whatsapp" | "email" } | null>(null);
  const [cobrancaSimplesTemplateId, setCobrancaSimplesTemplateId] = useState("");
  const [cobrancaSimplesMensagem, setCobrancaSimplesMensagem] = useState("");
  const [sendingCobrancaSimples, setSendingCobrancaSimples] = useState<string | null>(null);
  const [agendarCobrancaSimples, setAgendarCobrancaSimples] = useState(false);
  const [dataAgendamentoCobrancaSimples, setDataAgendamentoCobrancaSimples] = useState("");

  const handleSendNotification = async (vvId: string, templateType: "nova_venda" | "pagamento", channel: "whatsapp" | "email") => {
    const alreadySent = sentNotifications[vvId]?.has(channel);
    if (alreadySent) {
      setConfirmSend({ vvId, channel, templateType });
      return;
    }
    await doSend(vvId, templateType, channel);
  };

  const doSend = async (vvId: string, templateType: "nova_venda" | "pagamento", channel: "whatsapp" | "email") => {
    await sendNotification(vvId, templateType, channel);
    setSentNotifications(prev => {
      const set = new Set(prev[vvId] || []);
      set.add(channel);
      return { ...prev, [vvId]: set };
    });
    toast({ title: channel === "whatsapp" ? "WhatsApp enviado!" : "Email enviado!" });
  };

  const abrirEnvioRecibo = (parcelaId: string, canal: "whatsapp" | "email") => {
    setReciboSendDialog({ parcelaId, canal });
    const templates = msgTemplates.filter((t) => t.evento === "recibo" && (canal === "email" ? t.ativo_email : t.ativo_whatsapp));
    const primeiro = templates[0];
    setReciboSendTemplateId(primeiro?.id || "");
    setReciboSendMensagem(primeiro?.corpo || "");
  };

  const templatesRecibo = (canal: "whatsapp" | "email") =>
    msgTemplates.filter((t) => t.evento === "recibo" && (canal === "email" ? t.ativo_email : t.ativo_whatsapp));

  const templatesCobranca = (canal: "whatsapp" | "email") =>
    msgTemplates.filter((t) => canal === "email" ? t.ativo_email : t.ativo_whatsapp);

  const MSG_PADRAO_COBRANCA = `Olá {{cliente}}, segue sua cobrança:\n\nParcela: {{parcela}}\nValor: R$ {{valor}}\nVencimento: {{vencimento}}`;

  const VARIAVEIS_COBRANCA = [
    { label: "{{cliente}}", desc: "Nome do cliente" },
    { label: "{{parcela}}", desc: "Número da parcela" },
    { label: "{{valor}}", desc: "Valor (R$)" },
    { label: "{{vencimento}}", desc: "Data de vencimento" },
    { label: "{{mes_referencia}}", desc: "Mês de referência" },
    { label: "{{empresa}}", desc: "Nome da empresa" },
  ];

  const abrirEnvioCobrancaSimples = (parcelaId: string, canal: "whatsapp" | "email") => {
    setCobrancaSimplesDialog({ parcelaId, canal });
    const templates = msgTemplates.filter((t) => canal === "email" ? t.ativo_email : t.ativo_whatsapp);
    const primeiro = templates[0];
    setCobrancaSimplesTemplateId(primeiro?.id || "");
    setCobrancaSimplesMensagem(primeiro?.corpo || MSG_PADRAO_COBRANCA);
  };

  const confirmarEnvioCobrancaSimples = async () => {
    if (!cobrancaSimplesDialog) return;
    const { parcelaId, canal } = cobrancaSimplesDialog;
    const key = `${parcelaId}-${canal}`;
    setSendingCobrancaSimples(key);
    
    if (agendarCobrancaSimples) {
      if (!dataAgendamentoCobrancaSimples) return toast({ title: "Informe data/hora", variant: "destructive" });
      const res = await agendarEnvio({ data_agendamento: new Date(dataAgendamentoCobrancaSimples).toISOString(), canal, referencia_tipo: "cobranca_simples", payload: { parcela_id: parcelaId, canal, mensagem: cobrancaSimplesMensagem.trim() || undefined } });
      setSendingCobrancaSimples(null);
      if (res?.error) return toast({ title: "Erro", description: res.error, variant: "destructive" });
      toast({ title: "Cobrança agendada!" });
      setCobrancaSimplesDialog(null);
      return;
    }

    const { ok, json } = await sendCobrancaSimples(parcelaId, canal, cobrancaSimplesMensagem.trim() || undefined);
    setSendingCobrancaSimples(null);
    if (!ok || json?.error) {
      return toast({ title: "Erro ao enviar cobrança", description: json?.error, variant: "destructive" });
    }
    toast({ title: canal === "whatsapp" ? "Cobrança enviada por WhatsApp!" : "Cobrança enviada por e-mail!" });
    setCobrancaSimplesDialog(null);
  };

  const openEditParcela = (parcela: Parcela) => {
    setEditParcelaDialog({ parcela });
    setEditParcelaValorNum(Number(parcela.valor));
    setEditParcelaValorDisplay(formatCurrency(Number(parcela.valor)));
    setEditParcelaVencimento(parcela.data_vencimento);
    setEditParcelaMesRef(parcela.mes_referencia || "");
  };

  const saveEditParcela = async () => {
    if (!editParcelaDialog?.parcela.id) return;
    if (!editParcelaValorNum || !editParcelaVencimento) {
      return toast({ title: "Preencha valor e vencimento", variant: "destructive" });
    }
    const { error } = await supabase.from("parcelas").update({
      valor: editParcelaValorNum,
      data_vencimento: editParcelaVencimento,
      mes_referencia: editParcelaMesRef.trim() || null,
    }).eq("id", editParcelaDialog.parcela.id);
    if (error) return toast({ title: "Erro ao salvar parcela", description: error.message, variant: "destructive" });
    toast({ title: "Parcela atualizada!" });
    setEditParcelaDialog(null);
    load();
  };

  const handleConfirmarEnvioRecibo = async () => {
    if (!reciboSendDialog) return;
    const { parcelaId, canal } = reciboSendDialog;
    
    if (agendarRecibo) {
      if (!dataAgendamentoRecibo) return toast({ title: "Informe a data e hora do agendamento", variant: "destructive" });
      setSendingReceipt(`${parcelaId}-${canal}`);
      const dataIso = new Date(dataAgendamentoRecibo).toISOString();
      const payload = { parcela_id: parcelaId, channel: canal, mensagem: reciboSendMensagem.trim() || undefined };
      const res = await agendarEnvio({ data_agendamento: dataIso, canal, referencia_tipo: "cobranca_recibo", payload: { path: "/notify/receipt", body: payload } });
      setSendingReceipt(null);
      if (res?.error) return toast({ title: "Erro ao agendar", description: res.error, variant: "destructive" });
      toast({ title: "Recibo agendado com sucesso!" });
      setReciboSendDialog(null);
      setAgendarRecibo(false);
      setDataAgendamentoRecibo("");
      return;
    }

    const key = `${parcelaId}-${canal}`;
    setSendingReceipt(key);
    const { ok, json } = await sendReceipt(parcelaId, canal, reciboSendMensagem.trim() || undefined);
    setSendingReceipt(null);
    if (!ok || json?.error) {
      return toast({ title: "Erro ao enviar recibo", description: json?.error, variant: "destructive" });
    }
    toast({ title: canal === "whatsapp" ? "Recibo enviado por WhatsApp!" : "Recibo enviado por email!" });
    setReciboSendDialog(null);
  };

  useEffect(() => {
    load();
    loadVendedores();
    loadClientes();
    loadCompany();
  }, []);

  // Recalcula preview de parcelas quando inputs mudam.
  useEffect(() => {
    if (qtdeParcelas <= 0 || valorParcelaNum <= 0 || !primeiroVencimento) {
      setParcelasPreview([]);
      return;
    }
    const base = new Date(primeiroVencimento + "T12:00:00");
    const mesIdx = MESES.indexOf(mesReferencia);
    const lista: Parcela[] = [];
    for (let i = 0; i < qtdeParcelas; i++) {
      const totalMeses = (mesIdx >= 0 ? mesIdx : 0) + i;
      const mes = MESES[totalMeses % 12];
      const ano = anoReferencia + Math.floor(totalMeses / 12);
      lista.push({
        numero_parcela: i + 1,
        valor: parseFloat(valorParcelaNum.toFixed(2)),
        data_vencimento: format(addMonths(base, i), "yyyy-MM-dd"),
        mes_referencia: `${mes}/${ano}`,
        pago: false,
      });
    }
    setParcelasPreview(lista);
  }, [qtdeParcelas, valorParcelaNum, primeiroVencimento, mesReferencia, anoReferencia]);

  const load = async () => {
    const { data } = await supabase
      .from("vendas")
      .select("*, venda_vendedores(*, vendedores(nome, whatsapp)), clientes(nome), parcelas(*)")
      .order("created_at", { ascending: false });
    setContratos(data || []);
  };

  const loadVendedores = async () => {
    const { data } = await supabase.from("vendedores").select("id, nome, comissao_padrao, whatsapp").eq("ativo", true);
    setVendedores(data || []);
  };

  const loadClientes = async () => {
    const { data } = await supabase.from("clientes").select("id, nome").order("nome");
    setClientes(data || []);
  };

  const loadCompany = async () => {
    const { data } = await supabase.from("company_settings").select("*").order("is_default", { ascending: false }).limit(1).maybeSingle();
    setCompany(data || null);
    const templates = await getMessageTemplates();
    setMsgTemplates(templates || []);
    if (isAdmin) {
      const { ok, json } = await getAsaasSettings();
      setAsaasAtivoSystem(ok && !!json?.ativo);
    }
  };

  const openRecibo = (contrato: any, parcela: any) => {
    setReciboHtml(buildReciboHtml(contrato, parcela, company));
  };

  const gerarCobrancaAsaas = async (parcela: Parcela, billingType: "BOLETO" | "PIX") => {
    if (!parcela.id) return;
    setGeneratingAsaas(parcela.id);
    const result = await criarCobrancaAsaas(parcela.id, billingType);
    setGeneratingAsaas(null);
    if (!result.success) {
      return toast({ title: "Erro ao gerar cobrança", description: result.error, variant: "destructive" });
    }
    toast({ title: result.reused ? "Cobrança existente reutilizada" : `${billingType === "PIX" ? "PIX" : "Boleto"} gerado com sucesso!` });
    if (billingType === "PIX") {
      setPixModal({ qrCode: result.pix_qr_code, copyPaste: result.pix_copy_paste, parcela });
    }
    load();
  };

  const consultarStatusAsaas = async (parcela: Parcela) => {
    if (!parcela.id) return;
    setCheckingAsaas(parcela.id);
    const result = await consultarCobrancaAsaas(parcela.id);
    setCheckingAsaas(null);
    if (!result.success) {
      return toast({ title: "Erro ao consultar cobrança", description: result.error, variant: "destructive" });
    }
    toast({ title: result.pago ? "Pagamento confirmado!" : `Status ASAAS: ${result.status}` });
    load();
  };

  const abrirEnvioCobranca = (parcelaId: string, canal: "whatsapp" | "email") => {
    setCobrancaSendDialog({ parcelaId, canal });
    const templates = msgTemplates.filter((t) => t.evento === "cobranca" && (canal === "email" ? t.ativo_email : t.ativo_whatsapp));
    const primeiro = templates[0];
    setCobrancaSendTemplateId(primeiro?.id || "");
    setCobrancaSendMensagem(primeiro?.corpo || "");
  };

  const confirmarEnvioCobranca = async () => {
    if (!cobrancaSendDialog) return;
    const { parcelaId, canal } = cobrancaSendDialog;
    const key = `${parcelaId}-${canal}`;
    setSendingCobranca(key);
    const result = await enviarCobrancaAsaas(parcelaId, canal, cobrancaSendMensagem.trim() || undefined);
    setSendingCobranca(null);
    if (!result.success) {
      return toast({ title: "Erro ao enviar cobrança", description: result.error, variant: "destructive" });
    }
    toast({ title: canal === "whatsapp" ? "Cobrança enviada por WhatsApp!" : "Cobrança enviada por e-mail!" });
    setCobrancaSendDialog(null);
  };

  const copiarPix = async (codigo?: string | null) => {
    if (!codigo) return;
    await navigator.clipboard.writeText(codigo);
    toast({ title: "Código PIX copiado!" });
  };

  const addVendedor = (vendedorId: string) => {
    if (contratoVendedores.some((vv) => vv.vendedor_id === vendedorId)) return;
    const v = vendedores.find((x) => x.id === vendedorId);
    if (!v) return;
    const perc = v.comissao_padrao;
    setContratoVendedores([...contratoVendedores, {
      vendedor_id: vendedorId,
      percentual: perc,
      valor_comissao: parseFloat(((valorServicoNum * perc) / 100).toFixed(2)),
    }]);
  };

  const updateComissaoValor = (idx: number, displayVal: string) => {
    const valor = unmaskCurrency(displayVal);
    const newList = [...contratoVendedores];
    newList[idx] = {
      ...newList[idx],
      valor_comissao: valor,
      percentual: valorServicoNum > 0 ? parseFloat(((valor / valorServicoNum) * 100).toFixed(2)) : 0,
    };
    setContratoVendedores(newList);
  };

  const updateComissaoPerc = (idx: number, val: string) => {
    const perc = parseFloat(val) || 0;
    const newList = [...contratoVendedores];
    newList[idx] = {
      ...newList[idx],
      percentual: perc,
      valor_comissao: parseFloat(((valorServicoNum * perc) / 100).toFixed(2)),
    };
    setContratoVendedores(newList);
  };

  const removeVendedor = (idx: number) => {
    setContratoVendedores(contratoVendedores.filter((_, i) => i !== idx));
  };

  const atualizarValorTotalContrato = (qtde: number, valorMensal: number) => {
    const total = parseFloat((Math.max(1, qtde) * Math.max(0, valorMensal)).toFixed(2));
    setValorServicoNum(total);
    setValorServicoDisplay(total > 0 ? formatCurrency(total) : "");
    setContratoVendedores(
      contratoVendedores.map((vv) => ({
        ...vv,
        valor_comissao: parseFloat(((total * vv.percentual) / 100).toFixed(2)),
      }))
    );
  };

  const handleQtdeParcelasChange = (raw: string) => {
    const qtde = Math.max(1, parseInt(raw) || 1);
    setQtdeParcelas(qtde);
    atualizarValorTotalContrato(qtde, valorParcelaNum);
  };

  const handleValorMensalChange = (displayVal: string) => {
    const masked = maskCurrency(displayVal);
    const valorMensal = unmaskCurrency(masked);
    setValorParcelaDisplay(masked);
    setValorParcelaNum(valorMensal);
    atualizarValorTotalContrato(qtdeParcelas, valorMensal);
  };

  const handleSave = async () => {
    const selectedCliente = clientes.find((c) => c.id === clienteId);
    if (!clienteId) {
      return toast({ title: "Selecione o cliente", variant: "destructive" });
    }
    if (qtdeParcelas < 1) {
      return toast({ title: "Qtde de parcelas inválida", variant: "destructive" });
    }
    if (!valorParcelaNum) {
      return toast({ title: "Informe o valor mensal", variant: "destructive" });
    }
    if (!primeiroVencimento) {
      return toast({ title: "Informe o 1º vencimento", variant: "destructive" });
    }

    const contratoPayload: any = {
      cliente: selectedCliente?.nome || clienteNome,
      cliente_id: clienteId || null,
      valor_servico: valorServicoNum,
      data_venda: dataVenda,
      mes_referencia: `${mesReferencia}/${anoReferencia}`,
      created_by: user?.id,
      qtde_parcelas: qtdeParcelas,
      valor_parcela: valorParcelaNum,
      primeiro_vencimento: primeiroVencimento,
    };

    if (editing) {
      const { error } = await supabase.from("vendas").update(contratoPayload).eq("id", editing.id);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });

      await supabase.from("venda_vendedores").delete().eq("venda_id", editing.id);
      // Recompor vendedores e notificar apenas os novos
      const previousVvIds = new Set((editing.venda_vendedores || []).map((vv: any) => vv.vendedor_id));
      if (contratoVendedores.length > 0) {
        const { data: insertedVVs } = await supabase.from("venda_vendedores").insert(
          contratoVendedores.map((vv) => ({ ...vv, venda_id: editing.id }))
        ).select();
        if (insertedVVs) {
          for (const vv of insertedVVs) {
            if (!previousVvIds.has(vv.vendedor_id)) {
              await sendNotification(vv.id, "nova_venda");
            }
          }
        }
      }
      // Sincroniza parcelas preservando baixas existentes:
      // - parcela com mesmo numero_parcela E mesmo valor/vencimento → mantida (preserva pago/data/nf/obs)
      // - parcela existente sem correspondência → removida (pacote mudou)
      // - parcela nova sem correspondência → inserida como em aberto
      const existingParcelas: any[] = editing.parcelas || [];
      const keptById = new Map<string, any>(); // id -> registro existente preservado
      const toInsert: any[] = [];
      const toUpdate: any[] = [];
      const newIds = new Set<string>();

      for (const np of parcelasPreview) {
        const match = existingParcelas.find(
          (ep: any) =>
            ep.numero_parcela === np.numero_parcela &&
            Number(ep.valor) === np.valor &&
            ep.data_vencimento === np.data_vencimento
        );
        if (match) {
          keptById.set(match.id, match); // nada a fazer no banco
        } else {
          // Procura parcela com mesmo número mas valor/vencimento diferente → atualiza in-place
          const byNumber = existingParcelas.find(
            (ep: any) => ep.numero_parcela === np.numero_parcela && !newIds.has(ep.id)
          );
          if (byNumber) {
            toUpdate.push({ id: byNumber.id, ...np });
            newIds.add(byNumber.id);
          } else {
            toInsert.push(np);
          }
        }
      }
      const keptIds = new Set(keptById.keys());
      const toDelete = existingParcelas
        .filter((ep: any) => !keptIds.has(ep.id) && !newIds.has(ep.id))
        .map((ep: any) => ep.id);

      if (toDelete.length > 0) {
        const { error: delErr } = await supabase.from("parcelas").delete().in("id", toDelete);
        if (delErr) return toast({ title: "Erro ao atualizar parcelas", description: delErr.message, variant: "destructive" });
      }
      for (const upd of toUpdate) {
        const { error: updErr } = await supabase.from("parcelas").update({
          valor: upd.valor,
          data_vencimento: upd.data_vencimento,
          mes_referencia: upd.mes_referencia,
        }).eq("id", upd.id);
        if (updErr) return toast({ title: "Erro ao atualizar parcela", description: updErr.message, variant: "destructive" });
      }
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from("parcelas").insert(
          toInsert.map((p) => ({
            venda_id: editing.id,
            numero_parcela: p.numero_parcela,
            valor: p.valor,
            data_vencimento: p.data_vencimento,
            mes_referencia: p.mes_referencia,
            pago: false,
          }))
        );
        if (insErr) return toast({ title: "Erro ao criar parcelas", description: insErr.message, variant: "destructive" });
      }
      toast({ title: "Lançamento atualizado!" });
    } else {
      const { data: contrato, error } = await supabase.from("vendas").insert(contratoPayload).select().single();
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });

      if (contratoVendedores.length > 0) {
        const { data: insertedVVs } = await supabase.from("venda_vendedores").insert(
          contratoVendedores.map((vv) => ({ ...vv, venda_id: contrato.id }))
        ).select();
        if (insertedVVs) {
          for (const vv of insertedVVs) {
            await sendNotification(vv.id, "nova_venda");
          }
        }
      }
      // Gera parcelas automaticamente
      if (parcelasPreview.length > 0) {
        const { error: insErr } = await supabase.from("parcelas").insert(
          parcelasPreview.map((p) => ({
            venda_id: contrato.id,
            numero_parcela: p.numero_parcela,
            valor: p.valor,
            data_vencimento: p.data_vencimento,
            mes_referencia: p.mes_referencia,
            pago: false,
          }))
        );
        if (insErr) {
          // Rollback amigável se der erro nas parcelas (evita venda órfã)
          await supabase.from("vendas").delete().eq("id", contrato.id);
          return toast({ title: "Erro ao gerar parcelas", description: insErr.message, variant: "destructive" });
        }
      }
      toast({ title: "Lançamento registrado!" });
    }

    resetForm();
    load();
  };

  const resetForm = () => {
    setOpen(false);
    setEditing(null);
    setClienteId("");
    setClienteNome("");
    setValorServicoDisplay("");
    setValorServicoNum(0);
    setDataVenda(new Date().toISOString().split("T")[0]);
    setMesReferencia(MESES[new Date().getMonth()]);
    setAnoReferencia(new Date().getFullYear());
    setContratoVendedores([]);
    setQtdeParcelas(1);
    setValorParcelaDisplay("");
    setValorParcelaNum(0);
    setPrimeiroVencimento(new Date().toISOString().split("T")[0]);
    setParcelasPreview([]);
  };

  const handleEdit = (c: any) => {
    setEditing(c);
    setClienteId(c.cliente_id || "");
    setClienteNome(c.cliente);
    setValorServicoNum(Number(c.valor_servico));
    setValorServicoDisplay(formatCurrency(Number(c.valor_servico)));
    setDataVenda(c.data_venda);
    const [mes, ano] = (c.mes_referencia || "").split("/");
    setMesReferencia(MESES.includes(mes) ? mes : MESES[new Date().getMonth()]);
    setAnoReferencia(ano ? parseInt(ano) : new Date().getFullYear());
    setContratoVendedores(
      (c.venda_vendedores || []).map((vv: any) => ({
        vendedor_id: vv.vendedor_id,
        percentual: vv.percentual,
        valor_comissao: vv.valor_comissao,
      }))
    );
    setQtdeParcelas(c.qtde_parcelas || 1);
    setValorParcelaNum(Number(c.valor_parcela || 0));
    setValorParcelaDisplay(formatCurrency(Number(c.valor_parcela || 0)));
    setPrimeiroVencimento(c.primeiro_vencimento || new Date().toISOString().split("T")[0]);
    // preview será recalculado pelo useEffect
    setOpen(true);
  };

  const handleDuplicate = async (v: any) => {
    const [mes, ano] = (v.mes_referencia || "").split("/");
    const mesIdx = MESES.indexOf(mes);
    let nextMes = mesIdx >= 0 ? mesIdx + 1 : new Date().getMonth() + 1;
    let nextAno = ano ? parseInt(ano) : new Date().getFullYear();
    if (nextMes > 11) {
      nextMes = 0;
      nextAno++;
    }

    const contratoPayload = {
      cliente: v.cliente,
      cliente_id: v.cliente_id || null,
      valor_servico: v.valor_servico,
      data_venda: new Date().toISOString().split("T")[0],
      mes_referencia: `${MESES[nextMes]}/${nextAno}`,
      created_by: user?.id,
      qtde_parcelas: v.qtde_parcelas || 1,
      valor_parcela: v.valor_parcela,
      primeiro_vencimento: v.primeiro_vencimento,
    };

    const { data: novaVenda, error } = await supabase.from("vendas").insert(contratoPayload).select().single();
    if (error) return toast({ title: "Erro ao duplicar", description: error.message, variant: "destructive" });

    const vvs = (v.venda_vendedores || []).map((vv: any) => ({
      vendedor_id: vv.vendedor_id,
      percentual: vv.percentual,
      valor_comissao: vv.valor_comissao,
      venda_id: novaVenda.id,
    }));
    if (vvs.length > 0) {
      const { data: insertedVVs } = await supabase.from("venda_vendedores").insert(vvs).select();
      if (insertedVVs) {
        for (const vv of insertedVVs) {
          await sendNotification(vv.id, "nova_venda");
        }
      }
    }
    // Duplica parcelas (em aberto)
    const ps = (v.parcelas || []).filter((p: any) => !p.pago).map((p: any) => ({
      venda_id: novaVenda.id,
      numero_parcela: p.numero_parcela,
      valor: p.valor,
      data_vencimento: p.data_vencimento,
      pago: false,
    }));
    if (ps.length > 0) {
      await supabase.from("parcelas").insert(ps);
    }

    toast({ title: `Contrato duplicado para ${MESES[nextMes]}/${nextAno}!` });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este lançamento? As parcelas vinculadas também serão removidas.")) return;
    await supabase.from("vendas").delete().eq("id", id);
    toast({ title: "Lançamento excluído!" });
    load();
  };

  // Baixa de parcela
  const openBaixa = (contratoId: string, parcela: Parcela) => {
    if (parcela.pago) return; // já paga, usa desmarcar
    setBaixaDialog({ contratoId, parcela });
    setBaixaNumeroNf(parcela.numero_nf || "");
    setBaixaData(parcela.data_pagamento ? format(new Date(parcela.data_pagamento), "yyyy-MM-dd") : new Date().toISOString().split("T")[0]);
    setBaixaObs(parcela.observacao || "");
  };

  const confirmBaixa = async () => {
    if (!baixaDialog) return;
    if (!baixaDialog.parcela.id) {
      setBaixaDialog(null);
      return toast({ title: "Parcela sem ID", variant: "destructive" });
    }
    const { error } = await supabase.from("parcelas").update({
      pago: true,
      data_pagamento: new Date(baixaData + "T12:00:00").toISOString(),
      numero_nf: baixaNumeroNf.trim() || null,
      observacao: baixaObs.trim() || null,
    }).eq("id", baixaDialog.parcela.id);
    if (error) return toast({ title: "Erro ao dar baixa", description: error.message, variant: "destructive" });
    setBaixaDialog(null);
    setBaixaNumeroNf("");
    setBaixaObs("");
    toast({ title: "Baixa registrada!" });
    load();
  };

  const openDesmarcar = (contratoId: string, parcela: Parcela) => {
    setDesmarcarDialog({ contratoId, parcela });
    setDesmarcarNumeroNf(parcela.numero_nf || "");
    setDesmarcarData(parcela.data_pagamento ? format(new Date(parcela.data_pagamento), "yyyy-MM-dd") : new Date().toISOString().split("T")[0]);
    setDesmarcarObs(parcela.observacao || "");
    setDesmarcarJustificativa("");
  };

  const desmarcarParcela = async (acao: "desmarcar" | "corrigir") => {
    if (!desmarcarDialog) return;
    if (!desmarcarJustificativa.trim()) return toast({ title: "Informe a justificativa", variant: "destructive" });
    const id = desmarcarDialog.parcela.id!;
    let payload: any;
    if (acao === "desmarcar") {
      payload = { pago: false, data_pagamento: null, numero_nf: null, observacao: desmarcarJustificativa.trim() };
    } else {
      payload = {
        pago: true,
        data_pagamento: new Date(desmarcarData + "T12:00:00").toISOString(),
        numero_nf: desmarcarNumeroNf.trim() || null,
        observacao: desmarcarObs.trim() || null,
      };
    }
    const { error } = await supabase.from("parcelas").update(payload).eq("id", id);
    setDesmarcarDialog(null);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: acao === "desmarcar" ? "Baixa desmarcada!" : "Pagamento corrigido!" });
    load();
  };

  const handleValorChange = (displayVal: string) => {
    const masked = maskCurrency(displayVal);
    setValorServicoDisplay(masked);
    const num = unmaskCurrency(masked);
    setValorServicoNum(num);
    setContratoVendedores(
      contratoVendedores.map((vv) => ({
        ...vv,
        valor_comissao: parseFloat(((num * vv.percentual) / 100).toFixed(2)),
      }))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestão Financeira</h1>
          <p className="text-muted-foreground">Contas a Receber, Contas a Pagar, Fluxo de Caixa e Fornecedores.</p>
        </div>
      </div>

      <Tabs defaultValue="receber" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 max-w-2xl">
          <TabsTrigger value="receber" className="gap-2">
            <ArrowUpRight className="h-4 w-4 text-emerald-600" /> Contas a Receber
          </TabsTrigger>
          <TabsTrigger value="pagar" className="gap-2">
            <ArrowDownLeft className="h-4 w-4 text-rose-600" /> Contas a Pagar
          </TabsTrigger>
          <TabsTrigger value="fluxo" className="gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" /> Fluxo de Caixa
          </TabsTrigger>
          <TabsTrigger value="categorias" className="gap-2">
            <Tag className="h-4 w-4 text-violet-600" /> Categorias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="receber" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Lançamentos de Contratos (A Receber)</h2>
            {isAdmin && (
              <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); else setOpen(true); }}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Novo Contrato (Receita)</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editing ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select value={clienteId} onValueChange={(id) => {
                      setClienteId(id);
                      const c = clientes.find((x) => x.id === id);
                      if (c) setClienteNome(c.nome);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Selecione o cliente..." /></SelectTrigger>
                      <SelectContent>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor do Serviço (R$)</Label>
                    <Input
                      value={valorServicoDisplay}
                      onChange={(e) => handleValorChange(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data do Lançamento</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataVenda && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dataVenda ? format(new Date(dataVenda + "T12:00:00"), "dd/MM/yyyy") : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dataVenda ? new Date(dataVenda + "T12:00:00") : undefined}
                          onSelect={(date) => { if (date) setDataVenda(format(date, "yyyy-MM-dd")); }}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Mês/Ano de Referência</Label>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => {
                        const idx = MESES.indexOf(mesReferencia);
                        if (idx === 0) {
                          setMesReferencia(MESES[11]);
                          setAnoReferencia(anoReferencia - 1);
                        } else {
                          setMesReferencia(MESES[idx - 1]);
                        }
                      }}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Select value={mesReferencia} onValueChange={setMesReferencia}>
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MESES.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        className="w-20"
                        value={anoReferencia}
                        onChange={(e) => setAnoReferencia(parseInt(e.target.value) || new Date().getFullYear())}
                      />
                      <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => {
                        const idx = MESES.indexOf(mesReferencia);
                        if (idx === 11) {
                          setMesReferencia(MESES[0]);
                          setAnoReferencia(anoReferencia + 1);
                        } else {
                          setMesReferencia(MESES[idx + 1]);
                        }
                      }}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Parcelamento */}
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <ReceiptText className="h-4 w-4" />
                    <Label className="font-semibold">Parcelamento</Label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Qtde. de Parcelas</Label>
                      <Input
                        type="number"
                        min={1}
                        value={qtdeParcelas}
                        onChange={(e) => handleQtdeParcelasChange(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valor da Parcela (R$)</Label>
                      <Input
                        value={valorParcelaDisplay}
                        onChange={(e) => handleValorMensalChange(e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">1º Vencimento</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !primeiroVencimento && "text-muted-foreground")}>
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {primeiroVencimento ? format(new Date(primeiroVencimento + "T12:00:00"), "dd/MM/yyyy") : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={primeiroVencimento ? new Date(primeiroVencimento + "T12:00:00") : undefined}
                            onSelect={(date) => { if (date) setPrimeiroVencimento(format(date, "yyyy-MM-dd")); }}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  {parcelasPreview.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Serão geradas {parcelasPreview.length} parcela(s) de R$ {formatCurrency(valorParcelaNum)} com vencimentos em{" "}
                      {parcelasPreview.map((p) => format(new Date(p.data_vencimento + "T12:00:00"), "dd/MM/yyyy")).join(", ")}.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Vendedores</Label>
                  <Select onValueChange={addVendedor}>
                    <SelectTrigger><SelectValue placeholder="Adicionar vendedor..." /></SelectTrigger>
                    <SelectContent>
                      {vendedores.filter((v) => !contratoVendedores.some((vv) => vv.vendedor_id === v.id)).map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {contratoVendedores.map((vv, idx) => {
                    const v = vendedores.find((x) => x.id === vv.vendedor_id);
                    return (
                      <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                        <span className="flex-1 min-w-0 font-medium text-sm truncate">{v?.nome}</span>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            className="w-20 sm:w-24"
                            value={vv.percentual}
                            onChange={(e) => updateComissaoPerc(idx, e.target.value)}
                          />
                          <span className="text-sm">%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm">R$</span>
                          <Input
                            className="w-24 sm:w-28"
                            value={formatCurrency(vv.valor_comissao)}
                            onChange={(e) => updateComissaoValor(idx, e.target.value)}
                          />
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeVendedor(idx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <Button onClick={handleSave} className="w-full">Salvar Lançamento</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Parcelamento</TableHead>
              <TableHead>Mês Ref.</TableHead>
              <TableHead>Vendedores / Comissões</TableHead>
              <TableHead>Parcelas (baixa)</TableHead>
              {isAdmin && <TableHead>Notificar</TableHead>}
              {isAdmin && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {contratos.map((c) => {
              const parcelas: Parcela[] = (c.parcelas || []).sort((a: any, b: any) => a.numero_parcela - b.numero_parcela);
              const pagas = parcelas.filter((p) => p.pago).length;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {c.clientes?.nome || c.cliente}
                    </div>
                  </TableCell>
                  <TableCell>R$ {formatCurrency(Number(c.valor_servico))}</TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <div>{c.qtde_parcelas || 1}x de R$ {formatCurrency(Number(c.valor_parcela || c.valor_servico / (c.qtde_parcelas || 1)))}</div>
                      <div className="text-muted-foreground">
                        {pagas}/{parcelas.length || c.qtde_parcelas || 1} pagas
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{c.mes_referencia}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {c.venda_vendedores?.map((vv: any) => (
                        <div key={vv.id} className="flex items-center gap-1.5 text-xs">
                          <span className="font-medium">{vv.vendedores?.nome}</span>
                          <span className="text-muted-foreground text-[11px]">
                            {vv.percentual}% = R$ {formatCurrency(Number(vv.valor_comissao))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {isAdmin ? (
                        parcelas.length > 0 ? parcelas.map((p) => (
                          <div key={p.id} className="flex items-center gap-1.5 text-[11px]">
                            <Button
                              variant={p.pago ? "default" : "destructive"}
                              size="sm"
                              className={cn("h-5 px-2", p.pago ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "")}
                              onClick={() => p.pago && p.id ? openDesmarcar(c.id, p) : openBaixa(c.id, p)}
                            >
                              {p.pago ? `✅ ${p.numero_parcela}` : `⏳ ${p.numero_parcela}`}
                            </Button>
                            <span className="text-muted-foreground">
                              {format(new Date(p.data_vencimento + "T12:00:00"), "dd/MM")}
                              {p.mes_referencia && <span className="text-[10px] ml-1 text-muted-foreground/70">({p.mes_referencia})</span>}
                            </span>
                            {p.numero_nf && <Badge variant="outline" className="text-[10px]">NF {p.numero_nf}</Badge>}
                            {p.id && !p.pago && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => openEditParcela(p)}>
                                      <SquarePen className="h-3 w-3 text-amber-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar parcela</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => abrirEnvioCobrancaSimples(p.id!, "whatsapp")}>
                                      <MessageCircle className="h-3 w-3 text-green-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Enviar cobrança por WhatsApp</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => abrirEnvioCobrancaSimples(p.id!, "email")}>
                                      <Mail className="h-3 w-3 text-blue-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Enviar cobrança por e-mail</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {!p.pago && asaasAtivoSystem && p.id && (
                              <TooltipProvider>
                                {!p.asaas_cobranca_id ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="icon" className="h-5 w-5" disabled={generatingAsaas === p.id}>
                                        <CreditCard className="h-3 w-3 text-sky-700" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                      <DropdownMenuItem onClick={() => gerarCobrancaAsaas(p, "BOLETO")}>
                                        <CreditCard className="h-4 w-4 mr-2" /> Gerar boleto
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => gerarCobrancaAsaas(p, "PIX")}>
                                        <QrCode className="h-4 w-4 mr-2" /> Gerar PIX
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : (
                                  <>
                                    <Badge variant="outline" className="h-5 text-[9px] border-sky-300 text-sky-800">
                                      {p.asaas_status || "ASAAS"}
                                    </Badge>
                                    {(p.asaas_boleto_url || p.asaas_invoice_url) && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => window.open(p.asaas_boleto_url || p.asaas_invoice_url || "", "_blank", "noopener,noreferrer")}>
                                            <ExternalLink className="h-3 w-3 text-sky-700" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Abrir boleto</TooltipContent>
                                      </Tooltip>
                                    )}
                                    {p.asaas_pix_copy_paste && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => setPixModal({ qrCode: p.asaas_pix_qr_code, copyPaste: p.asaas_pix_copy_paste, parcela: p })}>
                                            <QrCode className="h-3 w-3 text-sky-700" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Ver PIX</TooltipContent>
                                      </Tooltip>
                                    )}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => abrirEnvioCobranca(p.id!, "whatsapp")}>
                                          <MessageCircle className="h-3 w-3 text-green-600" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Enviar cobrança por WhatsApp</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => abrirEnvioCobranca(p.id!, "email")}>
                                          <Mail className="h-3 w-3 text-blue-600" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Enviar cobrança por e-mail</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-4 w-4" disabled={checkingAsaas === p.id} onClick={() => consultarStatusAsaas(p)}>
                                          <RefreshCw className="h-3 w-3 text-slate-600" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Consultar status ASAAS</TooltipContent>
                                    </Tooltip>
                                  </>
                                )}
                              </TooltipProvider>
                            )}
                            {p.id && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4"
                                      disabled={sendingReceipt === `${p.id}-whatsapp`}
                                      onClick={() => abrirEnvioRecibo(p.id!, "whatsapp")}
                                    >
                                      <MessageCircle className="h-3 w-3 text-green-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{p.pago ? "Enviar recibo por WhatsApp" : "Enviar recibo/demonstrativo (em aberto) por WhatsApp"}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4"
                                      disabled={sendingReceipt === `${p.id}-email`}
                                      onClick={() => abrirEnvioRecibo(p.id!, "email")}
                                    >
                                      <Mail className="h-3 w-3 text-blue-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{p.pago ? "Enviar recibo por email" : "Enviar recibo/demonstrativo (em aberto) por email"}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4"
                                      onClick={() => openRecibo(c, p)}
                                    >
                                      <Printer className="h-3 w-3 text-gray-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{p.pago ? "Visualizar / Imprimir recibo" : "Visualizar / Imprimir recibo (em aberto)"}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        )) : (
                          <span className="text-[11px] text-muted-foreground">Sem parcelas</span>
                        )
                      ) : (
                        parcelas.length > 0 ? parcelas.map((p) => (
                          <Badge key={p.id} variant={p.pago ? "default" : "destructive"} className={cn("text-[11px]", p.pago ? "bg-emerald-600 text-white" : "")}>
                            {p.pago ? "✅" : "⏳"} {p.numero_parcela}
                          </Badge>
                        )) : <span className="text-[11px] text-muted-foreground">Sem parcelas</span>
                      )}
                    </div>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="space-y-0.5">
                        {c.venda_vendedores?.map((vv: any) => (
                          <div key={vv.id} className="flex items-center gap-0.5 h-5">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleSendNotification(vv.id, "nova_venda", "whatsapp")}>
                                    <MessageCircle className="h-3 w-3 text-green-600" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Enviar WhatsApp</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleSendNotification(vv.id, "nova_venda", "email")}>
                                    <Mail className="h-3 w-3 text-blue-600" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Enviar Email</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  )}
                  {isAdmin && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(c)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(c.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {contratos.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Nenhum lançamento encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog de baixa de parcela */}
      <Dialog open={!!baixaDialog} onOpenChange={(o) => !o && setBaixaDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Baixa de Parcela {baixaDialog?.parcela.numero_parcela}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Valor</Label>
                <div className="font-medium">R$ {formatCurrency(Number(baixaDialog?.parcela.valor || 0))}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Vencimento</Label>
                <div className="font-medium">
                  {baixaDialog?.parcela.data_vencimento ? format(new Date(baixaDialog.parcela.data_vencimento + "T12:00:00"), "dd/MM/yyyy") : "-"}
                </div>
              </div>
              {baixaDialog?.parcela.mes_referencia && (
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Mês de Referência</Label>
                  <div className="font-medium">{baixaDialog.parcela.mes_referencia}</div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Número da N.F.</Label>
              <Input
                value={baixaNumeroNf}
                onChange={(e) => setBaixaNumeroNf(e.target.value)}
                placeholder="Número da nota fiscal"
              />
            </div>
            <div className="space-y-2">
              <Label>Data do Pagamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !baixaData && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {baixaData ? format(new Date(baixaData + "T12:00:00"), "dd/MM/yyyy") : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={baixaData ? new Date(baixaData + "T12:00:00") : undefined}
                    onSelect={(date) => { if (date) setBaixaData(format(date, "yyyy-MM-dd")); }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea
                value={baixaObs}
                onChange={(e) => setBaixaObs(e.target.value)}
                placeholder="Observação (opcional)"
                rows={2}
              />
            </div>
            <Button onClick={confirmBaixa} className="w-full">Confirmar Baixa</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog desmarcar / corrigir parcela */}
      <Dialog open={!!desmarcarDialog} onOpenChange={(o) => !o && setDesmarcarDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Parcela {desmarcarDialog?.parcela.numero_parcela} — Paga</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Escolha se deseja <strong>desmarcar</strong> o pagamento (reverte para pendente) ou <strong>corrigir</strong> os dados registrados.
            </p>

            {/* Justificativa obrigatória */}
            <div className="space-y-2">
              <Label>Justificativa <span className="text-destructive">*</span></Label>
              <Textarea
                value={desmarcarJustificativa}
                onChange={(e) => setDesmarcarJustificativa(e.target.value)}
                placeholder="Motivo da correção ou desmarcação..."
                rows={2}
              />
            </div>

            {/* Campos editáveis (usados só em "corrigir") */}
            <div className="rounded-lg border p-3 space-y-3">
              <Label className="font-semibold text-sm">Dados do Pagamento (para corrigir)</Label>
              <div className="space-y-2">
                <Label className="text-xs">Data do Pagamento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {desmarcarData ? format(new Date(desmarcarData + "T12:00:00"), "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={desmarcarData ? new Date(desmarcarData + "T12:00:00") : undefined}
                      onSelect={(date) => { if (date) setDesmarcarData(format(date, "yyyy-MM-dd")); }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Número da N.F.</Label>
                <Input
                  value={desmarcarNumeroNf}
                  onChange={(e) => setDesmarcarNumeroNf(e.target.value)}
                  placeholder="Número da nota fiscal"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Observação</Label>
                <Input
                  value={desmarcarObs}
                  onChange={(e) => setDesmarcarObs(e.target.value)}
                  placeholder="Observação (opcional)"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => desmarcarParcela("desmarcar")}
              >
                Desmarcar Pagamento
              </Button>
              <Button
                className="flex-1"
                onClick={() => desmarcarParcela("corrigir")}
              >
                Corrigir Dados
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de visualização PIX */}
      <Dialog open={!!pixModal} onOpenChange={(o) => !o && setPixModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>PIX para Parcela {pixModal?.parcela.numero_parcela}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            {pixModal?.qrCode ? (
              <img
                src={`data:image/png;base64,${pixModal.qrCode}`}
                alt="QR Code PIX"
                className="w-48 h-48 mx-auto border rounded p-2"
              />
            ) : (
              <p className="text-xs text-muted-foreground">QR Code indisponível. Utilize o código copia e cola abaixo.</p>
            )}
            {pixModal?.copyPaste && (
              <div className="space-y-2 text-left">
                <Label>Código PIX Copia e Cola</Label>
                <Textarea readOnly value={pixModal.copyPaste} rows={3} className="font-mono text-xs" />
                <Button className="w-full" onClick={() => copiarPix(pixModal.copyPaste)}>
                  <Copy className="h-4 w-4 mr-2" /> Copiar código PIX
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de envio de cobrança (WhatsApp / Email) */}
      <Dialog open={!!cobrancaSendDialog} onOpenChange={(o) => !o && setCobrancaSendDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Enviar Cobrança por {cobrancaSendDialog?.canal === "email" ? "E-mail" : "WhatsApp"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Select
                value={cobrancaSendTemplateId}
                onValueChange={(v) => {
                  setCobrancaSendTemplateId(v);
                  const t = msgTemplates.find((tp) => tp.id === v);
                  if (t) setCobrancaSendMensagem(t.corpo);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mensagem padrão" />
                </SelectTrigger>
                <SelectContent>
                  {cobrancaSendDialog && templatesCobranca(cobrancaSendDialog.canal).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem personalizada (opcional)</Label>
              <Textarea
                rows={4}
                placeholder="Deixe em branco para enviar com o modelo padrão com link/código PIX..."
                value={cobrancaSendMensagem}
                onChange={(e) => setCobrancaSendMensagem(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCobrancaSendDialog(null)}>Cancelar</Button>
            <Button
              onClick={confirmarEnvioCobranca}
              disabled={!!cobrancaSendDialog && sendingCobranca === `${cobrancaSendDialog.parcelaId}-${cobrancaSendDialog.canal}`}
            >
              {(!!cobrancaSendDialog && sendingCobranca === `${cobrancaSendDialog.parcelaId}-${cobrancaSendDialog.canal}`) ? "Enviando..." : "Enviar Cobrança"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de recibo de pagamento */}
      <Dialog open={!!reciboHtml} onOpenChange={(o) => !o && setReciboHtml(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Recibo / Demonstrativo da Parcela</DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const win = window.open("", "_blank");
                  if (win && reciboHtml) {
                    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recibo</title><style>@media print{body{margin:0;padding:0;}}</style></head><body>${reciboHtml}</body></html>`);
                    win.document.close();
                    win.focus();
                    win.print();
                  }
                }}
              >
                <Printer className="h-4 w-4 mr-2" /> Imprimir
              </Button>
            </div>
          </DialogHeader>
          {reciboHtml && (
            <div
              className="border rounded-lg p-4 bg-white"
              dangerouslySetInnerHTML={{ __html: reciboHtml }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!reciboSendDialog} onOpenChange={(o) => { if (!o) setReciboSendDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Enviar Recibo por {reciboSendDialog?.canal === "email" ? "E-mail" : "WhatsApp"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Select
                value={reciboSendTemplateId}
                onValueChange={(v) => {
                  setReciboSendTemplateId(v);
                  const t = msgTemplates.find((tp) => tp.id === v);
                  if (t) setReciboSendMensagem(t.corpo);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mensagem padrão" />
                </SelectTrigger>
                <SelectContent>
                  {reciboSendDialog && templatesRecibo(reciboSendDialog.canal).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem</Label>
              <Textarea
                rows={6}
                placeholder="Deixe em branco para usar a mensagem padrão do recibo"
                value={reciboSendMensagem}
                onChange={(e) => setReciboSendMensagem(e.target.value)}
              />
            </div>
            <div className="pt-2 border-t space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox id="agendarRecibo" checked={agendarRecibo} onCheckedChange={(v) => setAgendarRecibo(!!v)} />
                <Label htmlFor="agendarRecibo" className="cursor-pointer font-medium text-slate-700">Agendar para envio futuro</Label>
              </div>
              {agendarRecibo && (
                <Input type="datetime-local" value={dataAgendamentoRecibo} onChange={(e) => setDataAgendamentoRecibo(e.target.value)} />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReciboSendDialog(null)}>Cancelar</Button>
            <Button
              disabled={!!reciboSendDialog && sendingReceipt === `${reciboSendDialog.parcelaId}-${reciboSendDialog.canal}`}
              onClick={handleConfirmarEnvioRecibo}
            >
              {(!!reciboSendDialog && sendingReceipt === `${reciboSendDialog.parcelaId}-${reciboSendDialog.canal}`) ? "Enviando..." : (agendarRecibo ? "Agendar" : "Enviar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog de edição de parcela individual */}
      <Dialog open={!!editParcelaDialog} onOpenChange={(o) => !o && setEditParcelaDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Parcela {editParcelaDialog?.parcela.numero_parcela}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                value={editParcelaValorDisplay}
                onChange={(e) => {
                  const masked = maskCurrency(e.target.value);
                  setEditParcelaValorDisplay(masked);
                  setEditParcelaValorNum(unmaskCurrency(masked));
                }}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editParcelaVencimento && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editParcelaVencimento ? format(new Date(editParcelaVencimento + "T12:00:00"), "dd/MM/yyyy") : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editParcelaVencimento ? new Date(editParcelaVencimento + "T12:00:00") : undefined}
                    onSelect={(date) => { if (date) setEditParcelaVencimento(format(date, "yyyy-MM-dd")); }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Mês de Referência</Label>
              <Input
                value={editParcelaMesRef}
                onChange={(e) => setEditParcelaMesRef(e.target.value)}
                placeholder="Ex: Janeiro/2025"
              />
            </div>
            <Button onClick={saveEditParcela} className="w-full">Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Dialog de cobrança simples (sem ASAAS) */}
      <Dialog open={!!cobrancaSimplesDialog} onOpenChange={(o) => !o && setCobrancaSimplesDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Enviar Cobrança por {cobrancaSimplesDialog?.canal === "email" ? "E-mail" : "WhatsApp"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {cobrancaSimplesDialog && templatesCobranca(cobrancaSimplesDialog.canal).length > 0 && (
              <div className="space-y-1.5">
                <Label>Modelo</Label>
                <Select
                  value={cobrancaSimplesTemplateId}
                  onValueChange={(v) => {
                    setCobrancaSimplesTemplateId(v);
                    if (v === "__padrao__") {
                      setCobrancaSimplesMensagem(MSG_PADRAO_COBRANCA);
                    } else {
                      const t = msgTemplates.find((tp) => tp.id === v);
                      if (t) setCobrancaSimplesMensagem(t.corpo);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um modelo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__padrao__">Mensagem padrão</SelectItem>
                    {cobrancaSimplesDialog && templatesCobranca(cobrancaSimplesDialog.canal).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Mensagem</Label>
              <Textarea
                id="cobranca-simples-textarea"
                rows={5}
                value={cobrancaSimplesMensagem}
                onChange={(e) => setCobrancaSimplesMensagem(e.target.value)}
              />
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Clique para inserir variável:</p>
                <div className="flex flex-wrap gap-1">
                  {VARIAVEIS_COBRANCA.map((v) => (
                    <TooltipProvider key={v.label}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-[11px] font-mono bg-muted border rounded px-1.5 py-0.5 hover:bg-accent cursor-pointer"
                            onClick={() => {
                              const el = document.getElementById("cobranca-simples-textarea") as HTMLTextAreaElement | null;
                              if (el) {
                                const start = el.selectionStart ?? cobrancaSimplesMensagem.length;
                                const end = el.selectionEnd ?? cobrancaSimplesMensagem.length;
                                const novo = cobrancaSimplesMensagem.substring(0, start) + v.label + cobrancaSimplesMensagem.substring(end);
                                setCobrancaSimplesMensagem(novo);
                                setTimeout(() => { el.focus(); el.setSelectionRange(start + v.label.length, start + v.label.length); }, 0);
                              } else {
                                setCobrancaSimplesMensagem((m) => m + v.label);
                              }
                            }}
                          >
                            {v.label}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{v.desc}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCobrancaSimplesDialog(null)}>Cancelar</Button>
            <Button
              onClick={confirmarEnvioCobrancaSimples}
              disabled={!!cobrancaSimplesDialog && sendingCobrancaSimples === `${cobrancaSimplesDialog.parcelaId}-${cobrancaSimplesDialog.canal}`}
            >
              {(!!cobrancaSimplesDialog && sendingCobrancaSimples === `${cobrancaSimplesDialog.parcelaId}-${cobrancaSimplesDialog.canal}`) ? "Enviando..." : "Enviar Cobrança"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="pagar">
          <ContasPagarTab />
        </TabsContent>

        <TabsContent value="fluxo">
          <FluxoCaixaTab />
        </TabsContent>

        <TabsContent value="categorias">
          <CategoriasDespesaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Financeiro;