import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Database, Settings, FileText } from 'lucide-react';
import { cn } from '../../utils/cn';

const navItems = [
  { path: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { path: '/chat', label: 'Chat', icon: MessageSquare },
  { path: '/knowledge', label: 'RAG', icon: Database },
  { path: '/agent-settings', label: 'Agente', icon: Settings },
  { path: '/reports', label: 'Relatórios', icon: FileText },
];

export const BottomNav = () => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 z-50 px-2 pb-safe">
      <ul className="flex items-center justify-around h-16">
        {navItems.map((item) => (
          <li key={item.path} className="flex-1">
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center h-full w-full space-y-1 min-h-[44px]',
                  isActive
                    ? 'text-sifto-cobalt-light'
                    : 'text-zinc-500 hover:text-zinc-400'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
