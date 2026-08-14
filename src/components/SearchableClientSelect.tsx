import React, { useState } from "react";
import { Check, ChevronsUpDown, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface ClientOption {
  id: string;
  nome: string;
  cpf_cnpj?: string;
}

interface SearchableClientSelectProps {
  clients: ClientOption[];
  value: string;
  onValueChange: (id: string, client?: ClientOption) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableClientSelect({
  clients,
  value,
  onValueChange,
  placeholder = "Pesquisar ou selecionar cliente...",
  className,
  disabled = false,
}: SearchableClientSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedClient = clients.find((c) => c.id === value);

  const filteredClients = clients.filter((c) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchesName = (c.nome || "").toLowerCase().includes(term);
    const matchesCpfCnpj = (c.cpf_cnpj || "").toLowerCase().includes(term);
    return matchesName || matchesCpfCnpj;
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal text-left h-10 px-3", !value && "text-muted-foreground", className)}
        >
          <span className="truncate flex items-center gap-2">
            <User className="h-4 w-4 text-primary shrink-0" />
            {selectedClient ? selectedClient.nome : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 min-w-[280px]" align="start">
        <div className="flex items-center border-b px-2 pb-2 mb-2 gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Digite o nome ou CPF/CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 border-none focus-visible:ring-0 shadow-none text-sm px-1"
            autoFocus
          />
        </div>
        <ScrollArea className="h-60 max-h-60">
          {filteredClients.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </div>
          ) : (
            <div className="space-y-1 pr-2">
              {filteredClients.map((c) => {
                const isSelected = c.id === value;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onValueChange(c.id, c);
                      setOpen(false);
                      setSearchTerm("");
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between transition-colors hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-primary/10 font-semibold text-primary"
                    )}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="truncate font-medium">{c.nome}</span>
                      {c.cpf_cnpj && (
                        <span className="text-[11px] text-muted-foreground font-mono truncate">
                          {c.cpf_cnpj}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
