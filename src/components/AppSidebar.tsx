import { useEffect, useState } from "react";
import { LayoutDashboard, Users, ShoppingCart, Settings, LogOut, UserCheck, Shield, FileText, FileSignature, LayoutTemplate, MessageSquare } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/api/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { isAdmin, signOut, user } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    supabase
      .from("company_settings")
      .select("name, logo_url")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCompanyName(data.name);
          setLogoUrl(data.logo_url || "");
        }
      });
  }, []);

  const adminItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Clientes", url: "/clientes", icon: UserCheck },
    { title: "Vendedores", url: "/vendedores", icon: Users },
    { title: "Financeiro", url: "/financeiro", icon: ShoppingCart },
    { title: "Modelos", url: "/modelos", icon: LayoutTemplate },
    { title: "Contratos", url: "/contratos", icon: FileSignature },
    { title: "Propostas", url: "/propostas", icon: FileText },
    { title: "Mensagens", url: "/mensagens", icon: MessageSquare },
    { title: "Relatórios", url: "/relatorios", icon: FileText },
    { title: "Usuários", url: "/usuarios", icon: Shield },
    { title: "Configurações", url: "/configuracoes", icon: Settings },
  ];

  const vendedorItems = [
    { title: "Meu Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Meu Financeiro", url: "/financeiro", icon: ShoppingCart },
  ];

  const items = isAdmin ? adminItems : vendedorItems;

  return (
    <Sidebar>
      <SidebarHeader className="p-4 flex flex-col items-center gap-2 border-b border-sidebar-border">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-lg object-contain" />
        ) : (
          <div className="h-16 w-16 rounded-lg bg-sidebar-accent flex items-center justify-center text-sidebar-foreground text-xl font-bold">
            {companyName?.charAt(0) || "E"}
          </div>
        )}
        <span className="text-sm font-semibold text-sidebar-foreground text-center leading-tight">
          {companyName || "Sua Empresa"}
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider">
            {isAdmin ? "Administração" : "Vendedor"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground truncate mb-2">{user?.email}</p>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
