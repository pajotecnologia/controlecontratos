import { useEffect, useState } from "react";
import { supabase } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Shield, ShieldCheck, User } from "lucide-react";

type UserWithRole = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  role_id: string;
};

const Usuarios = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Get all profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .order("full_name");

      // Get all roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("id, user_id, role");

      if (!profiles) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const userList: UserWithRole[] = profiles.map((p) => {
        const userRole = roles?.find((r) => r.user_id === p.user_id);
        return {
          user_id: p.user_id,
          full_name: p.full_name || "Sem nome",
          email: "",
          role: userRole?.role || "vendedor",
          role_id: userRole?.id || "",
        };
      });

      setUsers(userList);
    } catch (err) {
      console.error("Error loading users:", err);
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (userId: string, currentRoleId: string, newRole: string) => {
    try {
      if (currentRoleId) {
        await supabase.from("user_roles").update({ role: newRole as any }).eq("id", currentRoleId);
      } else {
        await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
      }
      toast({ title: `Nível de acesso alterado para ${newRole === "admin" ? "Administrador" : "Vendedor"}!` });
      loadUsers();
    } catch {
      toast({ title: "Erro ao alterar nível de acesso", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Usuários e Acessos</h2>
          <p className="text-muted-foreground text-sm">Gerencie os níveis de acesso dos usuários do sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Administrador</h3>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 ml-7">
            <li>• Acesso total ao sistema</li>
            <li>• Gerenciar clientes, vendedores e vendas</li>
            <li>• Configurar empresa, SMTP e WhatsApp</li>
            <li>• Confirmar pagamentos de comissões</li>
            <li>• Gerenciar usuários e permissões</li>
          </ul>
        </div>
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Vendedor</h3>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 ml-7">
            <li>• Visualizar próprio dashboard</li>
            <li>• Visualizar próprias vendas e comissões</li>
            <li>• Sem acesso a configurações</li>
            <li>• Sem acesso a cadastros</li>
          </ul>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Nível de Acesso</TableHead>
              <TableHead className="w-[200px]">Alterar Acesso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {u.role === "admin" ? (
                        <ShieldCheck className="h-4 w-4 text-primary" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                      {u.full_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                      {u.role === "admin" ? "Administrador" : "Vendedor"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(val) => changeRole(u.user_id, u.role_id, val)}
                    >
                      <SelectTrigger className="w-full max-w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" />
                            Administrador
                          </div>
                        </SelectItem>
                        <SelectItem value="vendedor">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Vendedor
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Usuarios;
