import { useEffect, useState } from "react";
import { supabase } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { maskCEP, maskCPFCNPJ, maskPhone, maskCPF } from "@/lib/masks";

type Cliente = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf_cnpj: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  nome_responsavel: string | null;
  cargo_responsavel: string | null;
  cpf_responsavel: string | null;
};

const EMPTY_FORM = { nome: "", telefone: "", email: "", cpf_cnpj: "", endereco: "", bairro: "", cidade: "", estado: "", cep: "", nome_responsavel: "", cargo_responsavel: "", cpf_responsavel: "" };

const Clientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("clientes").select("*").order("nome");
    setClientes(data || []);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return toast({ title: "Nome é obrigatório", variant: "destructive" });

    const payload = {
      nome: form.nome,
      telefone: form.telefone,
      email: form.email,
      cpf_cnpj: form.cpf_cnpj,
      endereco: form.endereco,
      bairro: form.bairro,
      cidade: form.cidade,
      estado: form.estado,
      cep: form.cep,
      nome_responsavel: form.nome_responsavel,
      cargo_responsavel: form.cargo_responsavel,
      cpf_responsavel: form.cpf_responsavel,
    };

    if (editing) {
      const { error } = await supabase.from("clientes").update(payload).eq("id", editing.id);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
      toast({ title: "Cliente updated!" });
    } else {
      const { error } = await supabase.from("clientes").insert(payload);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
      toast({ title: "Cliente cadastrado!" });
    }
    setOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    load();
  };

  const handleEdit = (c: Cliente) => {
    setEditing(c);
    setForm({
      nome: c.nome,
      telefone: c.telefone || "",
      email: c.email || "",
      cpf_cnpj: c.cpf_cnpj || "",
      endereco: c.endereco || "",
      bairro: c.bairro || "",
      cidade: c.cidade || "",
      estado: c.estado || "",
      cep: c.cep || "",
      nome_responsavel: c.nome_responsavel || "",
      cargo_responsavel: c.cargo_responsavel || "",
      cpf_responsavel: c.cpf_responsavel || "",
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este cliente?")) return;
    await supabase.from("clientes").delete().eq("id", id);
    toast({ title: "Cliente excluído!" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Clientes</h2>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ ...EMPTY_FORM }); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Nome (linha inteira) */}
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>

              {/* Telefone + E-mail */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })} placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>

              {/* CPF/CNPJ + Endereço */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CPF/CNPJ</Label>
                  <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: maskCPFCNPJ(e.target.value) })} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número" />
                </div>
              </div>

              {/* CEP + Bairro */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: maskCEP(e.target.value) })} placeholder="00000-000" />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
                </div>
              </div>

              {/* Cidade + Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Cidade</Label>
                  <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Estado (UF)</Label>
                  <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })} placeholder="UF" maxLength={2} />
                </div>
              </div>

              {/* Seção Responsável */}
              <div className="rounded-lg border p-3 space-y-3">
                <Label className="font-semibold text-sm">Responsável</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={form.nome_responsavel} onChange={(e) => setForm({ ...form, nome_responsavel: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo</Label>
                    <Input value={form.cargo_responsavel} onChange={(e) => setForm({ ...form, cargo_responsavel: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={form.cpf_responsavel} onChange={(e) => setForm({ ...form, cpf_responsavel: maskCPF(e.target.value) })} placeholder="000.000.000-00" />
                </div>
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
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell>{c.telefone}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>{c.cpf_cnpj}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {clientes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum cliente cadastrado.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Clientes;
