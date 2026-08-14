import { useEffect, useState } from "react";
import { supabase } from "@/integrations/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/masks";
import { TrendingUp, TrendingDown, DollarSign, Wallet, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function FluxoCaixaTab() {
  const [loading, setLoading] = useState(true);
  const [anoFilter, setAnoFilter] = useState<number>(new Date().getFullYear());
  const [chartData, setChartData] = useState<any[]>([]);

  const [totaisAno, setTotaisAno] = useState({
    receitaPrevista: 0,
    receitaRealizada: 0,
    despesaPrevista: 0,
    despesaRealizada: 0,
    saldoPrevisto: 0,
    saldoRealizado: 0,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // Buscar parcelas de receita (Contratos de Clientes)
      const { data: recData } = await supabase.from("parcelas").select("valor, data_vencimento, pago, mes_referencia");

      // Buscar parcelas de despesa (Contas a Pagar)
      const { data: despData } = await supabase.from("parcelas_despesas").select("valor, data_vencimento, pago, mes_referencia");

      const monthlyStats = MESES.map((mes, idx) => {
        const monthNumStr = String(idx + 1).padStart(2, "0");
        const prefix = `${anoFilter}-${monthNumStr}`;
        const mesRefStr = `${mes}/${anoFilter}`;

        // Filtrar parcelas de receita do mês
        const recsMes = (recData || []).filter((r: any) => 
          r.mes_referencia === mesRefStr || (r.data_vencimento && r.data_vencimento.startsWith(prefix))
        );

        // Filtrar parcelas de despesa do mês
        const despsMes = (despData || []).filter((d: any) => 
          d.mes_referencia === mesRefStr || (d.data_vencimento && d.data_vencimento.startsWith(prefix))
        );

        const receitaPrevista = recsMes.reduce((acc: number, item: any) => acc + Number(item.valor || 0), 0);
        const receitaRealizada = recsMes.filter((item: any) => item.pago).reduce((acc: number, item: any) => acc + Number(item.valor || 0), 0);

        const despesaPrevista = despsMes.reduce((acc: number, item: any) => acc + Number(item.valor || 0), 0);
        const despesaRealizada = despsMes.filter((item: any) => item.pago).reduce((acc: number, item: any) => acc + Number(item.valor || 0), 0);

        const saldoPrevisto = receitaPrevista - despesaPrevista;
        const saldoRealizado = receitaRealizada - despesaRealizada;

        return {
          mes: mes.slice(0, 3),
          nomeMes: mes,
          receitaPrevista,
          receitaRealizada,
          despesaPrevista,
          despesaRealizada,
          saldoPrevisto,
          saldoRealizado,
        };
      });

      setChartData(monthlyStats);

      // Calcular totais anuais
      const totRecPrev = monthlyStats.reduce((acc, m) => acc + m.receitaPrevista, 0);
      const totRecReal = monthlyStats.reduce((acc, m) => acc + m.receitaRealizada, 0);
      const totDespPrev = monthlyStats.reduce((acc, m) => acc + m.despesaPrevista, 0);
      const totDespReal = monthlyStats.reduce((acc, m) => acc + m.despesaRealizada, 0);

      setTotaisAno({
        receitaPrevista: totRecPrev,
        receitaRealizada: totRecReal,
        despesaPrevista: totDespPrev,
        despesaRealizada: totDespReal,
        saldoPrevisto: totRecPrev - totDespPrev,
        saldoRealizado: totRecReal - totDespReal,
      });

    } catch (err: any) {
      console.error("[FLUXO DE CAIXA ERRO]", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [anoFilter]);

  return (
    <div className="space-y-6">
      {/* Header & Filtro de Ano */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Fluxo de Caixa Consolidado</h2>
          <p className="text-sm text-muted-foreground">Comparativo de Receitas (Entradas) x Despesas (Saídas) do exercício.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">Ano Exibido:</span>
          <Select value={String(anoFilter)} onValueChange={(v) => setAnoFilter(Number(v))}>
            <SelectTrigger className="w-28 font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards Consolidados */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas Anuais (Entradas)</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">R$ {formatCurrency(totaisAno.receitaRealizada)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Previsto: R$ {formatCurrency(totaisAno.receitaPrevista)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-rose-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas Anuais (Saídas)</CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">R$ {formatCurrency(totaisAno.despesaRealizada)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Previsto: R$ {formatCurrency(totaisAno.despesaPrevista)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Realizado no Ano</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totaisAno.saldoRealizado >= 0 ? "text-blue-600" : "text-rose-600"}`}>
              R$ {formatCurrency(totaisAno.saldoRealizado)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receitas Pagas menos Despesas Pagas
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-violet-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Previsto no Ano</CardTitle>
            <DollarSign className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totaisAno.saldoPrevisto >= 0 ? "text-violet-600" : "text-rose-600"}`}>
              R$ {formatCurrency(totaisAno.saldoPrevisto)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Projeção total de contrato x despesa
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Comparativo Mês a Mês */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Comparativo Mensal de Entradas vs Saídas ({anoFilter})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Carregando gráfico...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip
                    formatter={(value: any) => [`R$ ${formatCurrency(Number(value))}`, ""]}
                    labelFormatter={(label, payload) => {
                      const item = payload[0]?.payload;
                      return item ? `${item.nomeMes} / ${anoFilter}` : label;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="receitaRealizada" name="Receita Realizada (Entradas)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesaRealizada" name="Despesa Realizada (Saídas)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela Detalhada por Mês */}
      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-emerald-600 font-semibold">Receitas Realizadas</TableHead>
              <TableHead className="text-rose-600 font-semibold">Despesas Realizadas</TableHead>
              <TableHead>Resultado Realizado</TableHead>
              <TableHead className="text-muted-foreground">Resultado Previsto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chartData.map((m) => {
              const resultReal = m.saldoRealizado;
              const resultPrev = m.saldoPrevisto;

              return (
                <TableRow key={m.nomeMes}>
                  <TableCell className="font-semibold">{m.nomeMes}</TableCell>
                  <TableCell className="text-emerald-600 font-medium">R$ {formatCurrency(m.receitaRealizada)}</TableCell>
                  <TableCell className="text-rose-600 font-medium">R$ {formatCurrency(m.despesaRealizada)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={resultReal >= 0 ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10" : "text-rose-600 border-rose-500/30 bg-rose-500/10"}>
                      {resultReal >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                      R$ {formatCurrency(resultReal)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    R$ {formatCurrency(resultPrev)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
