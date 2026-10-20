import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { CalendarClock, CheckSquare, FolderKanban, LayoutDashboard, LogOut, Package, PlusCircle, Settings2, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { can, useAuth } from '../lib/auth';
import { fmtDate } from '../lib/format';

const ROLE_LABEL = { criador: 'Criação / marketing', revisor: 'Revisão / liderança', admin: 'Administração' };

export function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const status = useQuery({ queryKey: ['status'], queryFn: api.status, refetchInterval: 30_000 });
  const queue = useQuery({ queryKey: ['queue'], queryFn: api.queue, refetchInterval: 20_000 });
  const pending = (queue.data?.items.length ?? 0) + (queue.data?.concepts.length ?? 0);
  const ai = status.data?.ai;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <img src="/favicon.svg" className="h-8 w-8" alt="" />
          <div>
            <div className="font-display text-[15px] font-semibold leading-tight text-slate-900">CreativeFlow AI</div>
            <div className="text-[11px] text-slate-500">Produção criativa com governança</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          <Item to="/" icon={<LayoutDashboard className="h-4 w-4" />} end>
            Painel
          </Item>
          <Item to="/campanhas" icon={<FolderKanban className="h-4 w-4" />} end>
            Campanhas
          </Item>
          {can(user, 'criador') && (
            <Item to="/campanhas/nova" icon={<PlusCircle className="h-4 w-4" />}>
              Nova campanha
            </Item>
          )}
          <Item to="/aprovacoes" icon={<CheckSquare className="h-4 w-4" />} badge={pending || undefined}>
            Aprovações
          </Item>
          <Item to="/catalogo" icon={<Package className="h-4 w-4" />}>
            Catálogo e ofertas
          </Item>
          <Item to="/admin" icon={<Settings2 className="h-4 w-4" />}>
            Marca e regras
          </Item>
        </nav>
        <div className="space-y-2 border-t border-slate-200 p-4 text-xs">
          {ai && (
            <div className={clsx('flex items-center gap-1.5 rounded-md px-2 py-1.5', ai.mode === 'ia-generativa' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-800')} title={ai.mode === 'ia-generativa' ? `Provedor: ${ai.provider}` : 'Sem chave de IA configurada: respostas determinísticas para demonstração.'}>
              <Sparkles className="h-3.5 w-3.5" />
              {ai.mode === 'ia-generativa' ? `IA: ${ai.provider}` : 'IA: modo demonstração'}
            </div>
          )}
          {status.data && (
            <div className="flex items-center gap-1.5 px-2 text-slate-500" title="Data de referência para vigência das ofertas">
              <CalendarClock className="h-3.5 w-3.5" /> Hoje: {fmtDate(status.data.today)}
            </div>
          )}
          <div className="px-2 text-[11px] text-slate-400">Dados 100% sintéticos · marca {status.data?.brandVersion}</div>
        </div>
        {user && (
          <div className="flex items-center gap-3 border-t border-slate-200 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{user.name.split(' ').map((p) => p[0]).join('')}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-[11px] text-slate-500">{ROLE_LABEL[user.role]}</div>
            </div>
            <button
              title="Trocar de usuário"
              onClick={() => {
                logout();
                nav('/entrar');
              }}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function Item({ to, icon, children, badge, end }: { to: string; icon: ReactNode; children: ReactNode; badge?: number; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => clsx('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition', isActive ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {badge ? <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{badge}</span> : null}
    </NavLink>
  );
}

export function PageShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={clsx('mx-auto px-8 py-8', wide ? 'max-w-[1600px]' : 'max-w-7xl')}>{children}</div>;
}
