import { useQuery } from '@tanstack/react-query';
import { ArrowRight, PenTool, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

const ROLE = {
  criador: { icon: PenTool, title: 'Criação / marketing', text: 'Cria briefings, gera e edita peças, conversa com o copiloto.' },
  revisor: { icon: ShieldCheck, title: 'Revisão / liderança', text: 'Aprova o conceito e decide as exceções. Não precisa revisar peça por peça.' },
  admin: { icon: SlidersHorizontal, title: 'Administração', text: 'Mantém marca, regras, ofertas e aprendizados. Pode tudo.' },
};

export function LoginPage() {
  const users = useQuery({ queryKey: ['users'], queryFn: api.users });
  const { login } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 p-6">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center text-white">
          <img src="/favicon.svg" className="mx-auto mb-4 h-14 w-14" alt="" />
          <h1 className="font-display text-3xl font-semibold">CreativeFlow AI</h1>
          <p className="mt-2 text-brand-100">Um briefing vira dezenas de peças multicanal — com a marca preservada e nada publicado sem conformidade.</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-4 text-sm font-medium text-slate-600">Entrar como (ambiente de demonstração, dados sintéticos):</div>
          {users.isLoading && <Spinner />}
          <div className="grid gap-3 sm:grid-cols-3">
            {users.data?.map((u) => {
              const r = ROLE[u.role];
              const Icon = r.icon;
              return (
                <button
                  key={u.id}
                  disabled={!!busy}
                  onClick={async () => {
                    setBusy(u.id);
                    try {
                      await login(u.id);
                      nav('/');
                    } catch (e) {
                      toast((e as Error).message, 'error');
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className="group flex flex-col rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-600 hover:shadow-md"
                >
                  <Icon className="mb-3 h-6 w-6 text-brand-600" />
                  <div className="font-semibold text-slate-900">{u.name}</div>
                  <div className="text-xs font-medium text-brand-600">{r.title}</div>
                  <p className="mt-2 flex-1 text-xs text-slate-500">{r.text}</p>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-brand-600">
                    {busy === u.id ? <Spinner className="h-4 w-4" /> : <>Entrar <ArrowRight className="h-3.5 w-3.5" /></>}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-5 text-center text-xs text-slate-400">Em produção, o acesso vem do SSO corporativo com os mesmos três perfis. Permissões são verificadas no servidor.</p>
        </div>
      </div>
    </div>
  );
}
