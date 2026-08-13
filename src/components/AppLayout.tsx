import { ReactNode, useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/api/client";

export function AppLayout({ children }: { children: ReactNode }) {
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const loadCompany = () => {
    supabase
      .from("company_settings")
      .select("name, logo_url")
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCompanyName(data.name);
          setLogoUrl(data.logo_url || "");
        }
      });
  };

  useEffect(() => {
    loadCompany();
    window.addEventListener("company_updated", loadCompany);
    return () => window.removeEventListener("company_updated", loadCompany);
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b px-4 gap-3 bg-background">
            <SidebarTrigger />
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded object-contain" />
            )}
            <h1 className="font-semibold text-lg truncate min-w-0">{companyName || "Gestão de Comissões"}</h1>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
