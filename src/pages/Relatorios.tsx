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
import { FileText, Download, Search, Printer } from "lucide-react";

type Cliente = { id: string; nome: string };
type Vendedor = { id: string; nome: string };

const TODOS = "__todos__";

const resumoVazio = {
  faturado: 0,
  recebido: 0,
  pendente: 0,
  comissao_total: 0,
  comissao_paga: 0,
  comissao_pendente: 0,
};

const dataBr = (value: unknown) => {
  if (!value) return "-";
  const raw = String(value);
  const normalized = raw.includes("T") ? raw : `${raw}T12:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "dd/MM/yyyy");
};

const Relatorios = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [clienteId, setClienteId] = useState(TODOS);
  const [vendedorId, setVendedorId] = useState(TODOS);
  const [statusPagamento, setStatusPagamento] = useState(TODOS);
  const [rows, setRows] = useState<any[]>([]);
  const [resumo, setResumo] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    supabase.from("clientes").select("id, nome").order("nome").then(({ data }: any) => setClientes(data || []));
    supabase.from("vendedores").select("id, nome").order("nome").then(({ data }: any) => setVendedores(data || []));
    supabase.from("company_settings").select("*").order("is_default", { ascending: false }).limit(1).maybeSingle().then(({ data }: any) => setCompany(data || null));
    gerar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gerar = async () => {
    setLoading(true);
    const { data, resumo, error } = await getExtrato({
      start: start || undefined,
      end: end || undefined,
      cliente_id: clienteId === TODOS ? undefined : clienteId,
      vendedor_id: vendedorId === TODOS ? undefined : vendedorId,
      status_pagamento: statusPagamento === TODOS ? undefined : statusPagamento,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao gerar relatório", description: error, variant: "destructive" });
      return;
    }
    setRows(Array.isArray(data) ? data : []);
    setResumo(resumo || resumoVazio);
  };

  const exportarCsv = () => {
    if (rows.length === 0) {
      toast({ title: "Nada para exportar", variant: "destructive" });
      return;
    }
    const header = [
      "Cliente", "Mes Ref.", "Valor Servico", "Parcela", "Vencimento", "Pagamento", "Valor Parcela",
      "Parcela Paga", "N.F.", "Vendedor", "Percentual", "Comissao", "Comissao Paga",
    ];
    const linhas = rows.map((r) => [
      r.cliente,
      r.mes_referencia || "",
      Number(r.valor_servico || 0).toFixed(2),
      r.numero_parcela ?? "",
      dataBr(r.data_vencimento),
      dataBr(r.parcela_pagamento),
      Number(r.parcela_valor || 0).toFixed(2),
      r.parcela_pago ? "Sim" : "Nao",
      r.numero_nf || "",
      r.vendedor_nome || "",
      r.percentual != null ? `${r.percentual}%` : "",
      Number(r.valor_comissao || 0).toFixed(2),
      r.comissao_paga ? "Sim" : "Nao",
    ]);
    const csv = [header, ...linhas]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-comissoes-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const imprimirRelatorio = () => {
    if (rows.length === 0) return toast({ title: "Sem dados para imprimir", variant: "destructive" });

    const comp = company || {};
    let logoHtml = "";
    if (comp.logo_url) {
      let logoSrc = comp.logo_url;
      if (logoSrc.startsWith("/")) {
        logoSrc = `${window.location.protocol}//${window.location.host}${logoSrc}`;
      }
      logoHtml = `<img src="${logoSrc}" alt="Logo" style="max-height: 80px; max-width: 200px; object-fit: contain; margin-bottom: 8px;" />`;
    }

    const compEndereco = [comp.endereco, comp.bairro, comp.cidade, comp.cep ? `CEP: ${comp.cep}` : ""]
      .filter(Boolean)
      .join(" - ");

    const compContato = [comp.telefone ? `Tel.: ${comp.telefone}` : "", comp.email ? `Email: ${comp.email}` : ""]
      .filter(Boolean)
      .join(" | ");

    const dataAssinaturaFormatada = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    const tableRows = rows.map((r, idx) => `
      <tr style="font-size: 11px;">
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">${r.cliente}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${r.numero_parcela ? `${r.numero_parcela}ª` : "-"}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${dataBr(r.data_vencimento)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${dataBr(r.parcela_pagamento)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">R$ ${formatCurrency(Number(r.parcela_valor || r.valor_servico || 0))}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${r.parcela_pago ? "Paga" : "Em aberto"}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${r.numero_nf || "-"}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">${r.vendedor_nome || "-"}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">R$ ${formatCurrency(Number(r.valor_comissao || 0))} (${r.comissao_paga ? "paga" : "pendente"})</td>
      </tr>
    `).join("");

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 10px; max-width: 900px; margin: 0 auto;">
        <!-- Cabeçalho idêntico ao do recibo -->
        <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 14px;">
          ${logoHtml}
          <div style="font-size: 16px; font-weight: bold; color: #1e293b; margin-top: 6px;">${comp.name || "Sua Empresa"}</div>
          ${comp.cnpj ? `<div style="font-size: 12px; color: #475569;">CNPJ: ${comp.cnpj}</div>` : ""}
          ${compEndereco ? `<div style="font-size: 12px; color: #475569;">${compEndereco}</div>` : ""}
          ${compContato ? `<div style="font-size: 12px; color: #475569;">${compContato}</div>` : ""}
        </div>

        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="font-size: 18px; margin: 0 0 5px 0; font-weight: bold; color: #0f172a;">RELATÓRIO FINANCEIRO E DE COMISSÕES</h2>
          <div style="font-size: 12px; color: #64748b;">
            Período: ${start ? format(new Date(start + "T12:00:00"), "dd/MM/yyyy") : "Início"} até ${end ? format(new Date(end + "T12:00:00"), "dd/MM/yyyy") : "Fim"}
          </div>
        </div>

        <!-- Resumo -->
        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 20px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font-size: 11px; text-align: center;">
          <div>
            <div style="color: #64748b; margin-bottom: 2px;">Faturado</div>
            <div style="font-weight: bold;">R$ ${formatCurrency(resumo.faturado)}</div>
          </div>
          <div>
            <div style="color: #64748b; margin-bottom: 2px;">Recebido</div>
            <div style="font-weight: bold; color: #16a34a;">R$ ${formatCurrency(resumo.recebido)}</div>
          </div>
          <div>
            <div style="color: #64748b; margin-bottom: 2px;">A Receber</div>
            <div style="font-weight: bold; color: #dc2626;">R$ ${formatCurrency(resumo.pendente)}</div>
          </div>
          <div>
            <div style="color: #64748b; margin-bottom: 2px;">Comissão Total</div>
            <div style="font-weight: bold;">R$ ${formatCurrency(resumo.comissao_total)}</div>
          </div>
          <div>
            <div style="color: #64748b; margin-bottom: 2px;">Comissão Paga</div>
            <div style="font-weight: bold; color: #16a34a;">R$ ${formatCurrency(resumo.comissao_paga)}</div>
          </div>
          <div>
            <div style="color: #64748b; margin-bottom: 2px;">Comissão Pend.</div>
            <div style="font-weight: bold; color: #dc2626;">R$ ${formatCurrency(resumo.comissao_pendente)}</div>
          </div>
        </div>

        <!-- Tabela -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f1f5f9; font-size: 11px;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-weight: bold;">Cliente</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; width: 60px;">Parcela</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; width: 80px;">Vencimento</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; width: 80px;">Pagamento</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; width: 100px;">Valor</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; width: 80px;">Status</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; width: 70px;">N.F.</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-weight: bold;">Vendedor</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; width: 160px;">Comissão</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div style="text-align: right; font-size: 11px; color: #64748b; margin-top: 30px;">
          Relatório emitido em ${dataAssinaturaFormatada}.
        </div>
      </div>
    `;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      return toast({ title: "Bloqueio de pop-up", description: "Permita pop-ups para imprimir.", variant: "destructive" });
    }
    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>Relatório Financeiro</title>
          <style>
            @page { margin: 15mm; }
            body { font-family: Arial, sans-serif; background: #ffffff; margin: 0; }
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" /> Relatórios
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={imprimirRelatorio} disabled={rows.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
          <Button variant="outline" onClick={exportarCsv} disabled={rows.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 items-end">
            <div className="space-y-2">
              <Label>De (vencimento)</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Até (vencimento)</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Select value={vendedorId} onValueChange={setVendedorId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {vendedores.map((v) => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusPagamento} onValueChange={setStatusPagamento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Ambos</SelectItem>
                  <SelectItem value="pago">Pagas</SelectItem>
                  <SelectItem value="pendente">Em aberto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={gerar} disabled={loading}>
              <Search className="mr-2 h-4 w-4" /> {loading ? "Gerando..." : "Gerar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {resumo && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Faturado</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">R$ {formatCurrency(resumo.faturado)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Recebido</CardTitle></CardHeader><CardContent><div className="text-lg font-bold text-emerald-600">R$ {formatCurrency(resumo.recebido)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">A Receber</CardTitle></CardHeader><CardContent><div className="text-lg font-bold text-destructive">R$ {formatCurrency(resumo.pendente)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Comissão Total</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">R$ {formatCurrency(resumo.comissao_total)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Comissão Paga</CardTitle></CardHeader><CardContent><div className="text-lg font-bold text-emerald-600">R$ {formatCurrency(resumo.comissao_paga)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Comissão Pendente</CardTitle></CardHeader><CardContent><div className="text-lg font-bold text-destructive">R$ {formatCurrency(resumo.comissao_pendente)}</div></CardContent></Card>
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
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
            {rows.map((r, i) => (
              <TableRow key={`${r.parcela_id || r.venda_id}-${r.vv_id || i}`}>
                <TableCell className="font-medium">{r.cliente}</TableCell>
                <TableCell>{r.numero_parcela ? `${r.numero_parcela}ª` : "-"}</TableCell>
                <TableCell>{dataBr(r.data_vencimento)}</TableCell>
                <TableCell>{dataBr(r.parcela_pagamento)}</TableCell>
                <TableCell>R$ {formatCurrency(Number(r.parcela_valor || r.valor_servico || 0))}</TableCell>
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
                    <span className="text-xs">
                      R$ {formatCurrency(Number(r.valor_comissao || 0))}
                      <Badge variant={r.comissao_paga ? "default" : "secondary"} className={`ml-1 text-[10px] ${r.comissao_paga ? "bg-emerald-600 text-white" : ""}`}>
                        {r.comissao_paga ? "paga" : "pendente"}
                      </Badge>
                    </span>
                  ) : "-"}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Nenhum lançamento no período. Ajuste os filtros e clique em Gerar.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Relatorios;
