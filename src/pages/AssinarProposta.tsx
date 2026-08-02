import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, PenLine, Eraser, Download, Loader2, AlertCircle } from "lucide-react";

// URL relativa: Express serve HTML e API na mesma origem.
const API_URL = "";

async function apiPublic(path: string, body?: any) {
  const res = await fetch(`${API_URL}${path}`, {
    method: body !== undefined ? "POST" : "GET",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

const AssinarProposta = () => {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [proposta, setProposta] = useState<any>(null);
  const [conteudoHtml, setConteudoHtml] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [erro, setErro] = useState("");

  const [nomeAssinante, setNomeAssinante] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [assinado, setAssinado] = useState(false);
  const [recusado, setRecusado] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [desenhando, setDesenhando] = useState(false);
  const [temAssinatura, setTemAssinatura] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const { ok, json } = await apiPublic(`/api/public/assinar-proposta/${token}`);
      if (!ok) { setErro(json.error || "Link inválido ou expirado."); setLoading(false); return; }
      setProposta(json.proposta);
      if (json.proposta.assinatura_status === "assinado") setAssinado(true);
      if (json.proposta.assinatura_status === "recusado") setRecusado(true);
      setLoading(false);
      setLoadingPreview(true);
      const prev = await apiPublic(`/api/public/assinar-proposta/${token}/preview`, {});
      setLoadingPreview(false);
      if (prev.ok) setConteudoHtml(prev.json.conteudo || "");
    })();
  }, [token]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setDesenhando(true);
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!desenhando) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    setTemAssinatura(true);
  };

  const stopDraw = () => setDesenhando(false);

  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setTemAssinatura(false);
  };

  const handleAssinar = async () => {
    if (!temAssinatura) return toast({ title: "Desenhe sua assinatura antes de confirmar", variant: "destructive" });
    if (!nomeAssinante.trim()) return toast({ title: "Informe seu nome completo", variant: "destructive" });
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imagem = canvas.toDataURL("image/png");
    setEnviando(true);
    const { ok, json } = await apiPublic(`/api/public/assinar-proposta/${token}/assinar`, {
      assinatura_imagem: imagem,
      assinatura_nome: nomeAssinante.trim(),
      assinatura_observacao: observacao.trim() || null,
    });
    setEnviando(false);
    if (!ok) return toast({ title: "Erro ao assinar", description: json.error, variant: "destructive" });
    setProposta((atual: any) => atual ? { ...atual, assinatura_status: "assinado", assinatura_imagem: imagem, assinatura_nome: nomeAssinante.trim(), assinatura_observacao: observacao.trim() || null, assinatura_data: new Date().toISOString() } : atual);
    setAssinado(true);
    toast({ title: "Proposta assinada com sucesso!" });
  };

  const handleRecusar = async () => {
    if (!observacao.trim()) return toast({ title: "Informe o motivo ou sugestão de ajuste", variant: "destructive" });
    setEnviando(true);
    const { ok, json } = await apiPublic(`/api/public/assinar-proposta/${token}/observacao`, { assinatura_observacao: observacao.trim() });
    setEnviando(false);
    if (!ok) return toast({ title: "Erro ao enviar", description: json.error, variant: "destructive" });
    setProposta((atual: any) => atual ? { ...atual, assinatura_status: "recusado", assinatura_observacao: observacao.trim() } : atual);
    setRecusado(true);
    toast({ title: "Observação enviada. O responsável entrará em contato." });
  };

  const handleDownload = () => {
    if (!conteudoHtml) return;
    let assinaturaHtml = "";
    if (proposta?.assinatura_imagem) {
      assinaturaHtml = `<div style="margin-top:50px;border-top:2px solid #e2e8f0;padding-top:20px;display:flex;justify-content:space-between;gap:20px;">
        <div style="flex:1;text-align:center;padding:15px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
          <div style="font-weight:bold;margin-bottom:10px;">Assinatura Digital</div>
          <img src="${proposta.assinatura_imagem}" style="max-height:80px;padding:5px;background:#fff;border:1px solid #cbd5e1;border-radius:4px;margin-bottom:10px;" />
          <div style="font-size:13px;color:#475569;">Assinado por: <strong>${proposta.assinatura_nome || ""}</strong><br />${proposta.assinatura_data ? new Date(proposta.assinatura_data).toLocaleString("pt-BR") : ""}</div>
        </div>
        <div style="flex:1;padding:15px;border:1px solid #e2e8f0;border-radius:8px;">
          <div style="font-weight:bold;margin-bottom:10px;">Observação do Assinante</div>
          <div style="font-size:13px;color:#475569;white-space:pre-wrap;background:#f8fafc;padding:10px;border-radius:4px;min-height:60px;">${proposta.assinatura_observacao || "Nenhuma observação informada."}</div>
        </div>
      </div>`;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Proposta</title>
      <style>@page{margin:15mm}body{font-family:Arial,sans-serif;color:#1e293b;font-size:13px;line-height:1.6;background:#fff}table{border-collapse:collapse;width:100%}th,td{border:1px solid #94a3b8;padding:6px 10px;vertical-align:top}th{background:#f1f5f9;font-weight:bold}</style>
    </head><body><div>${conteudoHtml}</div>${assinaturaHtml}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposta-${proposta?.cliente_nome || "assinada"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  if (erro) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-xl font-bold">Link inválido</h1>
        <p className="text-muted-foreground">{erro}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <style>{`
        .doc-proposta { white-space: normal; }
        .doc-proposta p { margin: 0 0 10px; }
        .doc-proposta h1, .doc-proposta h2 { margin: 14px 0 7px; font-weight: 700; }
        .doc-proposta img { max-width: 100%; height: auto; }
        .doc-proposta table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .doc-proposta th, .doc-proposta td { border: 1px solid #94a3b8; padding: 6px 10px; vertical-align: top; }
        .doc-proposta th { background: #f1f5f9; font-weight: 600; }
      `}</style>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-800">Proposta para Assinatura</h1>
          <p className="text-sm text-muted-foreground">Leia atentamente a proposta abaixo antes de assinar.</p>
          {assinado && <Badge className="bg-emerald-600 text-white">✅ Proposta assinada</Badge>}
          {recusado && <Badge variant="destructive">Sugestão de ajuste enviada</Badge>}
        </div>

        <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[400px]">
          {loadingPreview ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando proposta...
            </div>
          ) : conteudoHtml ? (
            <div className="doc-proposta text-sm leading-7 text-slate-800" dangerouslySetInnerHTML={{ __html: conteudoHtml }} />
          ) : (
            <div className="text-center text-muted-foreground py-12">Sem conteúdo disponível.</div>
          )}

          {assinado && proposta?.assinatura_imagem && (
            <div className="mt-8 border-t pt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2 items-start">
                <div className="rounded-lg border bg-slate-50 p-4 text-center space-y-2">
                  <p className="text-sm font-medium text-slate-700">Assinatura digital</p>
                  <img src={proposta.assinatura_imagem} alt="Assinatura" className="mx-auto max-h-20 border rounded bg-white p-2" />
                  <p className="text-xs text-muted-foreground">
                    Assinado por <strong>{proposta.assinatura_nome}</strong><br />
                    {proposta.assinatura_data ? new Date(proposta.assinatura_data).toLocaleString("pt-BR") : ""}
                  </p>
                </div>
                <div className="rounded-lg border bg-white p-4 space-y-2">
                  <p className="text-sm font-medium text-slate-700">Observação do assinante</p>
                  <div className="min-h-24 rounded-md bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
                    {proposta.assinatura_observacao || "Nenhuma observação informada."}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" /> Baixar proposta
          </Button>
        </div>

        {!assinado && !recusado && (
          <div className="bg-white rounded-lg border shadow-sm p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <PenLine className="h-5 w-5 text-violet-600" /> Assinatura Digital
            </h2>
            <div className="space-y-2">
              <Label>Nome completo do assinante</Label>
              <Input value={nomeAssinante} onChange={(e) => setNomeAssinante(e.target.value)} placeholder="Seu nome completo" />
            </div>
            <div className="space-y-2">
              <Label>Observação / Sugestão de ajuste (opcional)</Label>
              <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Sugestões ou observações sobre a proposta..." rows={3} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Desenhe sua assinatura</Label>
                <Button variant="ghost" size="sm" onClick={limparAssinatura} className="text-xs">
                  <Eraser className="h-3 w-3 mr-1" /> Limpar
                </Button>
              </div>
              <div className="rounded-md border bg-slate-50 overflow-hidden" style={{ touchAction: "none" }}>
                <canvas ref={canvasRef} width={680} height={160} className="w-full cursor-crosshair" style={{ display: "block" }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
              </div>
              {!temAssinatura && <p className="text-xs text-muted-foreground text-center">Clique e arraste para assinar</p>}
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleAssinar} disabled={enviando || !temAssinatura || !nomeAssinante.trim()} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Assinar Proposta
              </Button>
              <Button variant="outline" onClick={handleRecusar} disabled={enviando || !observacao.trim()} className="flex-1 border-amber-400 text-amber-700 hover:bg-amber-50">
                Enviar Sugestão de Ajuste
              </Button>
            </div>
          </div>
        )}

        {assinado && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
            <h2 className="text-lg font-semibold text-emerald-800">Proposta assinada com sucesso!</h2>
            <p className="text-sm text-emerald-700">Sua assinatura foi registrada e o documento está disponível para download.</p>
          </div>
        )}

        {recusado && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center space-y-2">
            <AlertCircle className="h-10 w-10 text-amber-600 mx-auto" />
            <h2 className="text-lg font-semibold text-amber-800">Sugestão enviada</h2>
            <p className="text-sm text-amber-700">Sua observação foi registrada. O responsável entrará em contato.</p>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">
          Documento gerado eletronicamente — {new Date().toLocaleDateString("pt-BR")}
        </p>
      </div>
    </div>
  );
};

export default AssinarProposta;
