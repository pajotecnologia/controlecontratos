import { useEffect, useState } from "react";
import { supabase, getExtrato } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/masks";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  Download,
  Search,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchableClientSelect } from "@/components/SearchableClientSelect";
import { SearchableFornecedorSelect } from "@/components/SearchableFornecedorSelect";
import { DataTablePagination } from "@/components/DataTablePagination";

type Cliente = { id: string; nome: string; cpf_cnpj?: string };
type Fornecedor = { id: string; razao_social: string; nome_fantasia?: string; cpf_cnpj?: string };
type Vendedor = { id: string; nome: string };

const dataBr = (value: unknown) => {
  if (!value) return "-";
  const raw = String(value);
  const normalized = raw.includes("T") ? raw : `${raw}T12:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "dd/MM/yyyy");
};

export default function Relatorios() {
  const [company, setCompany] = useState<any>(null);
  const [clientesList, setClientesList] = useState<any[]>([]);
  const [fornecedoresList, setFornecedoresList] = useState<any[]>([]);
  const [vendedoresList, setVendedoresList] = useState<any[]>([]);

  // TAB 1: CONTAS A RECEBER (CLIENTES)
  const [recStart, setRecStart] = useState("");
  const [recEnd, setRecEnd] = useState("");
  const [recClienteId, setRecClienteId] = useState(""); // vazia = Todos os clientes
  const [recSituacao, setRecSituacao] = useState("todas"); // todas | pago | pendente
  const [recParcelas, setRecParcelas] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recCurrentPage, setRecCurrentPage] = useState(1);
  const [recPageSize, setRecPageSize] = useState(10);

  // TAB 2: CONTAS A PAGAR (FORNECEDORES)
  const [pagStart, setPagStart] = useState("");
  const [pagEnd, setPagEnd] = useState("");
  const [pagFornecedorId, setPagFornecedorId] = useState(""); // vazia = Todos os fornecedores
  const [pagSituacao, setPagSituacao] = useState("todas"); // todas | pago | pendente
  const [pagParcelas, setPagParcelas] = useState<any[]>([]);
  const [pagLoading, setPagLoading] = useState(false);
  const [pagCurrentPage, setPagCurrentPage] = useState(1);
  const [pagPageSize, setPagPageSize] = useState(10);

  // TAB 3: EXTRACTO GERAL & COMISSÕES
  const [extStart, setExtStart] = useState("");
  const [extEnd, setExtEnd] = useState("");
  const [extClienteId, setExtClienteId] = useState("__todos__");
  const [extVendedorId, setExtVendedorId] = useState("__todos__");
  const [extStatus, setExtStatus] = useState("__todos__");
  const [extRows, setExtRows] = useState<any[]>([]);
  const [extResumo, setExtResumo] = useState<any | null>(null);
  const [extLoading, setExtLoading] = useState(false);
  const [extCurrentPage, setExtCurrentPage] = useState(1);
  const [extPageSize, setExtPageSize] = useState(10);

  useEffect(() => {
    loadBaseData();
  }, []);

  const loadBaseData = async () => {
    const [cRes, fRes, vRes, compRes] = await Promise.all([
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("fornecedores").select("*").order("razao_social"),
      supabase.from("vendedores").select("id, nome").order("nome"),
      supabase.from("company_settings").select("*").order("is_default", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (cRes.data) setClientesList(cRes.data);
    if (fRes.data) setFornecedoresList(fRes.data);
    if (vRes.data) setVendedoresList(vRes.data);
    if (compRes.data) setCompany(compRes.data);

    // Carregar dados iniciais das 3 abas
    gerarRelatorioReceber();
    gerarRelatorioPagar();
    gerarExtrato();
  };

  // ==========================================
  // GERAR RELATÓRIO: CONTAS A RECEBER (CLIENTES)
  // ==========================================
  const gerarRelatorioReceber = async () => {
    setRecLoading(true);
    try {
      const { data, error } = await supabase
        .from("parcelas")
        .select("*, contratos(*, clientes(*))")
        .order("data_vencimento", { ascending: true });

      if (error) throw error;

      let list = data || [];

      // Filtro por Período de Vencimento
      if (recStart) {
        list = list.filter((p: any) => p.data_vencimento >= recStart);
      }
      if (recEnd) {
        list = list.filter((p: any) => p.data_vencimento <= recEnd);
      }

      // Filtro por Cliente Específico
      if (recClienteId) {
        list = list.filter((p: any) => p.contratos?.cliente_id === recClienteId);
      }

      // Filtro por Situação
      const hojeStr = new Date().toISOString().split("T")[0];
      if (recSituacao === "pago") {
        list = list.filter((p: any) => p.pago);
      } else if (recSituacao === "pendente") {
        list = list.filter((p: any) => !p.pago);
      } else if (recSituacao === "atrasado") {
        list = list.filter((p: any) => !p.pago && p.data_vencimento < hojeStr);
      }

      setRecParcelas(list);
      setRecCurrentPage(1);
    } catch (err: any) {
      toast({ title: "Erro no relatório de receber", description: err.message, variant: "destructive" });
    } finally {
      setRecLoading(false);
    }
  };

  // Cálculos do Relatório Contas a Receber
  const recTotalFaturado = recParcelas.reduce((acc, p) => acc + Number(p.valor || 0), 0);
  const recTotalRecebido = recParcelas.filter((p) => p.pago).reduce((acc, p) => acc + Number(p.valor || 0), 0);
  const recTotalPendente = recParcelas.filter((p) => !p.pago).reduce((acc, p) => acc + Number(p.valor || 0), 0);
  const recTotalPages = Math.ceil(recParcelas.length / recPageSize);
  const recPaginated = recParcelas.slice((recCurrentPage - 1) * recPageSize, recCurrentPage * recPageSize);

  // ==========================================
  // GERAR RELATÓRIO: CONTAS A PAGAR (FORNECEDORES)
  // ==========================================
  const gerarRelatorioPagar = async () => {
    setPagLoading(true);
    try {
      const { data, error } = await supabase
        .from("parcelas_despesas")
        .select("*, despesas(*, fornecedores(*), categorias_despesa(*))")
        .order("data_vencimento", { ascending: true });

      if (error) throw error;

      let list = data || [];

      // Filtro por Período de Vencimento
      if (pagStart) {
        list = list.filter((p: any) => p.data_vencimento && p.data_vencimento.split("T")[0] >= pagStart);
      }
      if (pagEnd) {
        list = list.filter((p: any) => p.data_vencimento && p.data_vencimento.split("T")[0] <= pagEnd);
      }

      // Filtro por Fornecedor Específico
      if (pagFornecedorId) {
        if (pagFornecedorId === "sem_fornecedor") {
          list = list.filter((p: any) => !p.despesas?.fornecedor_id);
        } else {
          list = list.filter((p: any) => p.despesas?.fornecedor_id === pagFornecedorId);
        }
      }

      // Filtro por Situação
      const hojeStr = new Date().toISOString().split("T")[0];
      if (pagSituacao === "pago") {
        list = list.filter((p: any) => p.pago);
      } else if (pagSituacao === "pendente") {
        list = list.filter((p: any) => !p.pago);
      } else if (pagSituacao === "atrasado") {
        list = list.filter((p: any) => !p.pago && p.data_vencimento && p.data_vencimento.split("T")[0] < hojeStr);
      }

      setPagParcelas(list);
      setPagCurrentPage(1);
    } catch (err: any) {
      toast({ title: "Erro no relatório de pagar", description: err.message, variant: "destructive" });
    } finally {
      setPagLoading(false);
    }
  };

  // Cálculos do Relatório Contas a Pagar
  const pagTotalLancado = pagParcelas.reduce((acc, p) => acc + Number(p.valor || 0), 0);
  const pagTotalPago = pagParcelas.filter((p) => p.pago).reduce((acc, p) => acc + Number(p.valor || 0), 0);
  const pagTotalPendente = pagParcelas.filter((p) => !p.pago).reduce((acc, p) => acc + Number(p.valor || 0), 0);
  const pagTotalPages = Math.ceil(pagParcelas.length / pagPageSize);
  const pagPaginated = pagParcelas.slice((pagCurrentPage - 1) * pagPageSize, pagCurrentPage * pagPageSize);

  // ==========================================
  // GERAR EXTRATO DE COMISSÕES (TAB 3)
  // ==========================================
  const gerarExtrato = async () => {
    setExtLoading(true);
    const { data, resumo, error } = await getExtrato({
      start: extStart || undefined,
      end: extEnd || undefined,
      cliente_id: extClienteId === "__todos__" ? undefined : extClienteId,
      vendedor_id: extVendedorId === "__todos__" ? undefined : extVendedorId,
      status_pagamento: extStatus === "__todos__" ? undefined : extStatus,
    });
    setExtLoading(false);
    if (error) {
      toast({ title: "Erro ao gerar extrato", description: error, variant: "destructive" });
      return;
    }
    setExtRows(Array.isArray(data) ? data : []);
    setExtResumo(resumo || { faturado: 0, recebido: 0, pendente: 0, comissao_total: 0, comissao_paga: 0, comissao_pendente: 0 });
    setExtCurrentPage(1);
  };

  const extTotalPages = Math.ceil(extRows.length / extPageSize);
  const extPaginated = extRows.slice((extCurrentPage - 1) * extPageSize, extCurrentPage * extPageSize);

  // ==========================================
  // IMPRESSÃO FORMATADA (PDF / HTML)
  // ==========================================
  const imprimirRelatorio = (tipo: "receber" | "pagar" | "comissoes") => {
    const comp = company || {};
    let logoHtml = "";
    if (comp.logo_url) {
      let logoSrc = comp.logo_url;
      if (logoSrc.startsWith("/")) {
        logoSrc = `${window.location.protocol}//${window.location.host}${logoSrc}`;
      }
      logoHtml = `<img src="${logoSrc}" alt="Logo" style="max-height: 70px; max-width: 180px; object-fit: contain; margin-bottom: 6px;" />`;
    }

    const compEndereco = [comp.endereco, comp.bairro, comp.cidade, comp.cep ? `CEP: ${comp.cep}` : ""]
      .filter(Boolean)
      .join(" - ");
    const compContato = [comp.telefone ? `Tel.: ${comp.telefone}` : "", comp.email ? `Email: ${comp.email}` : ""]
      .filter(Boolean)
      .join(" | ");

    const dataEmissaoStr = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });

    let tituloRelatorio = "";
    let filtroClienteOuForn = "";
    let resumoHtml = "";
    let tableHeadersHtml = "";
    let tableBodyHtml = "";

    const hojeStr = new Date().toISOString().split("T")[0];

    if (tipo === "receber") {
      tituloRelatorio = "RELATÓRIO DE CONTAS A RECEBER (CLIENTES)";
      const clienteObj = clientesList.find((c) => c.id === recClienteId);
      filtroClienteOuForn = clienteObj
        ? `Cliente: ${clienteObj.nome} ${clienteObj.cpf_cnpj ? `(${clienteObj.cpf_cnpj})` : ""}`
        : "Todos os Clientes (Geral)";

      resumoHtml = `
        <div style="display: flex; justify-content: space-around; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 12px; text-align: center;">
          <div><span style="color: #64748b; display: block;">Total Faturado</span><strong>R$ ${formatCurrency(recTotalFaturado)}</strong></div>
          <div><span style="color: #64748b; display: block;">Total Recebido (Pago)</span><strong style="color: #16a34a;">R$ ${formatCurrency(recTotalRecebido)}</strong></div>
          <div><span style="color: #64748b; display: block;">Total a Receber</span><strong style="color: #dc2626;">R$ ${formatCurrency(recTotalPendente)}</strong></div>
        </div>
      `;

      tableHeadersHtml = `
        <tr style="background-color: #f1f5f9; font-size: 11px;">
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Cliente</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 60px;">Parc.</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 85px;">Vencimento</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 85px;">Pagamento</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; width: 110px;">Valor</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 90px;">Situação</th>
        </tr>
      `;

      tableBodyHtml = recParcelas
        .map((p) => {
          const nomeCliente = p.contratos?.clientes?.nome || p.contratos?.cliente || "Cliente";
          const isAtrasado = !p.pago && p.data_vencimento < hojeStr;
          const statusTxt = p.pago ? "Recebido" : isAtrasado ? "Atrasado" : "Pendente";
          const statusCor = p.pago ? "#16a34a" : isAtrasado ? "#dc2626" : "#d97706";
          return `
          <tr style="font-size: 11px;">
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;"><strong>${nomeCliente}</strong></td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${p.numero_parcela || 1}ª</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${dataBr(p.data_vencimento)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${dataBr(p.data_pagamento)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold;">R$ ${formatCurrency(Number(p.valor || 0))}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; color: ${statusCor}; font-weight: bold;">${statusTxt}</td>
          </tr>
        `;
        })
        .join("");
    } else if (tipo === "pagar") {
      tituloRelatorio = "RELATÓRIO DE CONTAS A PAGAR (FORNECEDORES)";
      const fornObj = fornecedoresList.find((f) => f.id === pagFornecedorId);
      filtroClienteOuForn = fornObj
        ? `Fornecedor: ${fornObj.razao_social} ${fornObj.cpf_cnpj ? `(${fornObj.cpf_cnpj})` : ""}`
        : "Todos os Fornecedores (Geral)";

      resumoHtml = `
        <div style="display: flex; justify-content: space-around; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 12px; text-align: center;">
          <div><span style="color: #64748b; display: block;">Total Lançado</span><strong>R$ ${formatCurrency(pagTotalLancado)}</strong></div>
          <div><span style="color: #64748b; display: block;">Total Pago</span><strong style="color: #16a34a;">R$ ${formatCurrency(pagTotalPago)}</strong></div>
          <div><span style="color: #64748b; display: block;">Total a Pagar</span><strong style="color: #dc2626;">R$ ${formatCurrency(pagTotalPendente)}</strong></div>
        </div>
      `;

      tableHeadersHtml = `
        <tr style="background-color: #f1f5f9; font-size: 11px;">
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Fornecedor / Credor</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Descrição / Categoria</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 85px;">Vencimento</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 85px;">Pagamento</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; width: 110px;">Valor</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 90px;">Situação</th>
        </tr>
      `;

      tableBodyHtml = pagParcelas
        .map((p) => {
          const nomeForn = p.despesas?.fornecedores?.razao_social || "Sem Fornecedor";
          const desc = p.despesas?.descricao || "-";
          const cat = p.despesas?.categorias_despesa?.nome || "";
          const isAtrasado = !p.pago && p.data_vencimento && p.data_vencimento.split("T")[0] < hojeStr;
          const statusTxt = p.pago ? "Pago" : isAtrasado ? "Atrasado" : "Pendente";
          const statusCor = p.pago ? "#16a34a" : isAtrasado ? "#dc2626" : "#d97706";
          return `
          <tr style="font-size: 11px;">
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;"><strong>${nomeForn}</strong></td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">${desc} ${cat ? `<span style="color:#64748b;">(${cat})</span>` : ""}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${dataBr(p.data_vencimento)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${dataBr(p.data_pagamento)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold;">R$ ${formatCurrency(Number(p.valor || 0))}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; color: ${statusCor}; font-weight: bold;">${statusTxt}</td>
          </tr>
        `;
        })
        .join("");
    } else {
      tituloRelatorio = "EXTRATO GERAL E COMISSÕES DE VENDAS";
      filtroClienteOuForn = "Todos os Clientes & Vendedores";

      resumoHtml = `
        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 11px; text-align: center;">
          <div><span style="color: #64748b; display: block;">Faturado</span><strong>R$ ${formatCurrency(extResumo?.faturado || 0)}</strong></div>
          <div><span style="color: #64748b; display: block;">Recebido</span><strong style="color: #16a34a;">R$ ${formatCurrency(extResumo?.recebido || 0)}</strong></div>
          <div><span style="color: #64748b; display: block;">A Receber</span><strong style="color: #dc2626;">R$ ${formatCurrency(extResumo?.pendente || 0)}</strong></div>
          <div><span style="color: #64748b; display: block;">Comissão Total</span><strong>R$ ${formatCurrency(extResumo?.comissao_total || 0)}</strong></div>
          <div><span style="color: #64748b; display: block;">Comissão Paga</span><strong style="color: #16a34a;">R$ ${formatCurrency(extResumo?.comissao_paga || 0)}</strong></div>
          <div><span style="color: #64748b; display: block;">Comissão Pend.</span><strong style="color: #dc2626;">R$ ${formatCurrency(extResumo?.comissao_pendente || 0)}</strong></div>
        </div>
      `;

      tableHeadersHtml = `
        <tr style="background-color: #f1f5f9; font-size: 11px;">
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Cliente</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 50px;">Parc.</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 80px;">Vencimento</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 80px;">Pagamento</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; width: 100px;">Valor</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 75px;">Status</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Vendedor</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; width: 130px;">Comissão</th>
        </tr>
      `;

      tableBodyHtml = extRows
        .map(
          (r) => `
        <tr style="font-size: 11px;">
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">${r.cliente}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${r.numero_parcela ? `${r.numero_parcela}ª` : "-"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${dataBr(r.data_vencimento)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${dataBr(r.parcela_pagamento)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">R$ ${formatCurrency(Number(r.parcela_valor || r.valor_servico || 0))}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${r.parcela_pago ? "Paga" : "Em aberto"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">${r.vendedor_nome || "-"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">R$ ${formatCurrency(Number(r.valor_comissao || 0))} (${r.comissao_paga ? "paga" : "pendente"})</td>
        </tr>
      `
        )
        .join("");
    }

    const printHtml = `
      <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.4; padding: 10px; max-width: 950px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 14px;">
          ${logoHtml}
          <div style="font-size: 16px; font-weight: bold; color: #1e293b;">${comp.name || "Sua Empresa"}</div>
          ${comp.cnpj ? `<div style="font-size: 12px; color: #475569;">CNPJ: ${comp.cnpj}</div>` : ""}
          ${compEndereco ? `<div style="font-size: 12px; color: #475569;">${compEndereco}</div>` : ""}
          ${compContato ? `<div style="font-size: 12px; color: #475569;">${compContato}</div>` : ""}
        </div>

        <div style="text-align: center; margin-bottom: 15px;">
          <h2 style="font-size: 18px; margin: 0 0 4px 0; font-weight: bold; color: #0f172a;">${tituloRelatorio}</h2>
          <div style="font-size: 12px; color: #475569; font-weight: bold;">${filtroClienteOuForn}</div>
        </div>

        ${resumoHtml}

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            ${tableHeadersHtml}
          </thead>
          <tbody>
            ${tableBodyHtml}
          </tbody>
        </table>

        <div style="text-align: right; font-size: 11px; color: #64748b; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
          Emitido em ${dataEmissaoStr}.
        </div>
      </div>
    `;

    const printWindow = window.open("", "_blank", "width=1000,height=750");
    if (!printWindow) {
      return toast({ title: "Bloqueio de pop-up", description: "Permita pop-ups no seu navegador para imprimir.", variant: "destructive" });
    }

    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>${tituloRelatorio}</title>
          <style>
            @page { margin: 12mm; }
            body { font-family: Arial, sans-serif; background: #ffffff; margin: 0; }
          </style>
        </head>
        <body><div>${printHtml}</div></body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // ==========================================
  // EXPORTAÇÃO CSV
  // ==========================================
  const exportarCsv = (tipo: "receber" | "pagar" | "comissoes") => {
    let header: string[] = [];
    let linhas: (string | number)[][] = [];
    let filename = "";

    const hojeStr = new Date().toISOString().split("T")[0];

    if (tipo === "receber") {
      if (recParcelas.length === 0) return toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      filename = `relatorio-contas-a-receber-${hojeStr}.csv`;
      header = ["Cliente", "CPF/CNPJ", "Parcela", "Vencimento", "Data Pagamento", "Valor (R$)", "Situacao"];
      linhas = recParcelas.map((p) => [
        p.contratos?.clientes?.nome || p.contratos?.cliente || "Cliente",
        p.contratos?.clientes?.cpf_cnpj || "",
        `${p.numero_parcela || 1}ª`,
        dataBr(p.data_vencimento),
        dataBr(p.data_pagamento),
        Number(p.valor || 0).toFixed(2),
        p.pago ? "Recebido" : p.data_vencimento < hojeStr ? "Atrasado" : "Pendente",
      ]);
    } else if (tipo === "pagar") {
      if (pagParcelas.length === 0) return toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      filename = `relatorio-contas-a-pagar-${hojeStr}.csv`;
      header = ["Fornecedor", "CPF/CNPJ", "Despesa", "Categoria", "Vencimento", "Data Pagamento", "Valor (R$)", "Situacao"];
      linhas = pagParcelas.map((p) => [
        p.despesas?.fornecedores?.razao_social || "Sem Fornecedor",
        p.despesas?.fornecedores?.cpf_cnpj || "",
        p.despesas?.descricao || "",
        p.despesas?.categorias_despesa?.nome || "",
        dataBr(p.data_vencimento),
        dataBr(p.data_pagamento),
        Number(p.valor || 0).toFixed(2),
        p.pago ? "Pago" : p.data_vencimento && p.data_vencimento.split("T")[0] < hojeStr ? "Atrasado" : "Pendente",
      ]);
    } else {
      if (extRows.length === 0) return toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      filename = `relatorio-comissoes-${hojeStr}.csv`;
      header = [
        "Cliente",
        "Mes Ref.",
        "Valor Servico",
        "Parcela",
        "Vencimento",
        "Pagamento",
        "Valor Parcela",
        "Parcela Paga",
        "Vendedor",
        "Comissao",
        "Comissao Paga",
      ];
      linhas = extRows.map((r) => [
        r.cliente,
        r.mes_referencia || "",
        Number(r.valor_servico || 0).toFixed(2),
        r.numero_parcela ?? "",
        dataBr(r.data_vencimento),
        dataBr(r.parcela_pagamento),
        Number(r.parcela_valor || 0).toFixed(2),
        r.parcela_pago ? "Sim" : "Nao",
        r.vendedor_nome || "",
        Number(r.valor_comissao || 0).toFixed(2),
        r.comissao_paga ? "Sim" : "Nao",
      ]);
    }

    const csvContent = [header, ...linhas]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hojeStr = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" /> Relatórios Financeiros
          </h1>
          <p className="text-muted-foreground">
            Extratos detalhados por Cliente (Contas a Receber), por Fornecedor (Contas a Pagar) e Comissões de Vendas.
          </p>
        </div>
      </div>

      <Tabs defaultValue="receber" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="receber" className="flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4 text-emerald-600" /> Contas a Receber (Clientes)
          </TabsTrigger>
          <TabsTrigger value="pagar" className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-rose-600" /> Contas a Pagar (Fornecedores)
          </TabsTrigger>
          <TabsTrigger value="comissoes" className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" /> Comissões & Extrato
          </TabsTrigger>
        </TabsList>

        {/* ==========================================
            ABA 1: CONTAS A RECEBER (CLIENTES)
        ========================================== */}
        <TabsContent value="receber" className="space-y-6 pt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" /> Filtros de Contas a Receber
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-end">
                <div className="space-y-2">
                  <Label>Cliente (Específico ou Geral)</Label>
                  <SearchableClientSelect
                    clients={clientesList}
                    value={recClienteId}
                    onValueChange={(id) => setRecClienteId(id)}
                    placeholder="Todos os Clientes (Geral)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Situação do Título</Label>
                  <Select value={recSituacao} onValueChange={setRecSituacao}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as Situações</SelectItem>
                      <SelectItem value="pago">Apenas Recebidas / Pagas</SelectItem>
                      <SelectItem value="pendente">Apenas Em Aberto / A Receber</SelectItem>
                      <SelectItem value="atrasado">Apenas Em Atraso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>De (Vencimento)</Label>
                  <Input type="date" value={recStart} onChange={(e) => setRecStart(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Até (Vencimento)</Label>
                  <Input type="date" value={recEnd} onChange={(e) => setRecEnd(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t">
                <Button onClick={gerarRelatorioReceber} disabled={recLoading} className="bg-primary hover:bg-primary/90">
                  <Search className="mr-2 h-4 w-4" /> {recLoading ? "Filtrando..." : "Filtrar Relatório"}
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => imprimirRelatorio("receber")} disabled={recParcelas.length === 0}>
                    <Printer className="mr-2 h-4 w-4 text-slate-700" /> Imprimir Relatório
                  </Button>
                  <Button variant="outline" onClick={() => exportarCsv("receber")} disabled={recParcelas.length === 0}>
                    <Download className="mr-2 h-4 w-4 text-emerald-600" /> Exportar CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cards de Resumo */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card className="shadow-sm border-l-4 border-l-blue-500">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Faturado no Filtro</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">R$ {formatCurrency(recTotalFaturado)}</div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-emerald-500">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Recebido (Pago)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">R$ {formatCurrency(recTotalRecebido)}</div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-rose-500">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total a Receber (Pendente/Atrasado)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-600">R$ {formatCurrency(recTotalPendente)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Contas a Receber */}
          <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Data Pagamento</TableHead>
                  <TableHead className="text-right">Valor (R$)</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Carregando relatório de contas a receber...
                    </TableCell>
                  </TableRow>
                ) : recParcelas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum lançamento encontrado para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  recPaginated.map((p) => {
                    const nomeCliente = p.contratos?.clientes?.nome || p.contratos?.cliente || "Cliente";
                    const cpfCnpj = p.contratos?.clientes?.cpf_cnpj;
                    const isAtrasado = !p.pago && p.data_vencimento < hojeStr;

                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">{nomeCliente}</div>
                          {cpfCnpj && <div className="text-xs text-muted-foreground font-mono">{cpfCnpj}</div>}
                        </TableCell>
                        <TableCell>{p.numero_parcela || 1}ª Parcela</TableCell>
                        <TableCell>{dataBr(p.data_vencimento)}</TableCell>
                        <TableCell>{dataBr(p.data_pagamento)}</TableCell>
                        <TableCell className="text-right font-bold">R$ {formatCurrency(Number(p.valor || 0))}</TableCell>
                        <TableCell>
                          {p.pago ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[11px]">
                              <CheckCircle2 className="h-3 w-3" /> Recebido
                            </Badge>
                          ) : isAtrasado ? (
                            <Badge variant="destructive" className="gap-1 text-[11px]">
                              <AlertTriangle className="h-3 w-3" /> Atrasado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10 gap-1 text-[11px]">
                              <Clock className="h-3 w-3" /> Em Aberto
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <DataTablePagination
              currentPage={recCurrentPage}
              totalPages={recTotalPages}
              pageSize={recPageSize}
              totalItems={recParcelas.length}
              onPageChange={setRecCurrentPage}
              onPageSizeChange={setRecPageSize}
            />
          </div>
        </TabsContent>

        {/* ==========================================
            ABA 2: CONTAS A PAGAR (FORNECEDORES)
        ========================================== */}
        <TabsContent value="pagar" className="space-y-6 pt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" /> Filtros de Contas a Pagar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-end">
                <div className="space-y-2">
                  <Label>Fornecedor (Específico ou Geral)</Label>
                  <SearchableFornecedorSelect
                    fornecedores={fornecedoresList}
                    value={pagFornecedorId}
                    onValueChange={(id) => setPagFornecedorId(id)}
                    placeholder="Todos os Fornecedores (Geral)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Situação da Despesa</Label>
                  <Select value={pagSituacao} onValueChange={setPagSituacao}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as Situações</SelectItem>
                      <SelectItem value="pago">Apenas Pagas / Baixadas</SelectItem>
                      <SelectItem value="pendente">Apenas Em Aberto / A Pagar</SelectItem>
                      <SelectItem value="atrasado">Apenas Em Atraso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>De (Vencimento)</Label>
                  <Input type="date" value={pagStart} onChange={(e) => setPagStart(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Até (Vencimento)</Label>
                  <Input type="date" value={pagEnd} onChange={(e) => setPagEnd(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t">
                <Button onClick={gerarRelatorioPagar} disabled={pagLoading} className="bg-primary hover:bg-primary/90">
                  <Search className="mr-2 h-4 w-4" /> {pagLoading ? "Filtrando..." : "Filtrar Relatório"}
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => imprimirRelatorio("pagar")} disabled={pagParcelas.length === 0}>
                    <Printer className="mr-2 h-4 w-4 text-slate-700" /> Imprimir Relatório
                  </Button>
                  <Button variant="outline" onClick={() => exportarCsv("pagar")} disabled={pagParcelas.length === 0}>
                    <Download className="mr-2 h-4 w-4 text-emerald-600" /> Exportar CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cards de Resumo */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card className="shadow-sm border-l-4 border-l-blue-500">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total de Despesas Lançadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">R$ {formatCurrency(pagTotalLancado)}</div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-emerald-500">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Pago / Baixado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">R$ {formatCurrency(pagTotalPago)}</div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-rose-500">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total a Pagar (Pendente/Atrasado)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-600">R$ {formatCurrency(pagTotalPendente)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Contas a Pagar */}
          <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor / Credor</TableHead>
                  <TableHead>Descrição / Categoria</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Data Pagamento</TableHead>
                  <TableHead className="text-right">Valor (R$)</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Carregando relatório de contas a pagar...
                    </TableCell>
                  </TableRow>
                ) : pagParcelas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum lançamento encontrado para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagPaginated.map((p) => {
                    const nomeForn = p.despesas?.fornecedores?.razao_social || "Sem Fornecedor";
                    const desc = p.despesas?.descricao || "-";
                    const cat = p.despesas?.categorias_despesa?.nome || "";
                    const isAtrasado = !p.pago && p.data_vencimento && p.data_vencimento.split("T")[0] < hojeStr;

                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">{nomeForn}</div>
                          {p.despesas?.fornecedores?.nome_fantasia && (
                            <div className="text-xs text-muted-foreground">{p.despesas.fornecedores.nome_fantasia}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{desc}</div>
                          {cat && <Badge variant="secondary" className="text-[10px] mt-0.5">{cat}</Badge>}
                        </TableCell>
                        <TableCell>{dataBr(p.data_vencimento)}</TableCell>
                        <TableCell>{dataBr(p.data_pagamento)}</TableCell>
                        <TableCell className="text-right font-bold">R$ {formatCurrency(Number(p.valor || 0))}</TableCell>
                        <TableCell>
                          {p.pago ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[11px]">
                              <CheckCircle2 className="h-3 w-3" /> Pago
                            </Badge>
                          ) : isAtrasado ? (
                            <Badge variant="destructive" className="gap-1 text-[11px]">
                              <AlertTriangle className="h-3 w-3" /> Atrasado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10 gap-1 text-[11px]">
                              <Clock className="h-3 w-3" /> Em Aberto
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <DataTablePagination
              currentPage={pagCurrentPage}
              totalPages={pagTotalPages}
              pageSize={pagPageSize}
              totalItems={pagParcelas.length}
              onPageChange={setPagCurrentPage}
              onPageSizeChange={setPagPageSize}
            />
          </div>
        </TabsContent>

        {/* ==========================================
            ABA 3: EXTRATO GERAL & COMISSÕES
        ========================================== */}
        <TabsContent value="comissoes" className="space-y-6 pt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" /> Filtros do Extrato de Comissões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 items-end">
                <div className="space-y-2">
                  <Label>De (Vencimento)</Label>
                  <Input type="date" value={extStart} onChange={(e) => setExtStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Até (Vencimento)</Label>
                  <Input type="date" value={extEnd} onChange={(e) => setExtEnd(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={extClienteId} onValueChange={setExtClienteId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__todos__">Todos os Clientes</SelectItem>
                      {clientesList.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Vendedor</Label>
                  <Select value={extVendedorId} onValueChange={setExtVendedorId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__todos__">Todos os Vendedores</SelectItem>
                      {vendedoresList.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status Pagamento</Label>
                  <Select value={extStatus} onValueChange={setExtStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__todos__">Ambos</SelectItem>
                      <SelectItem value="pago">Apenas Pagas</SelectItem>
                      <SelectItem value="pendente">Apenas Em Aberto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t">
                <Button onClick={gerarExtrato} disabled={extLoading} className="bg-primary hover:bg-primary/90">
                  <Search className="mr-2 h-4 w-4" /> {extLoading ? "Gerando..." : "Gerar Extrato"}
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => imprimirRelatorio("comissoes")} disabled={extRows.length === 0}>
                    <Printer className="mr-2 h-4 w-4 text-slate-700" /> Imprimir Relatório
                  </Button>
                  <Button variant="outline" onClick={() => exportarCsv("comissoes")} disabled={extRows.length === 0}>
                    <Download className="mr-2 h-4 w-4 text-emerald-600" /> Exportar CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {extResumo && (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Faturado</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">R$ {formatCurrency(extResumo.faturado)}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Recebido</CardTitle></CardHeader><CardContent><div className="text-lg font-bold text-emerald-600">R$ {formatCurrency(extResumo.recebido)}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">A Receber</CardTitle></CardHeader><CardContent><div className="text-lg font-bold text-destructive">R$ {formatCurrency(extResumo.pendente)}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Comissão Total</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">R$ {formatCurrency(extResumo.comissao_total)}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Comissão Paga</CardTitle></CardHeader><CardContent><div className="text-lg font-bold text-emerald-600">R$ {formatCurrency(extResumo.comissao_paga)}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Comissão Pend.</CardTitle></CardHeader><CardContent><div className="text-lg font-bold text-destructive">R$ {formatCurrency(extResumo.comissao_pendente)}</div></CardContent></Card>
            </div>
          )}

          <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>N.F.</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Comissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Carregando extrato de comissões...
                    </TableCell>
                  </TableRow>
                ) : extRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum lançamento encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  extPaginated.map((r, i) => (
                    <TableRow key={`${r.parcela_id || r.venda_id}-${r.vv_id || i}`}>
                      <TableCell className="font-medium">{r.cliente}</TableCell>
                      <TableCell>{r.numero_parcela ? `${r.numero_parcela}ª` : "-"}</TableCell>
                      <TableCell>{dataBr(r.data_vencimento)}</TableCell>
                      <TableCell>{dataBr(r.parcela_pagamento)}</TableCell>
                      <TableCell className="font-bold">R$ {formatCurrency(Number(r.parcela_valor || r.valor_servico || 0))}</TableCell>
                      <TableCell>
                        {r.parcela_id ? (
                          <Badge variant={r.parcela_pago ? "default" : "destructive"} className={r.parcela_pago ? "bg-emerald-600 text-white" : ""}>
                            {r.parcela_pago ? "Paga" : "Em aberto"}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{r.numero_nf || "-"}</TableCell>
                      <TableCell>{r.vendedor_nome || "-"}</TableCell>
                      <TableCell>
                        {r.vv_id ? (
                          <span className="text-xs font-semibold">
                            R$ {formatCurrency(Number(r.valor_comissao || 0))}
                            <Badge variant={r.comissao_paga ? "default" : "secondary"} className={`ml-1 text-[10px] ${r.comissao_paga ? "bg-emerald-600 text-white" : ""}`}>
                              {r.comissao_paga ? "paga" : "pendente"}
                            </Badge>
                          </span>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <DataTablePagination
              currentPage={extCurrentPage}
              totalPages={extTotalPages}
              pageSize={extPageSize}
              totalItems={extRows.length}
              onPageChange={setExtCurrentPage}
              onPageSizeChange={setExtPageSize}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
