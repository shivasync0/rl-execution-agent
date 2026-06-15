import { useState } from 'react';
import { 
  Play, 
  LayoutDashboard, 
  Cpu, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  TrendingUp
} from 'lucide-react';

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
}

export default function Sidebar({ activePage, setActivePage }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const menuItems = [
    { id: 'simulator', label: 'Live Simulator', icon: Play },
    { id: 'dashboard', label: 'Training Dashboard', icon: LayoutDashboard },
    { id: 'inspector', label: 'Agent Inspector', icon: Cpu },
    { id: 'config', label: 'Configuration', icon: Settings },
  ];

  return (
    <aside 
      className={`fixed top-0 left-0 h-screen bg-[#171B22] border-r border-[#262C36] text-[#9CA3AF] transition-all duration-300 z-30 flex flex-col ${
        isExpanded ? 'w-[220px]' : 'w-[64px]'
      }`}
    >
      {/* Brand logo section */}
      <div className="h-14 flex items-center px-4 border-b border-[#262C36] overflow-hidden shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-[#2D8C6A] to-[#1E6B4E] flex items-center justify-center shrink-0 shadow-lg shadow-[#2D8C6A]/15">
            <TrendingUp size={16} className="text-white" />
          </div>
          {isExpanded && (
            <span className="font-display font-bold text-base text-white tracking-tight">
              Exec<span className="text-[#2D8C6A]">Agent</span>
            </span>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-5 px-2.5 space-y-1 overflow-y-auto">
        {isExpanded && (
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-600 px-3 mb-2 block">
            Navigation
          </span>
        )}
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center rounded transition-all duration-200 group text-left ${
                isActive 
                  ? 'bg-gradient-to-r from-[#2D8C6A]/15 to-[#2D8C6A]/5 text-white border border-[#2D8C6A]/25' 
                  : 'hover:bg-[#0F1115] text-[#9CA3AF] hover:text-[#F4F5F7] border border-transparent'
              } ${isExpanded ? 'px-3.5 py-2.5 gap-3' : 'p-2.5 justify-center'}`}
              title={!isExpanded ? item.label : undefined}
            >
              <Icon 
                size={18} 
                className={`shrink-0 transition-all duration-200 ${
                  isActive ? 'text-[#2D8C6A]' : 'text-gray-500 group-hover:text-gray-400 group-hover:scale-105'
                }`} 
              />
              {isExpanded && (
                <span className={`text-[13px] whitespace-nowrap ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {item.label}
                </span>
              )}
              {isExpanded && isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#2D8C6A]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse / Expand Toggle Button */}
      <div className="p-2.5 border-t border-[#262C36] flex justify-end shrink-0">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center p-2 rounded hover:bg-[#0F1115] text-gray-500 hover:text-gray-300 transition-all"
        >
          {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
    </aside>
  );
}
