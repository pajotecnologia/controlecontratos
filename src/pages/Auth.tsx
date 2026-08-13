import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, cleanLogoUrl } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [company, setCompany] = useState<{ name?: string; logo_url?: string }>({});
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/public/company-info")
      .then((r) => r.json())
      .then((d) => setCompany(d || {}))
      .catch(() => {});
  }, []);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Digite seu e-mail", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao enviar e-mail", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
      setForgotPassword(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      } else {
        navigate("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) {
        toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Conta criada!", description: "Você já pode acessar o sistema." });
        navigate("/");
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Painel esquerdo */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col items-center justify-center p-12 gap-8">
        {company.logo_url ? (
          <img src={cleanLogoUrl(company.logo_url)} alt="Logomarca" className="max-h-28 max-w-xs object-contain" />
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-slate-700 flex items-center justify-center text-4xl font-bold text-white select-none">
            {company.name?.[0]?.toUpperCase() || "C"}
          </div>
        )}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">{company.name || "Controle de Contratos"}</h1>
          <p className="text-slate-400 text-sm">Sistema de gestão de contratos e comissões</p>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-6 text-center">
          {[
            { label: "Comissões", desc: "Controle completo" },
            { label: "Contratos", desc: "Assinatura digital" },
            { label: "Relatórios", desc: "Visão gerencial" },
          ].map((item) => (
            <div key={item.label} className="bg-slate-800 rounded-xl p-4 space-y-1">
              <p className="text-white font-semibold text-sm">{item.label}</p>
              <p className="text-slate-400 text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 bg-white">
        {/* Logo mobile */}
        <div className="flex flex-col items-center gap-3 mb-8 lg:hidden">
          {company.logo_url ? (
            <img src={cleanLogoUrl(company.logo_url)} alt="Logomarca" className="max-h-16 object-contain" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-slate-900 flex items-center justify-center text-2xl font-bold text-white">
              {company.name?.[0]?.toUpperCase() || "C"}
            </div>
          )}
          <p className="font-semibold text-slate-800">{company.name || "Controle de Contratos"}</p>
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900">
              {forgotPassword ? "Recuperar senha" : isLogin ? "Bem-vindo de volta" : "Criar conta"}
            </h2>
            <p className="text-sm text-slate-500">
              {forgotPassword
                ? "Informe seu e-mail para receber o link de redefinição"
                : isLogin
                ? "Entre com suas credenciais para acessar"
                : "Preencha os dados para criar sua conta"}
            </p>
          </div>

          {forgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-forgot">E-mail</Label>
                <Input
                  id="email-forgot"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-700" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de redefinição"}
              </Button>
              <div className="text-center text-sm">
                <button type="button" className="text-slate-500 hover:text-slate-800 underline" onClick={() => setForgotPassword(false)}>
                  Voltar ao login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {isLogin && (
                <div className="text-right">
                  <button
                    type="button"
                    className="text-sm text-slate-500 hover:text-slate-800 underline"
                    onClick={() => setForgotPassword(true)}
                  >
                    Esqueci minha senha
                  </button>
                </div>
              )}
              <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-700" disabled={loading}>
                {loading ? "Carregando..." : isLogin ? "Entrar" : "Cadastrar"}
              </Button>
              <div className="text-center text-sm text-slate-500">
                <button type="button" className="hover:text-slate-800 underline" onClick={() => setIsLogin(!isLogin)}>
                  {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
