import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/api/client";
import { useAuth } from "@/hooks/useAuth";
import { DollarSign, Clock, TrendingUp, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(210, 70%, 50%)", "hsl(150, 60%, 45%)", "hsl(35, 90%, 55%)", "hsl(280, 60%, 55%)"];

const Dashboard = () => {
  const { isAdmin, user } = useAuth();
  const [faturamento, setFaturamento] = useState(0);
  const [comissoesPendentes, setComissoesPendentes] = useState(0);
  const [vendasRecentes, setVendasRecentes] = useState<any[]>([]);
  const [vendasPorMes, setVendasPorMes] = useState<any[]>([]);
  const [comissoesPorVendedor, setComissoesPorVendedor] = useState<any[]>([]);
  const [statusPagamento, setStatusPagamento] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [isAdmin, user]);

  const loadData = async () => {
    if (!user) return;

    if (isAdmin) {
      const { data: vendas } = await supabase.from("vendas").select("valor_servico, cliente_pagou, mes_referencia, data_venda");
      const total = vendas?.reduce((sum, v) => sum + Number(v.valor_servico), 0) || 0;
      setFaturamento(total);

      // Vendas por mês
      const mesMap: Record<string, number> = {};
      vendas?.forEach((v) => {
        const mes = v.mes_referencia || "Sem ref.";
        mesMap[mes] = (mesMap[mes] || 0) + Number(v.valor_servico);
      });
      setVendasPorMes(Object.entries(mesMap).map(([mes, valor]) => ({ mes, valor })));

      // Status pagamento (pie)
      const pagos = vendas?.filter((v) => v.cliente_pagou).length || 0;
      const pendentes = (vendas?.length || 0) - pagos;
      setStatusPagamento([
        { name: "Pagos", value: pagos },
        { name: "Pendentes", value: pendentes },
      ]);

      // Comissões pendentes
      const { data: comissoes } = await supabase
        .from("venda_vendedores")
        .select("valor_comissao, comissao_paga, vendedores(nome)")
        .order("created_at", { ascending: false });
      const pendentesVal = comissoes?.filter((c) => !c.comissao_paga).reduce((sum, c) => sum + Number(c.valor_comissao), 0) || 0;
      setComissoesPendentes(pendentesVal);

      // Comissões por vendedor (bar)
      const vendedorMap: Record<string, { total: number; pago: number }> = {};
      comissoes?.forEach((c: any) => {
        const nome = c.vendedores?.nome || "Desconhecido";
        if (!vendedorMap[nome]) vendedorMap[nome] = { total: 0, pago: 0 };
        vendedorMap[nome].total += Number(c.valor_comissao);
        if (c.comissao_paga) vendedorMap[nome].pago += Number(c.valor_comissao);
      });
      setComissoesPorVendedor(
        Object.entries(vendedorMap).map(([nome, v]) => ({
          nome,
          total: v.total,
          pago: v.pago,
          pendente: v.total - v.pago,
        }))
      );

      // Vendas recentes
      const { data: recentes } = await supabase
        .from("vendas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      setVendasRecentes(recentes || []);
    } else {
      const { data: vendedor } = await supabase
        .from("vendedores")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (vendedor) {
        const { data: comissoes } = await supabase
          .from("venda_vendedores")
          .select("valor_comissao, comissao_paga, venda_id")
          .eq("vendedor_id", vendedor.id);

        const pendentesVal = comissoes?.filter((c) => !c.comissao_paga).reduce((sum, c) => sum + Number(c.valor_comissao), 0) || 0;
        setComissoesPendentes(pendentesVal);

        const totalComissao = comissoes?.reduce((sum, c) => sum + Number(c.valor_comissao), 0) || 0;
        setFaturamento(totalComissao);

        const pagas = comissoes?.filter((c) => c.comissao_paga).length || 0;
        const pend = (comissoes?.length || 0) - pagas;
        setStatusPagamento([
          { name: "Pagas", value: pagas },
          { name: "Pendentes", value: pend },
        ]);

        const vendaIds = comissoes?.map((c) => c.venda_id) || [];
        if (vendaIds.length > 0) {
          const { data: recentes } = await supabase
            .from("vendas")
            .select("*")
            .in("id", vendaIds)
            .order("created_at", { ascending: false })
            .limit(5);
          setVendasRecentes(recentes || []);

          const mesMap: Record<string, number> = {};
          recentes?.forEach((v) => {
            const mes = v.mes_referencia || "Sem ref.";
            mesMap[mes] = (mesMap[mes] || 0) + Number(v.valor_servico);
          });
          setVendasPorMes(Object.entries(mesMap).map(([mes, valor]) => ({ mes, valor })));
        }
      }
    }
  };

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">
        {isAdmin ? "Dashboard Admin" : "Meu Dashboard"}
      </h2>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {isAdmin ? "Faturamento Total" : "Total Comissões"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(faturamento)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {isAdmin ? "Comissões Pendentes" : "Comissões a Receber"}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(comissoesPendentes)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vendas Recentes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendasRecentes.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Faturamento por Mês */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Faturamento por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            {vendasPorMes.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sem dados disponíveis.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={vendasPorMes}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), "Valor"]} />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Pagamento (Pie) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status dos Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {statusPagamento.every((s) => s.value === 0) ? (
              <p className="text-muted-foreground text-sm">Sem dados disponíveis.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusPagamento}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusPagamento.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comissões por Vendedor (Admin only) */}
      {isAdmin && comissoesPorVendedor.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Comissões por Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comissoesPorVendedor}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v.toFixed(0)}`} />
                <Tooltip formatter={(value: number) => [formatCurrency(value)]} />
                <Legend />
                <Bar dataKey="pago" name="Pago" fill="hsl(150, 60%, 45%)" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="pendente" name="Pendente" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Últimas Vendas */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          {vendasRecentes.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma venda encontrada.</p>
          ) : (
            <div className="space-y-2">
              {vendasRecentes.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0 mr-2">
                    <p className="font-medium truncate">{v.cliente}</p>
                    <p className="text-sm text-muted-foreground">{v.mes_referencia}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(Number(v.valor_servico))}</p>
                    <span className={`text-xs ${v.cliente_pagou ? "text-green-600" : "text-orange-500"}`}>
                      {v.cliente_pagou ? "Pago" : "Pendente"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
