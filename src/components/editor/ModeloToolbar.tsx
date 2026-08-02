import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Bold, Italic, UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Heading1, Heading2, Heading3, List, ListOrdered, RemoveFormatting,
  Table as TableIcon, Plus, Minus, Combine, Trash2, Rows3, Columns3,
  Image as ImageIcon, Type, Strikethrough, Link2, Link2Off, Quote,
  Minus as HrIcon, Undo2, Redo2, Code,
} from "lucide-react";
import { uploadArquivo } from "@/integrations/api/client";
import { toast } from "@/hooks/use-toast";

const FONTES = [
  { rotulo: "Serifada (Georgia)", valor: "Georgia, 'Times New Roman', serif" },
  { rotulo: "Sem serifa (Arial)", valor: "Arial, Helvetica, sans-serif" },
  { rotulo: "Mono (Courier)", valor: "'Courier New', Courier, monospace" },
  { rotulo: "Times New Roman", valor: "'Times New Roman', Times, serif" },
  { rotulo: "Verdana", valor: "Verdana, Geneva, sans-serif" },
];

const TAMANHOS = ["10px", "11px", "12px", "13px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "48px"];

const CORES = [
  "#000000", "#374151", "#6b7280", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#0891b2", "#065f46",
  "#7c2d12", "#1e3a5f", "#ffffff",
];

function Btn({ editor, ativo, onClick, title, children, disabled }: {
  editor: Editor | null; ativo?: boolean; onClick: () => void; title: string;
  children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <Button variant={ativo ? "secondary" : "ghost"} size="icon" className="h-7 w-7"
      onClick={onClick} title={title} disabled={!editor || disabled}>
      {children}
    </Button>
  );
}

const Sep = () => <div className="mx-0.5 h-5 w-px bg-slate-200 shrink-0" />;

export default function ModeloToolbar({ editor }: { editor: Editor | null }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const emTabela = !!editor?.isActive("table");

  const handleImagem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editor) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "Máximo 5 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const { url, error } = await uploadArquivo(file);
    setUploading(false);
    if (error || !url) {
      toast({ title: "Falha no upload", description: error || "Tente novamente.", variant: "destructive" });
      return;
    }
    editor.chain().focus().setImage({ src: url, alt: file.name }).run();
  };

  const inserirLink = () => {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("URL do link:");
    if (url) editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
  };

  const familiaAtual = editor?.getAttributes("textStyle").fontFamily as string | undefined;
  const familiaSel = FONTES.find((f) => f.valor === familiaAtual)?.rotulo ?? "Fonte";

  const tamanhoAtual = editor?.getAttributes("textStyle").fontSize as string | undefined;
  const corAtual = editor?.getAttributes("textStyle").color as string | undefined;

  return (
    <div className="border-b bg-slate-50 text-slate-700 select-none">
      {/* Linha 1 */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 border-b border-slate-100">
        <Btn editor={editor} onClick={() => editor?.chain().focus().undo().run()} title="Desfazer (Ctrl+Z)" disabled={!editor?.can().undo()}>
          <Undo2 className="h-3.5 w-3.5" />
        </Btn>
        <Btn editor={editor} onClick={() => editor?.chain().focus().redo().run()} title="Refazer (Ctrl+Y)" disabled={!editor?.can().redo()}>
          <Redo2 className="h-3.5 w-3.5" />
        </Btn>

        <Sep />

        {/* Família */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={!editor} title="Família da fonte">
              <Type className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[90px] truncate">{familiaSel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52">
            <DropdownMenuLabel className="text-xs">Família da fonte</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {FONTES.map((f) => (
              <DropdownMenuItem key={f.valor} style={{ fontFamily: f.valor }} className="text-sm"
                onClick={() => editor?.chain().focus().setFontFamily(f.valor).run()}>
                {f.rotulo}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-sm" onClick={() => editor?.chain().focus().unsetFontFamily().run()}>
              Padrão
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tamanho */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs w-14" disabled={!editor} title="Tamanho da fonte">
              {tamanhoAtual ?? "Tam."}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-24">
            <DropdownMenuLabel className="text-xs">Tamanho</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {TAMANHOS.map((t) => (
              <DropdownMenuItem key={t} className="text-xs"
                onClick={() => (editor as any)?.chain().focus().setFontSize(t).run()}>
                {t}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs" onClick={() => (editor as any)?.chain().focus().unsetFontSize().run()}>
              Padrão
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Sep />

        {/* Cor */}
        <DropdownMenu open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 relative" disabled={!editor} title="Cor do texto">
              <span className="text-xs font-bold leading-none" style={{ color: corAtual || "#000" }}>A</span>
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-4 rounded-sm" style={{ backgroundColor: corAtual || "#000" }} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-auto p-2">
            <div className="grid grid-cols-5 gap-1 mb-2">
              {CORES.map((c) => (
                <button key={c} title={c}
                  className="h-6 w-6 rounded border border-slate-200 cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                  onClick={() => { editor?.chain().focus().setColor(c).run(); setColorPickerOpen(false); }}
                />
              ))}
            </div>
            <button className="text-xs text-slate-500 w-full text-center hover:text-slate-800"
              onClick={() => { editor?.chain().focus().unsetColor().run(); setColorPickerOpen(false); }}>
              Remover cor
            </button>
          </DropdownMenuContent>
        </DropdownMenu>

        <Sep />

        <Btn editor={editor} ativo={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} title="Negrito (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </Btn>
        <Btn editor={editor} ativo={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} title="Itálico (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </Btn>
        <Btn editor={editor} ativo={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()} title="Sublinhado (Ctrl+U)">
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Btn>
        <Btn editor={editor} ativo={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()} title="Tachado">
          <Strikethrough className="h-3.5 w-3.5" />
        </Btn>
        <Btn editor={editor} ativo={editor?.isActive("code")} onClick={() => editor?.chain().focus().toggleCode().run()} title="Código inline">
          <Code className="h-3.5 w-3.5" />
        </Btn>

        <Sep />

        <Btn editor={editor} ativo={editor?.isActive("link")} onClick={inserirLink} title={editor?.isActive("link") ? "Remover link" : "Inserir link"}>
          {editor?.isActive("link") ? <Link2Off className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
        </Btn>
      </div>

      {/* Linha 2 */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1">
        <Btn editor={editor} ativo={editor?.isActive({ heading: { level: 1 } })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} title="Título 1">
          <Heading1 className="h-3.5 w-3.5" />
        </Btn>
        <Btn editor={editor} ativo={editor?.isActive({ heading: { level: 2 } })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="Título 2">
          <Heading2 className="h-3.5 w-3.5" />
        </Btn>
        <Btn editor={editor} ativo={editor?.isActive({ heading: { level: 3 } })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} title="Título 3">
          <Heading3 className="h-3.5 w-3.5" />
        </Btn>

        <Sep />

        <Btn editor={editor} ativo={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()} title="Esquerda">
          <AlignLeft className="h-3.5 w-3.5" />
        </Btn>
        <Btn editor={editor} ativo={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()} title="Centralizar">
          <AlignCenter className="h-3.5 w-3.5" />
        </Btn>
        <Btn editor={editor} ativo={editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()} title="Direita">
          <AlignRight className="h-3.5 w-3.5" />
        </Btn>
        <Btn editor={editor} ativo={editor?.isActive({ textAlign: "justify" })} onClick={() => editor?.chain().focus().setTextAlign("justify").run()} title="Justificar">
          <AlignJustify className="h-3.5 w-3.5" />
        </Btn>

        <Sep />

        <Btn editor={editor} ativo={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Marcadores">
          <List className="h-3.5 w-3.5" />
        </Btn>
        <Btn editor={editor} ativo={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} title="Lista Numerada">
          <ListOrdered className="h-3.5 w-3.5" />
        </Btn>
        <Btn editor={editor} ativo={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()} title="Citação">
          <Quote className="h-3.5 w-3.5" />
        </Btn>
        <Btn editor={editor} onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="Linha horizontal">
          <HrIcon className="h-3.5 w-3.5" />
        </Btn>

        <Sep />

        {/* Tabela */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={emTabela ? "secondary" : "ghost"} size="icon" className="h-7 w-7" disabled={!editor} title="Tabela">
              <TableIcon className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52">
            <DropdownMenuLabel className="text-xs">Inserir</DropdownMenuLabel>
            <DropdownMenuItem className="text-xs" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
              <TableIcon className="mr-2 h-3.5 w-3.5" /> Tabela 3×3
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs" onClick={() => editor?.chain().focus().insertTable({ rows: 4, cols: 4, withHeaderRow: true }).run()}>
              <TableIcon className="mr-2 h-3.5 w-3.5" /> Tabela 4×4
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Linhas</DropdownMenuLabel>
            <DropdownMenuItem className="text-xs" disabled={!emTabela} onClick={() => editor?.chain().focus().addRowBefore().run()}>
              <Plus className="mr-2 h-3.5 w-3.5" /> Linha acima
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs" disabled={!emTabela} onClick={() => editor?.chain().focus().addRowAfter().run()}>
              <Plus className="mr-2 h-3.5 w-3.5" /> Linha abaixo
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs" disabled={!emTabela} onClick={() => editor?.chain().focus().deleteRow().run()}>
              <Minus className="mr-2 h-3.5 w-3.5" /> Excluir linha
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Colunas</DropdownMenuLabel>
            <DropdownMenuItem className="text-xs" disabled={!emTabela} onClick={() => editor?.chain().focus().addColumnBefore().run()}>
              <Plus className="mr-2 h-3.5 w-3.5" /> Coluna antes
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs" disabled={!emTabela} onClick={() => editor?.chain().focus().addColumnAfter().run()}>
              <Plus className="mr-2 h-3.5 w-3.5" /> Coluna depois
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs" disabled={!emTabela} onClick={() => editor?.chain().focus().deleteColumn().run()}>
              <Minus className="mr-2 h-3.5 w-3.5" /> Excluir coluna
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Células</DropdownMenuLabel>
            <DropdownMenuItem className="text-xs" disabled={!emTabela} onClick={() => editor?.chain().focus().mergeCells().run()}>
              <Combine className="mr-2 h-3.5 w-3.5" /> Mesclar
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs" disabled={!emTabela} onClick={() => editor?.chain().focus().splitCell().run()}>
              <Rows3 className="mr-2 h-3.5 w-3.5" /> Dividir
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs" disabled={!emTabela} onClick={() => editor?.chain().focus().toggleHeaderRow().run()}>
              <Columns3 className="mr-2 h-3.5 w-3.5" /> Linha de cabeçalho
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-rose-600 focus:text-rose-600" disabled={!emTabela} onClick={() => editor?.chain().focus().deleteTable().run()}>
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir tabela
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Btn editor={editor} onClick={() => fileInputRef.current?.click()} title="Inserir imagem">
          {uploading ? <span className="text-[10px]">...</span> : <ImageIcon className="h-3.5 w-3.5" />}
        </Btn>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagem} />

        <Sep />

        <Btn editor={editor} onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()} title="Limpar formatação">
          <RemoveFormatting className="h-3.5 w-3.5" />
        </Btn>
      </div>
    </div>
  );
}



