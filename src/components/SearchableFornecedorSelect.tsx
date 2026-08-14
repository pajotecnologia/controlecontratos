import React, { useState } from "react";
import { Check, ChevronsUpDown, Search, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface FornecedorOption {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj_cpf?: string;
}

interface SearchableFornecedorSelectProps {
  fornecedores: FornecedorOption[];
  value: string;
  onValueChange: (id: string, fornecedor?: FornecedorOption) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableFornecedorSelect({
  fornecedores,
  value,
  onValueChange,
  placeholder = "Pesquisar ou selecionar fornecedor...",
  className,
  disabled = false,
}: SearchableFornecedorSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedFornecedor = fornecedores.find((f) => f.id === value);

  const filteredFornecedores = fornecedores.filter((f) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchesRazao = (f.razao_social || "").toLowerCase().includes(term);
    const matchesFantasia = (f.nome_fantasia || "").toLowerCase().includes(term);
    const matchesCnpj = (f.cnpj_cpf || "").toLowerCase().includes(term);
    return matchesRazao || matchesFantasia || matchesCnpj;
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
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            {selectedFornecedor
              ? `${selectedFornecedor.razao_social}${selectedFornecedor.nome_fantasia ? ` (${selectedFornecedor.nome_fantasia})` : ""}`
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 min-w-[280px]" align="start">
        <div className="flex items-center border-b px-2 pb-2 mb-2 gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Digite razão social, fantasia ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 border-none focus-visible:ring-0 shadow-none text-sm px-1"
            autoFocus
          />
        </div>
        <ScrollArea className="h-60 max-h-60">
          <button
            type="button"
            onClick={() => {
              onValueChange("sem_fornecedor");
              setOpen(false);
              setSearchTerm("");
            }}
            className={cn(
              "w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between transition-colors hover:bg-accent hover:text-accent-foreground mb-1",
              value === "sem_fornecedor" && "bg-primary/10 font-semibold text-primary"
            )}
          >
            <span className="italic text-muted-foreground">Sem fornecedor vinculado</span>
            {value === "sem_fornecedor" && <Check className="h-4 w-4 text-primary shrink-0" />}
          </button>

          {filteredFornecedores.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nenhum fornecedor encontrado.
            </div>
          ) : (
            <div className="space-y-1 pr-2">
              {filteredFornecedores.map((f) => {
                const isSelected = f.id === value;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      onValueChange(f.id, f);
                      setOpen(false);
                      setSearchTerm("");
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between transition-colors hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-primary/10 font-semibold text-primary"
                    )}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="truncate font-medium">{f.razao_social}</span>
                      <span className="text-[11px] text-muted-foreground font-mono truncate">
                        {f.nome_fantasia ? `${f.nome_fantasia} • ` : ""}{f.cnpj_cpf || "Sem CNPJ"}
                      </span>
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
