import { useEffect, useState } from "react";
import { supabase } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { maskCPF, maskPhone } from "@/lib/masks";

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Vendedores</h2>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ nome: "", whatsapp: "", email: "", cpf: "", comissao_padrao: "10" }); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Novo Vendedor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Vendedor" : "Novo Vendedor"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: maskPhone(e.target.value) })} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="vendedor@email.com" />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label>Comissão Padrão (%)</Label>
                <Input type="number" step="0.01" value={form.comissao_padrao} onChange={(e) => setForm({ ...form, comissao_padrao: e.target.value })} />
              </div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
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
            {vendedores.map((v) => (
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
            {vendedores.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum vendedor cadastrado.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Vendedores;
