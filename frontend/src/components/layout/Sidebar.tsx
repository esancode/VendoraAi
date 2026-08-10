import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Database, Settings, FileText, LogOut, CreditCard } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import { ConfirmModal } from '../feedback/ConfirmModal';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/chat', label: 'Copiloto', icon: MessageSquare },
  { path: '/knowledge', label: 'Base de Conhecimento', icon: Database },
  { path: '/agent-settings', label: 'Configuração do Agente', icon: Settings },
  { path: '/reports', label: 'Relatórios', icon: FileText },
];

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  return (
    <aside className="hidden md:flex w-64 flex-col bg-zinc-950 border-r border-zinc-800 h-screen sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-emerald-500 flex items-center justify-center">
            <span className="text-white font-bold text-xl">V</span>
          </div>
          <span className="text-xl font-bold text-zinc-100 tracking-tight">VendoraAI</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded transition-all duration-200 text-sm font-medium',
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-6 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-sm bg-zinc-900 object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-sm bg-zinc-900 flex items-center justify-center text-zinc-400 font-semibold uppercase">
                {user?.name?.substring(0, 2) || 'AD'}
              </div>
            )}
            <div className="flex flex-col max-w-[120px]">
              <p className="text-sm font-medium text-zinc-300 truncate" title={user?.name}>{user?.name || 'Admin'}</p>
              <p className="text-xs text-zinc-500 truncate" title={user?.email}>{user?.email || 'admin@vendora.ai'}</p>
            </div>
          </div>
          <div className="flex items-center">
            <Link to="/settings/billing" className="text-zinc-500 hover:text-emerald-400 transition-colors p-2 rounded-sm hover:bg-zinc-900" title="Assinatura & Planos">
              <span className="sr-only">Faturamento</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            </Link>
            <button 
              onClick={() => setIsLogoutModalOpen(true)} 
              className="text-zinc-500 hover:text-rose-500 transition-colors p-2 rounded-sm hover:bg-zinc-900 ml-1"
              title="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={isLogoutModalOpen}
        title="Sair da conta"
        message="Tem certeza que deseja sair da conta? Você precisará fazer login novamente para acessar o sistema."
        confirmText="Sair"
        onConfirm={logout}
        onCancel={() => setIsLogoutModalOpen(false)}
      />
    </aside>
  );
};
