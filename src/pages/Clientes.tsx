import { useEffect, useState } from "react";
import { supabase } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { maskCEP, maskCPFCNPJ, maskPhone, maskCPF } from "@/lib/masks";
import { DataTablePagination } from "@/components/DataTablePagination";

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

const EMPTY_FORM = {
  nome: "",
  telefone: "",
  email: "",
  cpf_cnpj: "",
  endereco: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  nome_responsavel: "",
  cargo_responsavel: "",
  cpf_responsavel: "",
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    load();
  }, []);

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
      toast({ title: "Cliente atualizado!" });
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

  const filteredClientes = clientes.filter((c) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (c.nome || "").toLowerCase().includes(term) ||
      (c.cpf_cnpj || "").toLowerCase().includes(term) ||
      (c.email || "").toLowerCase().includes(term) ||
      (c.telefone || "").toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredClientes.length / pageSize);
  const paginatedClientes = filteredClientes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Gerencie seus clientes cadastrados.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              className="pl-8"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ ...EMPTY_FORM }); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Nome / Razão Social <span className="text-destructive">*</span></Label>
                    <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo ou Razão Social" />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF/CNPJ</Label>
                    <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: maskCPFCNPJ(e.target.value) })} placeholder="000.000.000-00" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Telefone / WhatsApp</Label>
                    <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })} placeholder="(00) 00000-0000" />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cliente@email.com" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Endereço</Label>
                    <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número, complemento" />
                  </div>
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: maskCEP(e.target.value) })} placeholder="00000-000" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} placeholder="Bairro" />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Cidade" />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado (UF)</Label>
                    <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })} placeholder="UF" maxLength={2} />
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-3 bg-slate-50/50">
                  <Label className="font-semibold text-sm text-slate-800">Dados do Responsável / Contato</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Nome do Responsável</Label>
                      <Input value={form.nome_responsavel} onChange={(e) => setForm({ ...form, nome_responsavel: e.target.value })} placeholder="Nome do contato" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Cargo / Função</Label>
                      <Input value={form.cargo_responsavel} onChange={(e) => setForm({ ...form, cargo_responsavel: e.target.value })} placeholder="Ex.: Diretor" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">CPF do Responsável</Label>
                      <Input value={form.cpf_responsavel} onChange={(e) => setForm({ ...form, cpf_responsavel: maskCPF(e.target.value) })} placeholder="000.000.000-00" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave} className="px-6">{editing ? "Atualizar Cliente" : "Salvar Cliente"}</Button>
                </div>
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
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedClientes.map((c) => (
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
            {filteredClientes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum cliente cadastrado.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredClientes.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
