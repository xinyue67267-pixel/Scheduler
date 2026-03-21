import {
  Calendar,
  LayoutGrid,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  User,
  LogOut,
  LogIn,
} from 'lucide-react';
import type { Page } from '@/App';
import { useAuth } from '@/context/AuthContext';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  onLoginClick: () => void;
}

const navItems = [
  { id: 'timeline' as Page, label: '时间轴', icon: Calendar },
  { id: 'paradigm' as Page, label: '开发范式', icon: LayoutGrid },
  { id: 'requirements' as Page, label: '需求', icon: FileText },
];

const bottomItems = [
  { id: 'settings' as Page, label: '设置', icon: Settings },
];

export default function Sidebar({
  currentPage,
  onNavigate,
  expanded,
  onToggleExpand,
  onLoginClick,
}: SidebarProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const displayName = user?.name || user?.email?.split('@')[0] || '用户';
  const displayEmail = user?.email || '';

  return (
    <aside
      className={`sidebar transition-all duration-300 ${
        expanded ? 'w-[200px]' : 'w-[56px]'
      }`}
    >
      <div className="flex items-center h-14 px-3 border-b border-border">
        {expanded ? (
          <span className="text-base font-semibold text-primary">Scheduler</span>
        ) : (
          <span className="text-base font-semibold text-primary">S</span>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`nav-item w-full ${isActive ? 'nav-item-active' : ''}`}
              title={!expanded ? item.label : undefined}
            >
              <Icon size={20} />
              {expanded && <span className="text-sm">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="py-3 px-2 space-y-1 border-t border-border">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`nav-item w-full ${isActive ? 'nav-item-active' : ''}`}
              title={!expanded ? item.label : undefined}
            >
              <Icon size={20} />
              {expanded && <span className="text-sm">{item.label}</span>}
            </button>
          );
        })}
      </div>

      <div className="p-2 border-t border-border">
        {!expanded && (
          <button
            onClick={onToggleExpand}
            className="nav-item w-full justify-center"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="absolute bottom-20 left-2">
          <button
            onClick={onToggleExpand}
            className="nav-item"
          >
            <ChevronLeft size={20} />
          </button>
        </div>
      )}

      {expanded && (
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{displayName}</div>
              <div className="text-xs text-text-muted truncate">{displayEmail}</div>
            </div>
          </div>
          {isAuthenticated ? (
            <button
              onClick={logout}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-status-error hover:bg-status-error/10 rounded transition-colors"
            >
              <LogOut size={14} />
              退出登录
            </button>
          ) : (
            <button
              onClick={onLoginClick}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded transition-colors"
            >
              <LogIn size={14} />
              登录 / 注册
            </button>
          )}
        </div>
      )}

      {!expanded && isAuthenticated && (
        <div className="p-2 border-t border-border">
          <button
            onClick={logout}
            className="nav-item w-full justify-center"
            title="退出登录"
          >
            <LogOut size={20} />
          </button>
        </div>
      )}

      {!expanded && !isAuthenticated && (
        <div className="p-2 border-t border-border">
          <button
            onClick={onLoginClick}
            className="nav-item w-full justify-center"
            title="登录"
          >
            <LogIn size={20} />
          </button>
        </div>
      )}
    </aside>
  );
}
