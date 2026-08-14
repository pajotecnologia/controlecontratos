import { useEffect, useState } from "react";
import { supabase } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Building2, Phone, Mail, MapPin, CreditCard, Copy, Check, Power } from "lucide-react";
import { maskCPFCNPJ, maskPhone } from "@/lib/masks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTablePagination } from "@/components/DataTablePagination";

type Fornecedor = {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cpf_cnpj?: string;
  inscricao_estadual?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  contato_nome?: string;
  cep?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  tipo_chave_pix?: string;
  chave_pix?: string;
  categoria_padrao?: string;
  observacoes?: string;
  ativo: boolean;
  created_at: string;
};

type CategoriaDespesa = {
  id: string;
  nome: string;
  cor?: string;
};

export default function Fornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [categorias, setCategorias] = useState<CategoriaDespesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    razao_social: "",
    nome_fantasia: "",
    cpf_cnpj: "",
    inscricao_estadual: "",
    telefone: "",
    whatsapp: "",
    email: "",
    contato_nome: "",
    cep: "",
    endereco: "",
    bairro: "",
    cidade: "",
    estado: "",
    banco: "",
    agencia: "",
    conta: "",
    tipo_chave_pix: "chave_aleatoria",
    chave_pix: "",
    categoria_padrao: "",
    observacoes: "",
    ativo: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [resForn, resCat] = await Promise.all([
        supabase.from("fornecedores").select("*").order("razao_social", { ascending: true }),
        supabase.from("categorias_despesa").select("*").order("nome", { ascending: true }),
      ]);

      if (resForn.data) setFornecedores(resForn.data as Fornecedor[]);
      if (resCat.data) setCategorias(resCat.data as CategoriaDespesa[]);
    } catch (err: any) {
      toast({ title: "Erro ao carregar fornecedores", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm({
      razao_social: "",
      nome_fantasia: "",
      cpf_cnpj: "",
      inscricao_estadual: "",
      telefone: "",
      whatsapp: "",
      email: "",
      contato_nome: "",
      cep: "",
      endereco: "",
      bairro: "",
      cidade: "",
      estado: "",
      banco: "",
      agencia: "",
      conta: "",
      tipo_chave_pix: "chave_aleatoria",
      chave_pix: "",
      categoria_padrao: "",
      observacoes: "",
      ativo: true,
    });
    setEditingFornecedor(null);
  };

  const handleOpenNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: Fornecedor) => {
    setEditingFornecedor(item);
    setForm({
      razao_social: item.razao_social || "",
      nome_fantasia: item.nome_fantasia || "",
      cpf_cnpj: item.cpf_cnpj || "",
      inscricao_estadual: item.inscricao_estadual || "",
      telefone: item.telefone || "",
      whatsapp: item.whatsapp || "",
      email: item.email || "",
      contato_nome: item.contato_nome || "",
      cep: item.cep || "",
      endereco: item.endereco || "",
      bairro: item.bairro || "",
      cidade: item.cidade || "",
      estado: item.estado || "",
      banco: item.banco || "",
      agencia: item.agencia || "",
      conta: item.conta || "",
      tipo_chave_pix: item.tipo_chave_pix || "chave_aleatoria",
      chave_pix: item.chave_pix || "",
      categoria_padrao: item.categoria_padrao || "",
      observacoes: item.observacoes || "",
      ativo: item.ativo ?? true,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.razao_social.trim()) {
      toast({ title: "Atenção", description: "Razão Social / Nome é obrigatório.", variant: "destructive" });
      return;
    }

    try {
      if (editingFornecedor) {
        const { error } = await supabase.from("fornecedores").update(form).eq("id", editingFornecedor.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Fornecedor atualizado com sucesso!" });
      } else {
        const { error } = await supabase.from("fornecedores").insert([form]);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Fornecedor cadastrado com sucesso!" });
      }
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleAtivo = async (item: Fornecedor) => {
    try {
      const { error } = await supabase
        .from("fornecedores")
        .update({ ativo: !item.ativo })
        .eq("id", item.id);
      if (error) throw error;
      toast({
        title: "Status alterado",
        description: `Fornecedor ${!item.ativo ? "ativado" : "desativado"} com sucesso.`,
      });
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao alterar status", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("fornecedores").delete().eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Excluído", description: "Fornecedor removido com sucesso." });
      setDeleteId(null);
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const copyPix = (chave: string, id: string) => {
    navigator.clipboard.writeText(chave);
    setCopiedId(id);
    toast({ title: "Copiado!", description: "Chave PIX copiada para a área de transferência." });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = fornecedores.filter((f) => {
    const term = search.toLowerCase();
    return (
      f.razao_social.toLowerCase().includes(term) ||
      (f.nome_fantasia && f.nome_fantasia.toLowerCase().includes(term)) ||
      (f.cpf_cnpj && f.cpf_cnpj.includes(term)) ||
      (f.cidade && f.cidade.toLowerCase().includes(term))
    );
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalAtivos = fornecedores.filter((f) => f.ativo).length;
  const totalInativos = fornecedores.filter((f) => !f.ativo).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Fornecedores</h1>
          <p className="text-muted-foreground">Gerencie o cadastro de parceiros, credores e dados de pagamento.</p>
        </div>
        <Button onClick={handleOpenNew} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Novo Fornecedor
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Fornecedores</CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fornecedores.length}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fornecedores Ativos</CardTitle>
            <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-none">Ativos</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalAtivos}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fornecedores Inativos</CardTitle>
            <Badge variant="outline" className="text-muted-foreground">Inativos</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{totalInativos}</div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="flex items-center space-x-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ/CPF ou cidade..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabela de Fornecedores */}
      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razão Social / Fantasia</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead>Contato / Telefone</TableHead>
              <TableHead>Dados Bancários & PIX</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Carregando fornecedores...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum fornecedor encontrado.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((item) => (
                <TableRow key={item.id} className={!item.ativo ? "opacity-60 bg-muted/20" : ""}>
                  <TableCell>
                    <div className="font-medium">{item.razao_social}</div>
                    {item.nome_fantasia && (
                      <div className="text-xs text-muted-foreground">{item.nome_fantasia}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-mono">{item.cpf_cnpj ? maskCPFCNPJ(item.cpf_cnpj) : "-"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {item.contato_nome && <div className="font-medium">{item.contato_nome}</div>}
                      {item.whatsapp || item.telefone ? (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {maskPhone(item.whatsapp || item.telefone || "")}
                        </div>
                      ) : null}
                      {item.email && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[180px]">
                          <Mail className="h-3 w-3" /> {item.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.chave_pix ? (
                      <div className="flex items-center gap-1 text-xs">
                        <Badge variant="secondary" className="font-mono text-[11px] gap-1">
                          PIX: {item.chave_pix}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Copiar Chave PIX"
                          onClick={() => copyPix(item.chave_pix!, item.id)}
                        >
                          {copiedId === item.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    ) : item.banco ? (
                      <div className="text-xs text-muted-foreground">
                        {item.banco} - Ag: {item.agencia} CC: {item.conta}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.ativo ? "default" : "secondary"}>
                      {item.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={item.ativo ? "Desativar" : "Ativar"}
                      onClick={() => handleToggleAtivo(item)}
                    >
                      <Power className={`h-4 w-4 ${item.ativo ? "text-emerald-600" : "text-muted-foreground"}`} />
                    </Button>
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
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Modal Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFornecedor ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <Tabs defaultValue="geral" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="geral">Dados Gerais</TabsTrigger>
                <TabsTrigger value="contato">Contato & Endereço</TabsTrigger>
                <TabsTrigger value="banco">Dados Bancários & PIX</TabsTrigger>
              </TabsList>

              {/* Aba Dados Gerais */}
              <TabsContent value="geral" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="razao_social">Razão Social / Nome *</Label>
                    <Input
                      id="razao_social"
                      placeholder="Ex: Telecomunicações LTDA"
                      value={form.razao_social}
                      onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                    <Input
                      id="nome_fantasia"
                      placeholder="Ex: NetFibra"
                      value={form.nome_fantasia}
                      onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cpf_cnpj">CPF / CNPJ</Label>
                    <Input
                      id="cpf_cnpj"
                      placeholder="00.000.000/0000-00"
                      value={form.cpf_cnpj}
                      onChange={(e) => setForm({ ...form, cpf_cnpj: maskCPFCNPJ(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inscricao_estadual">Inscrição Estadual / Municipal</Label>
                    <Input
                      id="inscricao_estadual"
                      placeholder="Isento ou número"
                      value={form.inscricao_estadual}
                      onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria Padrão</Label>
                    <Select
                      value={form.categoria_padrao}
                      onValueChange={(val) => setForm({ ...form, categoria_padrao: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((cat) => (
                          <SelectItem key={cat.id} value={cat.nome}>
                            {cat.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 flex items-center justify-between pt-6 border rounded-md p-3">
                    <div className="space-y-0.5">
                      <Label className="text-base">Fornecedor Ativo</Label>
                      <p className="text-xs text-muted-foreground">Status do cadastro no sistema</p>
                    </div>
                    <Switch
                      checked={form.ativo}
                      onCheckedChange={(val) => setForm({ ...form, ativo: val })}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Aba Contato e Endereço */}
              <TabsContent value="contato" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contato_nome">Nome do Contato</Label>
                    <Input
                      id="contato_nome"
                      placeholder="Ex: João da Silva (Gerente)"
                      value={form.contato_nome}
                      onChange={(e) => setForm({ ...form, contato_nome: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="financeiro@empresa.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp / Celular</Label>
                    <Input
                      id="whatsapp"
                      placeholder="(00) 00000-0000"
                      value={form.whatsapp}
                      onChange={(e) => setForm({ ...form, whatsapp: maskPhone(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone Fixo</Label>
                    <Input
                      id="telefone"
                      placeholder="(00) 0000-0000"
                      value={form.telefone}
                      onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h4 className="text-sm font-semibold">Endereço</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        placeholder="00000-000"
                        value={form.cep}
                        onChange={(e) => setForm({ ...form, cep: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="endereco">Logradouro / Endereço</Label>
                      <Input
                        id="endereco"
                        placeholder="Rua, Av., Número, Sala"
                        value={form.endereco}
                        onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bairro">Bairro</Label>
                      <Input
                        id="bairro"
                        value={form.bairro}
                        onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cidade">Cidade</Label>
                      <Input
                        id="cidade"
                        value={form.cidade}
                        onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="estado">Estado (UF)</Label>
                      <Input
                        id="estado"
                        placeholder="SP"
                        maxLength={2}
                        value={form.estado}
                        onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Aba Dados Bancários e PIX */}
              <TabsContent value="banco" className="space-y-4 pt-4">
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" /> Chave PIX (Para Pagamento Rápido)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Chave</Label>
                      <Select
                        value={form.tipo_chave_pix}
                        onValueChange={(val) => setForm({ ...form, tipo_chave_pix: val })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cpf_cnpj">CPF / CNPJ</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="telefone">Telefone</SelectItem>
                          <SelectItem value="chave_aleatoria">Chave Aleatória (EVP)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="chave_pix">Chave PIX</Label>
                      <Input
                        id="chave_pix"
                        placeholder="Informe a chave PIX do fornecedor"
                        value={form.chave_pix}
                        onChange={(e) => setForm({ ...form, chave_pix: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <h4 className="text-sm font-semibold">Conta Bancária</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="banco">Banco</Label>
                      <Input
                        id="banco"
                        placeholder="Ex: Banco do Brasil, Itaú"
                        value={form.banco}
                        onChange={(e) => setForm({ ...form, banco: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="agencia">Agência</Label>
                      <Input
                        id="agencia"
                        placeholder="0000-0"
                        value={form.agencia}
                        onChange={(e) => setForm({ ...form, agencia: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="conta">Conta Corrente / Pix</Label>
                      <Input
                        id="conta"
                        placeholder="000000-0"
                        value={form.conta}
                        onChange={(e) => setForm({ ...form, conta: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label htmlFor="observacoes">Observações Internas</Label>
                  <Textarea
                    id="observacoes"
                    rows={3}
                    placeholder="Anotações adicionais sobre o fornecedor ou condições comerciais..."
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                {editingFornecedor ? "Salvar Alterações" : "Cadastrar Fornecedor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog de Confirmação de Exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não poderá ser desfeita. O fornecedor será removido permanentemente do sistema.
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
