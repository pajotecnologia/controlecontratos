import { useEffect, useState } from "react";
import { supabase } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Tag, Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type CategoriaDespesa = {
  id: string;
  nome: string;
  cor?: string;
  descricao?: string;
  created_at: string;
};

const PALETA_CORES = [
  "#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#64748b",
];

export function CategoriasDespesaTab() {
  const [categorias, setCategorias] = useState<CategoriaDespesa[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoriaDespesa | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#3b82f6");
  const [descricao, setDescricao] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("categorias_despesa").select("*").order("nome", { ascending: true });
      if (error) throw error;
      if (data) setCategorias(data as CategoriaDespesa[]);
    } catch (err: any) {
      toast({ title: "Erro ao carregar categorias", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setNome("");
    setCor("#3b82f6");
    setDescricao("");
    setEditingCategory(null);
  };

  const handleOpenEdit = (cat: CategoriaDespesa) => {
    setEditingCategory(cat);
    setNome(cat.nome);
    setCor(cat.cor || "#3b82f6");
    setDescricao(cat.descricao || "");
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      return toast({ title: "Atenção", description: "Nome da categoria é obrigatório.", variant: "destructive" });
    }

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("categorias_despesa")
          .update({ nome: nome.trim(), cor, descricao: descricao.trim() })
          .eq("id", editingCategory.id);
        if (error) throw error;
        toast({ title: "Categoria atualizada!" });
      } else {
        const { error } = await supabase
          .from("categorias_despesa")
          .insert([{ nome: nome.trim(), cor, descricao: descricao.trim() }]);
        if (error) throw error;
        toast({ title: "Categoria cadastrada com sucesso!" });
      }

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("categorias_despesa").delete().eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Categoria excluída!" });
      setDeleteId(null);
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Categorias de Despesas / Centros de Custo</h2>
          <p className="text-sm text-muted-foreground">Classifique seus gastos para relatórios e fluxo de caixa detalhados.</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Nova Categoria
        </Button>
      </div>

      {/* Tabela de Categorias */}
      <div className="rounded-md border bg-card shadow-sm max-w-4xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cor</TableHead>
              <TableHead>Nome da Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Carregando categorias...
                </TableCell>
              </TableRow>
            ) : categorias.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhuma categoria cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              categorias.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full border shadow-sm" style={{ backgroundColor: item.cor || "#64748b" }} />
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    <Badge variant="outline" style={{ borderColor: item.cor || "#64748b", color: item.cor || "#64748b" }}>
                      {item.nome}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.descricao || "-"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(item)} title="Editar">
                      <Pencil className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Editar Categoria" : "Nova Categoria de Despesa"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat_nome">Nome da Categoria *</Label>
              <Input
                id="cat_nome"
                placeholder="Ex: Aluguel, SaaS & Softwares, Pessoal"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Cor de Identificação Visual</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  className="w-12 h-10 p-1 cursor-pointer"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                />
                <div className="flex flex-wrap gap-1.5">
                  {PALETA_CORES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="h-6 w-6 rounded-full border shadow-xs transition-transform hover:scale-110"
                      style={{ backgroundColor: c }}
                      onClick={() => setCor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat_desc">Descrição</Label>
              <Textarea
                id="cat_desc"
                rows={2}
                placeholder="Finalidade desta categoria de custo..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                {editingCategory ? "Salvar Alterações" : "Cadastrar Categoria"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog Exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá a categoria. Despesas vinculadas perderão o vínculo com esta categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
