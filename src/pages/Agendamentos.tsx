import { useEffect, useState } from "react";
import { getAgendamentos, cancelarAgendamento } from "@/integrations/api/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { CalendarClock, Trash2, MessageSquare, Mail } from "lucide-react";

export default function Agendamentos() {
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAgendamentos();
      setAgendamentos(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setErrorState(err.message);
    }
    setLoading(false);
  };

  if (errorState) {
    return <div className="p-6 text-red-500">Erro ao carregar: {errorState}</div>;
  }

  useEffect(() => {
    load();
  }, []);

  const handleCancelar = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar este envio agendado?")) return;
    const { ok, json } = await cancelarAgendamento(id);
    if (ok !== false) {
      toast({ title: "Agendamento cancelado com sucesso." });
      load();
    } else {
      toast({ title: "Erro ao cancelar", description: json?.error, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-violet-600" />
          Envios Agendados
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Acompanhe e cancele mensagens (WhatsApp e E-mail) que estão programadas para serem enviadas no futuro.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-700">Fila de Agendamentos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data e Hora Agendada</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px] text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                  </TableRow>
                )}
                {!loading && (!agendamentos || agendamentos.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum agendamento pendente no momento.
                    </TableCell>
                  </TableRow>
                )}
                {Array.isArray(agendamentos) && agendamentos.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {a.data_agendamento && !isNaN(new Date(a.data_agendamento).getTime()) 
                        ? format(new Date(a.data_agendamento), "dd/MM/yyyy 'às' HH:mm") 
                        : "Data inválida"}
                    </TableCell>
                    <TableCell>
                      {a.canal === "whatsapp" ? (
                        <Badge variant="outline" className="text-emerald-700 border-emerald-300 gap-1"><MessageSquare className="h-3 w-3" /> WhatsApp</Badge>
                      ) : (
                        <Badge variant="outline" className="text-blue-700 border-blue-300 gap-1"><Mail className="h-3 w-3" /> E-mail</Badge>
                      )}
                    </TableCell>
                    <TableCell className="uppercase text-xs text-slate-500 font-medium">
                      {(a.referencia_tipo || "").replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800">{a.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleCancelar(a.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
