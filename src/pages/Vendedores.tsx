import { useEffect, useState } from "react";
import { supabase } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { maskCPF, maskPhone } from "@/lib/masks";
import { DataTablePagination } from "@/components/DataTablePagination";

type Vendedor = {
  id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  cpf: string | null;
  comissao_padrao: number;
  ativo: boolean;
};

const Vendedores = () => {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendedor | null>(null);
  const [form, setForm] = useState({ nome: "", whatsapp: "", email: "", cpf: "", comissao_padrao: "10" });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("vendedores").select("*").order("nome");
    setVendedores(data || []);
  };

  const handleSave = async () => {
    const payload = {
      nome: form.nome,
      whatsapp: form.whatsapp,
      email: form.email,
      cpf: form.cpf,
      comissao_padrao: parseFloat(form.comissao_padrao) || 10,
    };

    if (editing) {
      const { error } = await supabase.from("vendedores").update(payload).eq("id", editing.id);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
      toast({ title: "Vendedor atualizado!" });
    } else {
      const { error } = await supabase.from("vendedores").insert(payload);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
      toast({ title: "Vendedor cadastrado!" });
    }
    setOpen(false);
    setEditing(null);
    setForm({ nome: "", whatsapp: "", email: "", cpf: "", comissao_padrao: "10" });
    load();
  };

  const handleEdit = (v: Vendedor) => {
    setEditing(v);
    setForm({
      nome: v.nome,
      whatsapp: v.whatsapp || "",
      email: v.email || "",
      cpf: v.cpf || "",
      comissao_padrao: String(v.comissao_padrao),
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este vendedor?")) return;
    await supabase.from("vendedores").delete().eq("id", id);
    toast({ title: "Vendedor excluído!" });
    load();
  };

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredVendedores = vendedores.filter((v) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (v.nome || "").toLowerCase().includes(term) ||
      (v.email || "").toLowerCase().includes(term) ||
      (v.cpf || "").toLowerCase().includes(term) ||
      (v.whatsapp || "").toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredVendedores.length / pageSize);
  const paginatedVendedores = filteredVendedores.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendedores</h1>
          <p className="text-muted-foreground">Gerencie sua equipe de vendas e comissões.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar vendedor..."
              className="pl-8"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ nome: "", whatsapp: "", email: "", cpf: "", comissao_padrao: "10" }); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Novo Vendedor</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar Vendedor" : "Novo Vendedor"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: maskPhone(e.target.value) })} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="vendedor@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label>Comissão Padrão (%)</Label>
                  <Input type="number" step="0.1" value={form.comissao_padrao} onChange={(e) => setForm({ ...form, comissao_padrao: e.target.value })} placeholder="5.0" />
                </div>
                <Button onClick={handleSave} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Comissão (%)</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedVendedores.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.nome}</TableCell>
                <TableCell>{v.whatsapp}</TableCell>
                <TableCell>{v.email}</TableCell>
                <TableCell>{v.cpf}</TableCell>
                <TableCell>{v.comissao_padrao}%</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(v)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredVendedores.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum vendedor cadastrado.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredVendedores.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};

export default Vendedores;
