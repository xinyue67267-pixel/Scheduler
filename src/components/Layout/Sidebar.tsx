import {
  Calendar,
  LayoutGrid,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
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
      className={`sidebar flex flex-col transition-all duration-300 ${
        expanded ? 'w-[200px]' : 'w-[56px]'
      }`}
    >
      <div className="flex items-center h-14 px-3 border-b border-border flex-shrink-0">
        {expanded ? (
          <span className="text-base font-semibold text-primary">Scheduler</span>
        ) : (
          <span className="text-base font-semibold text-primary">S</span>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
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

      <div className="flex-shrink-0 border-t border-border">
        <button
          onClick={() => onNavigate('settings')}
          className={`nav-item w-full ${currentPage === 'settings' ? 'nav-item-active' : ''}`}
          title={!expanded ? '设置' : undefined}
        >
          <Settings size={20} />
          {expanded && <span className="text-sm">设置</span>}
        </button>

        {!isAuthenticated ? (
          <button
            onClick={onLoginClick}
            className="nav-item w-full text-primary"
            title={!expanded ? '登录' : undefined}
          >
            <LogIn size={20} />
            {expanded && <span className="text-sm">登录 / 注册</span>}
          </button>
        ) : (
          <button
            onClick={logout}
            className="nav-item w-full text-status-error"
            title={!expanded ? '退出登录' : undefined}
          >
            <LogOut size={20} />
            {expanded && <span className="text-sm">退出登录</span>}
          </button>
        )}

        <button
          onClick={onToggleExpand}
          className="nav-item w-full"
          title={expanded ? '收起' : '展开'}
        >
          {expanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          {expanded && <span className="text-sm">收起</span>}
        </button>
      </div>

      {expanded && (
        <div className="flex-shrink-0 p-3 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{displayName}</div>
              <div className="text-xs text-text-muted truncate">{displayEmail}</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
