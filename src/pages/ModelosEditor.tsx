import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft, LayoutTemplate, Building2, UserRound, FileText, Eye, AlertCircle,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { FontSize } from "@/lib/editorExtensions";
import ModeloToolbar from "@/components/editor/ModeloToolbar";
import {
  variaveisEmpresa,
  variaveisCliente,
  variaveisContrato,
  todasVariaveisModelo,
  exemplosVariaveisModelo,
} from "@/lib/modeloVariaveis";

const TODAS_VARIAVEIS = todasVariaveisModelo.map((v) => v.tag);

const MODELO_EXEMPLO_HTML = `<p style="text-align: center">{{empresa_logo}}</p>
<h2 style="text-align: center">{{empresa_nome}}</h2>
<p style="text-align: center">CNPJ: {{empresa_cnpj}}<br>{{empresa_endereco_completo}}</p>
<p style="text-align: center">Representada por {{empresa_nome_responsavel}} (${"{{empresa_cargo_responsavel}}"})</p>
<h1 style="text-align: center">CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>
<p><strong>CONTRATANTE:</strong> {{cliente_nome}}, portador do CPF/CNPJ sob o nº {{cliente_cpf_cnpj}}, residente e domiciliado no endereço {{cliente_endereco}}, telefone {{cliente_telefone}}, e-mail {{cliente_email}}, neste ato representado por {{cliente_nome_responsavel}}, portador do CPF nº {{cliente_cpf_responsavel}}, na função de {{cliente_cargo_responsavel}}.</p>
<p><strong>CONTRATADA:</strong> {{empresa_nome}}, inscrita no CNPJ sob o nº {{empresa_cnpj}}, estabelecida no endereço {{empresa_endereco}}, neste ato representada por seu representante legal, {{empresa_nome_responsavel}}, portador do CPF nº {{empresa_cpf_responsavel}}.</p>
<p><strong>DO VALOR E PAGAMENTO:</strong> O valor do serviço será de R$ {{valor}} mensais, pago conforme definido nas condições de contratação: {{forma_pagamento}}. A taxa de implantação acordada é de R$ {{taxa_implantacao}}.</p>
<p><strong>DA VIGÊNCIA E REAJUSTE:</strong> O presente instrumento terá vigência de {{prazo_contrato}} a partir de {{data_emissao}} com reajuste anual de acordo com {{forma_reajuste}}.</p>
<p><strong>DO EQUIPAMENTO:</strong> Será fornecido em comodato o equipamento modelo {{modelo_equipamento}}.</p>
<p>Firmado em {{data_atual}}.</p>
<p style="text-align: center">_____________________________________<br>{{empresa_nome}}</p>
<p style="text-align: center">_____________________________________<br>{{cliente_nome}}</p>`;

const ModelosEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [nome, setNome] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph", "tableCell"] }),
      TextStyle,
      FontFamily.configure({ types: ["textStyle"] }),
      Color,
      FontSize,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: true, allowBase64: false }),
      Table.configure({ resizable: false, allowTableNodeSelection: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: "",
    onUpdate: ({ editor }) => setConteudo(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none font-serif text-slate-800 min-h-[600px] px-4 py-4 sm:px-10 sm:py-8",
      },
    },
  });

  useEffect(() => {
    if (!isEditing || !editor) return;
    (async () => {
      const { data } = await supabase.from("modelos").select("*").eq("id", id).maybeSingle();
      if (!data) {
        toast({ title: "Modelo não encontrado", variant: "destructive" });
        navigate("/modelos");
        return;
      }
      setNome(data.nome);
      setConteudo(data.conteudo || "");
      editor.commands.setContent(data.conteudo || "");
      setLoading(false);
    })();
  }, [id, isEditing, editor, navigate]);

  const handleSave = async () => {
    if (!nome.trim()) return toast({ title: "Nome do modelo é obrigatório", variant: "destructive" });
    if (!editor || editor.isEmpty) return toast({ title: "Conteúdo do modelo é obrigatório", variant: "destructive" });

    setSaving(true);
    const payload = { nome: nome.trim(), conteudo: editor.getHTML() };

    const { error } = isEditing
      ? await supabase.from("modelos").update(payload).eq("id", id)
      : await supabase.from("modelos").insert(payload);
    setSaving(false);

    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: isEditing ? "Modelo atualizado!" : "Modelo cadastrado!" });
    navigate("/modelos");
  };

  const insertVariavel = (variavel: string) => {
    editor?.chain().focus().insertContent(variavel).run();
  };

  const usarExemplo = () => {
    editor?.commands.setContent(MODELO_EXEMPLO_HTML);
    setConteudo(MODELO_EXEMPLO_HTML);
  };

  const totalVariaveisUsadas = useMemo(
    () => TODAS_VARIAVEIS.filter((item) => conteudo.includes(item)).length,
    [conteudo]
  );

  const variaveisDesconhecidas = useMemo(() => {
    const usadas = conteudo.match(/\{\{\s*[\w]+\s*\}\}/g) || [];
    const normalizadas = usadas.map((u) => u.replace(/\s+/g, ""));
    return [...new Set(normalizadas.filter((u) => !TODAS_VARIAVEIS.includes(u)))];
  }, [conteudo]);

  const previewComExemplo = useMemo(() => {
    return conteudo.replace(/\{\{\s*[\w]+\s*\}\}/g, (m) => {
      const chave = m.replace(/\s+/g, "");
      return exemplosVariaveisModelo[chave] ?? m;
    });
  }, [conteudo]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">Carregando modelo...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/modelos")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{isEditing ? "Editar Modelo" : "Novo Modelo"}</h2>
          <p className="text-sm text-muted-foreground">Monte o texto-base com variáveis para gerar contratos dinâmicos.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Modelo</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Contrato mensal padrão"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label>Texto do Modelo</Label>
              <div className="flex flex-wrap justify-end gap-2 text-xs">
                <Badge variant="outline">{totalVariaveisUsadas} variável(is)</Badge>
                <Badge variant="outline">{conteudo.replace(/<[^>]*>/g, "").length} caractere(s)</Badge>
              </div>
            </div>

            {variaveisDesconhecidas.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">Variáveis não reconhecidas</div>
                  <div>{variaveisDesconhecidas.join(", ")}</div>
                </div>
              </div>
            )}

            <Tabs defaultValue="editar" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="editar" className="flex items-center gap-2"><FileText className="h-4 w-4" /> Editar texto</TabsTrigger>
                <TabsTrigger value="preview" className="flex items-center gap-2"><Eye className="h-4 w-4" /> Pré-visualizar</TabsTrigger>
              </TabsList>

              <TabsContent value="editar" className="mt-3">
                <div className="rounded-md border bg-slate-50 overflow-hidden shadow-inner">
                  <ModeloToolbar editor={editor} />
                  <div className="bg-white min-h-[600px]">
                    <EditorContent editor={editor} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-3">
                <div
                  className="prose prose-sm max-w-none font-serif text-sm leading-7 text-slate-800 whitespace-pre-wrap text-justify border rounded-md p-4 sm:p-8 min-h-[600px] bg-white shadow-inner"
                  dangerouslySetInnerHTML={{ __html: previewComExemplo || "Digite o texto do modelo para visualizar." }}
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => navigate("/modelos")}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Modelo"}</Button>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <LayoutTemplate className="h-4 w-4 text-violet-600" />
                Variáveis do contrato
              </CardTitle>
              <CardDescription>Clique para inserir no texto. Passe o mouse para ver o significado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[620px] overflow-y-auto pr-2">
              <TooltipProvider delayDuration={150}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b pb-1">
                    <Building2 className="h-4 w-4 text-sky-700" /> Empresa
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {variaveisEmpresa.map((item) => (
                      <Tooltip key={item.tag}>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="cursor-pointer bg-sky-50 text-sky-800 hover:bg-sky-100 text-[11px] font-mono px-2 py-0.5 border border-sky-200/50" onClick={() => insertVariavel(item.tag)}>
                            {item.tag}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="bg-slate-900 text-white max-w-xs text-xs">
                          <p className="font-semibold">{item.rotulo}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Exemplo: {item.exemplo}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b pb-1">
                    <UserRound className="h-4 w-4 text-emerald-700" /> Cliente
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {variaveisCliente.map((item) => (
                      <Tooltip key={item.tag}>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="cursor-pointer bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-[11px] font-mono px-2 py-0.5 border border-emerald-200/50" onClick={() => insertVariavel(item.tag)}>
                            {item.tag}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="bg-slate-900 text-white max-w-xs text-xs">
                          <p className="font-semibold">{item.rotulo}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Exemplo: {item.exemplo}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b pb-1">
                    <FileText className="h-4 w-4 text-violet-700" /> Contrato
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {variaveisContrato.map((item) => (
                      <Tooltip key={item.tag}>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="cursor-pointer bg-violet-50 text-violet-800 hover:bg-violet-100 text-[11px] font-mono px-2 py-0.5 border border-violet-200/50" onClick={() => insertVariavel(item.tag)}>
                            {item.tag}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="bg-slate-900 text-white max-w-xs text-xs">
                          <p className="font-semibold">{item.rotulo}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Exemplo: {item.exemplo}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              </TooltipProvider>
            </CardContent>
          </Card>

          <Card className="border-dashed border-slate-300 bg-slate-50/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Exemplo rápido</CardTitle>
              <CardDescription>Modelo sugerido para começar.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" className="w-full" onClick={usarExemplo}>
                Usar texto exemplo
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ModelosEditor;
