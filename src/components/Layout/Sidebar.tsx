import {
  Calendar,
  LayoutGrid,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  User,
  HelpCircle,
  Search,
} from 'lucide-react';
import type { Page } from '@/App';
import { useStore } from '@/store';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  expanded: boolean;
  onToggleExpand: () => void;
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
}: SidebarProps) {
  const notifications = useStore((state) => state.notifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

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
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User size={16} className="text-primary" />
            </div>
            {expanded && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">管理员</div>
                <div className="text-xs text-text-muted truncate">admin@company.com</div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
