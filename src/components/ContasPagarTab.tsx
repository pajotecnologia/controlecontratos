import { useEffect, useState } from "react";
import { supabase, cleanLogoUrl } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Building2, CreditCard, Copy, Check, CalendarIcon, ChevronLeft, ChevronRight, FileText, CheckCircle2, Clock, AlertTriangle, Paperclip, ExternalLink, Upload, RefreshCw } from "lucide-react";
import { maskCurrency, unmaskCurrency, formatCurrency } from "@/lib/masks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SearchableFornecedorSelect } from "@/components/SearchableFornecedorSelect";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Fornecedor = {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  chave_pix?: string;
  tipo_chave_pix?: string;
  categoria_padrao?: string;
};

type CategoriaDespesa = {
  id: string;
  nome: string;
  cor?: string;
};

type ParcelaDespesa = {
  id: string;
  despesa_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string | null;
  pago: boolean;
  forma_pagamento?: string | null;
  codigo_barras?: string | null;
  comprovante_url?: string | null;
  observacao?: string | null;
  mes_referencia?: string | null;
  despesas?: {
    id: string;
    descricao: string;
    tipo: string;
    periodicidade_recorrencia?: string;
    fornecedor_id?: string;
    categoria_id?: string;
    fornecedores?: Fornecedor;
    categorias_despesa?: CategoriaDespesa;
  };
};

