import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/auth/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Visão de Jogo" },
      { name: "description", content: "Crie sua conta no Visão de Jogo. Exclusivo para maiores de 18 anos." },
    ],
  }),
  component: CadastroPage,
});

function ageFromBirthdate(iso: string): number {
  const b = new Date(iso);
  const n = new Date();
  let age = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) age--;
  return age;
}

const schema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(72),
  birthDate: z.string().min(1, "Informe sua data de nascimento"),
  age18: z.boolean(),
  terms: z.boolean(),
}).refine((d) => d.age18, { path: ["age18"], message: "Confirmação obrigatória" })
  .refine((d) => d.terms, { path: ["terms"], message: "Aceite necessário" })
  .refine((d) => ageFromBirthdate(d.birthDate) >= 18, {
    path: ["birthDate"],
    message: "É preciso ter 18 anos ou mais",
  });

function CadastroPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    birthDate: "",
    age18: false,
    terms: false,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) map[issue.path[0] as string] = issue.message;
      setErrors(map);
      return;
    }
    if (!isSupabaseConfigured) {
      toast.error("Supabase não configurado. Preencha .env com VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/perfil`,
        data: {
          full_name: form.fullName,
          birth_date: form.birthDate,
          terms_accepted_at: new Date().toISOString(),
        },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta criada. Verifique seu e-mail para confirmar.");
    navigate({ to: "/auth/entrar" });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Criar conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Exclusivo para maiores de 18 anos.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Nome completo" id="fullName" error={errors.fullName}>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              autoComplete="name"
            />
          </Field>
          <Field label="E-mail" id="email" error={errors.email}>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
            />
          </Field>
          <Field label="Senha" id="password" error={errors.password}>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Data de nascimento" id="birthDate" error={errors.birthDate}>
            <Input
              id="birthDate"
              type="date"
              value={form.birthDate}
              onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            />
          </Field>

          <div className="space-y-3 rounded-lg border border-border/60 bg-background/40 p-3 text-sm">
            <CheckRow
              checked={form.age18}
              onChange={(v) => setForm({ ...form, age18: v })}
              error={errors.age18}
              id="age18"
            >
              Confirmo que tenho <strong>18 anos ou mais</strong>.
            </CheckRow>
            <CheckRow
              checked={form.terms}
              onChange={(v) => setForm({ ...form, terms: v })}
              error={errors.terms}
              id="terms"
            >
              Li e aceito os{" "}
              <Link to="/termos" className="text-primary underline underline-offset-2">
                Termos de Uso Responsável
              </Link>{" "}
              e entendo que o Visão de Jogo <strong>não recebe apostas, não executa apostas
              e não garante lucro</strong>.
            </CheckRow>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/auth/entrar" className="text-primary underline underline-offset-2">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function CheckRow({
  id,
  checked,
  onChange,
  error,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 leading-relaxed">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onChange(Boolean(v))}
          className="mt-0.5"
        />
        <span>{children}</span>
      </label>
      {error && <p className="mt-1 pl-7 text-xs text-destructive">{error}</p>}
    </div>
  );
}
