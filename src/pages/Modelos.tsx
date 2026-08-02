import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { tagsVariaveisModelo } from "@/lib/modeloVariaveis";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Modelo = {
  id: string;
  nome: string;
  conteudo: string;
  created_at?: string;
  updated_at?: string;
};

const TODAS_VARIAVEIS = tagsVariaveisModelo;

const Modelos = () => {
  const navigate = useNavigate();
  const [modelos, setModelos] = useState<Modelo[]>([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from("modelos").select("*").order("nome");
    setModelos(data || []);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este modelo?")) return;
    const { error } = await supabase.from("modelos").delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Modelo excluído!" });
    load();
  };

  const previewCurtinho = (texto: string) => {
    const semHtml = (texto || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!semHtml) return "Sem conteúdo";
    return semHtml.length > 140 ? `${semHtml.slice(0, 140)}...` : semHtml;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Modelos</h2>
          <p className="text-sm text-muted-foreground">
            Defina texto-base com variáveis para montar contratos dinâmicos.
          </p>
        </div>

        <Button onClick={() => navigate("/modelos/novo")}>
          <Plus className="mr-2 h-4 w-4" /> Novo Modelo
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Resumo do texto</TableHead>
              <TableHead>Variáveis</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modelos.map((modelo) => {
              const total = TODAS_VARIAVEIS.filter((item) => (modelo.conteudo || "").includes(item)).length;

              return (
                <TableRow key={modelo.id}>
                  <TableCell className="font-medium">{modelo.nome}</TableCell>
                  <TableCell className="max-w-[500px] text-sm text-muted-foreground">{previewCurtinho(modelo.conteudo)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{total} usada(s)</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/modelos/${modelo.id}/editar`)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(modelo.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {modelos.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nenhum modelo cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Modelos;