export function ContasPagarTab() {
  const [parcelas, setParcelas] = useState<ParcelaDespesa[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [categorias, setCategorias] = useState<CategoriaDespesa[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [mesFilter, setMesFilter] = useState<string>(MESES[new Date().getMonth()]);
  const [anoFilter, setAnoFilter] = useState<number>(new Date().getFullYear());
  const [fornecedorFilter, setFornecedorFilter] = useState<string>("todos");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("todos");

  // State Nova/Edição Despesa Modal
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDespesaId, setEditingDespesaId] = useState<string | null>(null);

  // Form State
  const [descricao, setDescricao] = useState("");
  const [fornecedorId, setFornecedorId] = useState<string>("sem_fornecedor");
  const [categoriaId, setCategoriaId] = useState<string>("sem_categoria");
  const [tipo, setTipo] = useState<string>("unico"); // 'unico', 'parcelado', 'recorrente'
  const [periodicidade, setPeriodicidade] = useState<string>("mensal");
  const [qtdeParcelas, setQtdeParcelas] = useState<number>(1);
  const [valorTotalDisplay, setValorTotalDisplay] = useState("");
  const [valorTotalNum, setValorTotalNum] = useState<number>(0);
  const [dataEmissao, setDataEmissao] = useState<string>(new Date().toISOString().split("T")[0]);
  const [primeiroVencimento, setPrimeiroVencimento] = useState<string>(new Date().toISOString().split("T")[0]);
  const [formaPagamentoPadrao, setFormaPagamentoPadrao] = useState<string>("pix");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [observacao, setObservacao] = useState("");

  // Modal Baixa State
  const [baixaParcela, setBaixaParcela] = useState<ParcelaDespesa | null>(null);
  const [baixaData, setBaixaData] = useState<string>(new Date().toISOString().split("T")[0]);
  const [baixaFormaPagamento, setBaixaFormaPagamento] = useState<string>("pix");
  const [baixaCodigoBarras, setBaixaCodigoBarras] = useState<string>("");
  const [baixaObs, setBaixaObs] = useState<string>("");
  const [baixaComprovanteUrl, setBaixaComprovanteUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // State para deleção
  const [deleteDespesaId, setDeleteDespesaId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resParc, resForn, resCat] = await Promise.all([
        supabase
          .from("parcelas_despesas")
          .select("*, despesas(*, fornecedores(*), categorias_despesa(*))")
          .order("data_vencimento", { ascending: true }),
        supabase.from("fornecedores").select("*").order("razao_social", { ascending: true }),
        supabase.from("categorias_despesa").select("*").order("nome", { ascending: true }),
      ]);

      if (resParc.data) setParcelas(resParc.data as ParcelaDespesa[]);
      if (resForn.data) setFornecedores(resForn.data as Fornecedor[]);
      if (resCat.data) setCategorias(resCat.data as CategoriaDespesa[]);
    } catch (err: any) {
      toast({ title: "Erro ao carregar contas a pagar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setDescricao("");
    setFornecedorId("sem_fornecedor");
    setCategoriaId("sem_categoria");
    setTipo("unico");
    setPeriodicidade("mensal");
    setQtdeParcelas(1);
    setValorTotalDisplay("");
    setValorTotalNum(0);
    setDataEmissao(new Date().toISOString().split("T")[0]);
    setPrimeiroVencimento(new Date().toISOString().split("T")[0]);
    setFormaPagamentoPadrao("pix");
    setCodigoBarras("");
    setObservacao("");
    setEditingDespesaId(null);
  };

  const handleValorTotalChange = (valStr: string) => {
    const masked = maskCurrency(valStr);
    setValorTotalDisplay(masked);
    setValorTotalNum(unmaskCurrency(masked));
  };

  const handleSaveDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) {
      return toast({ title: "Atenção", description: "Descrição é obrigatória.", variant: "destructive" });
    }
    if (valorTotalNum <= 0) {
      return toast({ title: "Atenção", description: "Informe um valor válido maior que zero.", variant: "destructive" });
    }

    try {
      const despesaPayload = {
        descricao: descricao.trim(),
        fornecedor_id: fornecedorId !== "sem_fornecedor" ? fornecedorId : null,
        categoria_id: categoriaId !== "sem_categoria" ? categoriaId : null,
        tipo,
        periodicidade_recorrencia: tipo === "recorrente" ? periodicidade : null,
        qtde_parcelas: tipo === "parcelado" ? qtdeParcelas : (tipo === "recorrente" ? 12 : 1),
        valor_total: valorTotalNum,
        data_emissao: dataEmissao,
      };

      let despesaId = editingDespesaId;

      if (editingDespesaId) {
        // Atualiza despesa e remove parcelas antigas para regerar
        const { error: upErr } = await supabase.from("despesas").update(despesaPayload).eq("id", editingDespesaId);
        if (upErr) throw upErr;
        await supabase.from("parcelas_despesas").delete().eq("despesa_id", editingDespesaId);
      } else {
        const { data: newDesp, error: insErr } = await supabase.from("despesas").insert([despesaPayload]).select().single();
        if (insErr) throw insErr;
        despesaId = newDesp.id;
      }

      // Gerar Parcelas da Despesa
      const parcelasToInsert: any[] = [];
      const numParcelasToGen = tipo === "parcelado" ? qtdeParcelas : (tipo === "recorrente" ? 12 : 1);
      const valorPorParcela = tipo === "parcelado" ? Number((valorTotalNum / qtdeParcelas).toFixed(2)) : valorTotalNum;

      const baseVenc = new Date(primeiroVencimento + "T12:00:00");

      for (let i = 0; i < numParcelasToGen; i++) {
        let dtVenc: Date;
        if (tipo === "recorrente") {
          if (periodicidade === "mensal") dtVenc = addMonths(baseVenc, i);
          else if (periodicidade === "trimestral") dtVenc = addMonths(baseVenc, i * 3);
          else if (periodicidade === "semestral") dtVenc = addMonths(baseVenc, i * 6);
          else dtVenc = addMonths(baseVenc, i * 12);
        } else {
          dtVenc = addMonths(baseVenc, i);
        }

        const mesStr = `${MESES[dtVenc.getMonth()]}/${dtVenc.getFullYear()}`;
        const dtFmt = format(dtVenc, "yyyy-MM-dd");

        parcelasToInsert.push({
          despesa_id: despesaId,
          numero_parcela: i + 1,
          valor: valorPorParcela,
          data_vencimento: dtFmt,
          mes_referencia: mesStr,
          pago: false,
          forma_pagamento: formaPagamentoPadrao,
          codigo_barras: codigoBarras.trim() || null,
          observacao: observacao.trim() || null,
        });
      }

      const { error: parcErr } = await supabase.from("parcelas_despesas").insert(parcelasToInsert);
      if (parcErr) throw parcErr;

      toast({ title: "Sucesso!", description: `Despesa ${editingDespesaId ? "atualizada" : "registrada"} com sucesso!` });
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao salvar despesa", description: err.message, variant: "destructive" });
    }
  };

  const handleOpenEdit = (parcela: ParcelaDespesa) => {
    if (!parcela.despesas) return;
    const d = parcela.despesas;
    setEditingDespesaId(d.id);
    setDescricao(d.descricao);
    setFornecedorId(d.fornecedor_id || "sem_fornecedor");
    setCategoriaId(d.categoria_id || "sem_categoria");
    setTipo(d.tipo || "unico");
    setPeriodicidade(d.periodicidade_recorrencia || "mensal");
    setValorTotalNum(Number(parcela.valor));
    setValorTotalDisplay(formatCurrency(Number(parcela.valor)));
    setPrimeiroVencimento(parcela.data_vencimento);
    setFormaPagamentoPadrao(parcela.forma_pagamento || "pix");
    setCodigoBarras(parcela.codigo_barras || "");
    setObservacao(parcela.observacao || "");
    setDialogOpen(true);
  };

  const handleDeleteDespesa = async () => {
    if (!deleteDespesaId) return;
    try {
      const { error } = await supabase.from("despesas").delete().eq("id", deleteDespesaId);
      if (error) throw error;
      toast({ title: "Excluída", description: "Despesa removida com sucesso." });
      setDeleteDespesaId(null);
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  // Upload de Comprovante de Pagamento
  const handleUploadComprovante = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no upload");
      setBaixaComprovanteUrl(data.url);
      toast({ title: "Upload concluído!", description: "Comprovante anexado com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // Abrir Dialog de Baixa
  const handleOpenBaixa = (parcela: ParcelaDespesa) => {
    setBaixaParcela(parcela);
    setBaixaData(parcela.data_pagamento ? format(new Date(parcela.data_pagamento), "yyyy-MM-dd") : new Date().toISOString().split("T")[0]);
    setBaixaFormaPagamento(parcela.forma_pagamento || "pix");
    setBaixaCodigoBarras(parcela.codigo_barras || "");
    setBaixaObs(parcela.observacao || "");
    setBaixaComprovanteUrl(parcela.comprovante_url || "");
  };

  const handleConfirmBaixa = async () => {
    if (!baixaParcela) return;
    try {
      const { error } = await supabase
        .from("parcelas_despesas")
        .update({
          pago: true,
          data_pagamento: new Date(baixaData + "T12:00:00").toISOString(),
          forma_pagamento: baixaFormaPagamento,
          codigo_barras: baixaCodigoBarras.trim() || null,
          observacao: baixaObs.trim() || null,
          comprovante_url: baixaComprovanteUrl || null,
        })
        .eq("id", baixaParcela.id);

      if (error) throw error;
      toast({ title: "Baixa realizada!", description: "Pagamento de despesa confirmado." });
      setBaixaParcela(null);
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao dar baixa", description: err.message, variant: "destructive" });
    }
  };

  const handleReabrirParcela = async (parcela: ParcelaDespesa) => {
    if (!confirm("Deseja cancelar a baixa e reabrir esta parcela de despesa?")) return;
    try {
      const { error } = await supabase
        .from("parcelas_despesas")
        .update({
          pago: false,
          data_pagamento: null,
          comprovante_url: null,
        })
        .eq("id", parcela.id);

      if (error) throw error;
      toast({ title: "Parcela reaberta", description: "O pagamento foi marcado como pendente." });
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao reabrir", description: err.message, variant: "destructive" });
    }
  };

  const copyText = (txt: string, id: string, label: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedId(id);
    toast({ title: "Copiado!", description: `${label} copiado para a área de transferência.` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtragem das Parcelas
  const filteredParcelas = parcelas.filter((p) => {
    const desc = (p.despesas?.descricao || "").toLowerCase();
    const forn = (p.despesas?.fornecedores?.razao_social || "").toLowerCase();
    const cat = (p.despesas?.categorias_despesa?.nome || "").toLowerCase();
    const term = search.toLowerCase();

    const matchesSearch = desc.includes(term) || forn.includes(term) || cat.includes(term);

    // Mês/Ano Filter
    const mesAnoStr = `${mesFilter}/${anoFilter}`;
    const matchesMes = p.mes_referencia === mesAnoStr || (p.data_vencimento && p.data_vencimento.startsWith(`${anoFilter}-${String(MESES.indexOf(mesFilter) + 1).padStart(2, "0")}`));

    // Status Filter
    const hojeStr = new Date().toISOString().split("T")[0];
    const isAtrasado = !p.pago && p.data_vencimento < hojeStr;

    let matchesStatus = true;
    if (statusFilter === "pago") matchesStatus = p.pago;
    if (statusFilter === "pendente") matchesStatus = !p.pago && !isAtrasado;
    if (statusFilter === "atrasado") matchesStatus = isAtrasado;

    // Fornecedor Filter
    let matchesForn = true;
    if (fornecedorFilter !== "todos") matchesForn = p.despesas?.fornecedor_id === fornecedorFilter;

    // Categoria Filter
    let matchesCat = true;
    if (categoriaFilter !== "todos") matchesCat = p.despesas?.categoria_id === categoriaFilter;

    return matchesSearch && matchesMes && matchesStatus && matchesForn && matchesCat;
  });

  // Calculos KPI do mês selecionado
  const totalAPagarMes = filteredParcelas.reduce((acc, p) => acc + Number(p.valor || 0), 0);
  const totalPagoMes = filteredParcelas.filter((p) => p.pago).reduce((acc, p) => acc + Number(p.valor || 0), 0);
  const totalPendenteMes = filteredParcelas.filter((p) => !p.pago).reduce((acc, p) => acc + Number(p.valor || 0), 0);
  
  const hojeStr = new Date().toISOString().split("T")[0];
  const totalAtrasadoMes = filteredParcelas.filter((p) => !p.pago && p.data_vencimento < hojeStr).reduce((acc, p) => acc + Number(p.valor || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Contas a Pagar</h2>
          <p className="text-sm text-muted-foreground">Gerencie seus compromissos financeiros, fornecedores e lançamentos de despesas.</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Nova Despesa
        </Button>
      </div>

      {/* Navegação por Mês & KPIs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-card border p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const idx = MESES.indexOf(mesFilter);
              if (idx === 0) { setMesFilter(MESES[11]); setAnoFilter(anoFilter - 1); }
              else { setMesFilter(MESES[idx - 1]); }
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Select value={mesFilter} onValueChange={setMesFilter}>
            <SelectTrigger className="w-36 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            className="w-20 font-semibold"
            value={anoFilter}
            onChange={(e) => setAnoFilter(parseInt(e.target.value) || new Date().getFullYear())}
          />

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const idx = MESES.indexOf(mesFilter);
              if (idx === 11) { setMesFilter(MESES[0]); setAnoFilter(anoFilter + 1); }
              else { setMesFilter(MESES[idx + 1]); }
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Resumo do Mês */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center md:text-right">
          <div>
            <span className="text-xs text-muted-foreground block">Total no Mês</span>
            <span className="text-base font-bold text-foreground">R$ {formatCurrency(totalAPagarMes)}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Pago</span>
            <span className="text-base font-bold text-emerald-600">R$ {formatCurrency(totalPagoMes)}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">A Pagar</span>
            <span className="text-base font-bold text-amber-600">R$ {formatCurrency(totalPendenteMes)}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Em Atraso</span>
            <span className="text-base font-bold text-rose-600">R$ {formatCurrency(totalAtrasadoMes)}</span>
          </div>
        </div>
      </div>

      {/* Filtros em Linha */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar despesa ou fornecedor..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="pago">Pagas</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="atrasado">Atrasadas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Fornecedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Fornecedores</SelectItem>
            {fornecedores.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.razao_social}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as Categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela de Contas a Pagar */}
      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Descrição / Fornecedor</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="whitespace-nowrap min-w-[140px]">Valor (R$)</TableHead>
              <TableHead>Status / Baixa</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Carregando contas a pagar...
                </TableCell>
              </TableRow>
            ) : filteredParcelas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma conta a pagar encontrada para os filtros selecionados.
                </TableCell>
              </TableRow>
            ) : (
              filteredParcelas.map((p) => {
                const isAtrasado = !p.pago && p.data_vencimento < hojeStr;
                const forn = p.despesas?.fornecedores;
                const cat = p.despesas?.categorias_despesa;

                return (
                  <TableRow key={p.id} className={p.pago ? "bg-muted/20" : isAtrasado ? "bg-rose-500/5" : ""}>
                    <TableCell>
                      <div className="font-mono text-sm font-medium">
                        {p.data_vencimento ? format(new Date(p.data_vencimento + "T12:00:00"), "dd/MM/yyyy") : "-"}
                      </div>
                      {p.numero_parcela > 1 && (
                        <span className="text-[11px] text-muted-foreground block">
                          Parcela {p.numero_parcela}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{p.despesas?.descricao}</div>
                      {forn && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span>{forn.razao_social}</span>
                          {forn.chave_pix && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 text-emerald-600 hover:text-emerald-700"
                              title="Copiar Chave PIX"
                              onClick={() => copyText(forn.chave_pix!, p.id, "Chave PIX")}
                            >
                              {copiedId === p.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {cat ? (
                        <Badge
                          variant="outline"
                          className="text-[11px] font-normal"
                          style={{ borderColor: cat.cor || "#64748b", color: cat.cor || "#64748b" }}
                        >
                          {cat.nome}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[11px] uppercase tracking-wide">
                        {p.despesas?.tipo === "recorrente" ? "Recorrente" : p.despesas?.tipo === "parcelado" ? `Parcelado (${p.numero_parcela}/${p.despesas?.qtde_parcelas})` : "Único"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap min-w-[140px]">
                      <span className="font-bold text-base text-foreground">R$ {formatCurrency(Number(p.valor))}</span>
                    </TableCell>
                    <TableCell>
                      {p.pago ? (
                        <div className="space-y-1">
                          <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 gap-1 text-[11px]">
                            <CheckCircle2 className="h-3 w-3" /> Pago
                          </Badge>
                          {p.data_pagamento && (
                            <div className="text-[10px] text-muted-foreground">
                              em {format(new Date(p.data_pagamento), "dd/MM/yyyy")}
                            </div>
                          )}
                        </div>
                      ) : isAtrasado ? (
                        <Badge variant="destructive" className="gap-1 text-[11px]">
                          <AlertTriangle className="h-3 w-3" /> Atrasado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10 gap-1 text-[11px]">
                          <Clock className="h-3 w-3" /> Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {p.pago ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-amber-600"
                          onClick={() => handleReabrirParcela(p)}
                          title="Reabrir baixa"
                        >
                          Desfazer Baixa
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-2.5"
                          onClick={() => handleOpenBaixa(p)}
                        >
                          Pagar / Dar Baixa
                        </Button>
                      )}

                      {p.comprovante_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600"
                          title="Ver Comprovante"
                          onClick={() => window.open(cleanLogoUrl(p.comprovante_url!), "_blank")}
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenEdit(p)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeleteDespesaId(p.despesa_id)}
                        title="Excluir Despesa"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal Dialog Criar/Editar Despesa */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDespesaId ? "Editar Despesa" : "Nova Despesa / Conta a Pagar"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveDespesa} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição da Despesa *</Label>
              <Input
                id="descricao"
                placeholder="Ex: Aluguel do Escritório, Licença Adobe, Conta de Luz"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fornecedor (Opcional)</Label>
                <SearchableFornecedorSelect
                  fornecedores={fornecedores}
                  value={fornecedorId}
                  onValueChange={setFornecedorId}
                  placeholder="Pesquisar fornecedor..."
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria de Custo</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem_categoria">Sem Categoria</SelectItem>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Lançamento</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unico">Lançamento Único</SelectItem>
                    <SelectItem value="parcelado">Parcelado em N vezes</SelectItem>
                    <SelectItem value="recorrente">Despesa Recorrente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipo === "parcelado" ? (
                <div className="space-y-2">
                  <Label htmlFor="qtde_parc">Qtde. de Parcelas</Label>
                  <Input
                    id="qtde_parc"
                    type="number"
                    min={1}
                    max={60}
                    value={qtdeParcelas}
                    onChange={(e) => setQtdeParcelas(parseInt(e.target.value) || 1)}
                  />
                </div>
              ) : tipo === "recorrente" ? (
                <div className="space-y-2">
                  <Label>Frequência Recorrência</Label>
                  <Select value={periodicidade} onValueChange={setPeriodicidade}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="trimestral">Trimestral</SelectItem>
                      <SelectItem value="semestral">Semestral</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <div className="space-y-2 bg-primary/5 p-3 rounded-lg border border-primary/20">
              <Label htmlFor="valor_total" className="text-sm font-semibold text-foreground flex items-center justify-between">
                <span>{tipo === "parcelado" ? "Valor Total da Despesa *" : "Valor da Despesa *"}</span>
                <span className="text-xs text-muted-foreground font-normal">(Informe o valor numérico em Reais)</span>
              </Label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-base font-bold text-primary">R$</span>
                <Input
                  id="valor_total"
                  className="pl-10 text-xl font-bold h-12 border-primary/40 focus-visible:ring-primary w-full bg-background"
                  placeholder="0,00"
                  value={valorTotalDisplay}
                  onChange={(e) => handleValorTotalChange(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_emissao">Data de Emissão / Competência</Label>
                <Input
                  id="data_emissao"
                  type="date"
                  value={dataEmissao}
                  onChange={(e) => setDataEmissao(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vencimento">1º Vencimento / Data do Vencimento *</Label>
                <Input
                  id="vencimento"
                  type="date"
                  value={primeiroVencimento}
                  onChange={(e) => setPrimeiroVencimento(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo_barras">Código de Barras / Linha Digitável (Boleto)</Label>
              <Input
                id="codigo_barras"
                placeholder="Cole a linha digitável do boleto se houver"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea
                id="obs"
                rows={2}
                placeholder="Anotações adicionais sobre esta despesa..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                {editingDespesaId ? "Salvar Alterações" : "Registrar Despesa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog Baixa / Confirmar Pagamento */}
      <Dialog open={!!baixaParcela} onOpenChange={(o) => !o && setBaixaParcela(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento de Despesa</DialogTitle>
          </DialogHeader>

          {baixaParcela && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg space-y-1">
                <div className="font-semibold text-sm">{baixaParcela.despesas?.descricao}</div>
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>Valor: R$ {formatCurrency(Number(baixaParcela.valor))}</span>
                  <span>Vencimento: {format(new Date(baixaParcela.data_vencimento + "T12:00:00"), "dd/MM/yyyy")}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="baixa_data">Data do Pagamento *</Label>
                <Input
                  id="baixa_data"
                  type="date"
                  value={baixaData}
                  onChange={(e) => setBaixaData(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={baixaFormaPagamento} onValueChange={setBaixaFormaPagamento}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="boleto">Boleto Bancário</SelectItem>
                    <SelectItem value="transferencia">Transferência / TED</SelectItem>
                    <SelectItem value="cartao">Cartão de Crédito/Débito</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Anexar Comprovante / Nota Fiscal</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleUploadComprovante(e.target.files[0]);
                    }}
                    disabled={uploading}
                  />
                </div>
                {baixaComprovanteUrl && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Comprovante anexado
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="baixa_obs">Observações / N.F.</Label>
                <Input
                  id="baixa_obs"
                  placeholder="Número de comprovante ou nota fiscal"
                  value={baixaObs}
                  onChange={(e) => setBaixaObs(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setBaixaParcela(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmBaixa} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Confirmar Baixa
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AlertDialog Exclusão */}
      <AlertDialog open={!!deleteDespesaId} onOpenChange={() => setDeleteDespesaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a despesa e todas as suas parcelas de lançamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDespesa} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
