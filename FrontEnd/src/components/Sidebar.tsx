
import { MessageCircle, Users, FileText, BarChart3, Settings, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export const Sidebar = ({ activeView, onViewChange }: SidebarProps) => {
  const { user } = useAuth();
  
  const menuItems = [
    { id: 'chats', label: 'Conversations', icon: MessageCircle },
    { id: 'bulk', label: 'Bulk Messaging', icon: Send },
    { id: 'templates', label: 'Templates', icon: FileText },
    // Only show analytics for admin users
    ...(user?.role === 'admin' ? [{ id: 'analytics', label: 'Analytics', icon: BarChart3 }] : []),
    { id: 'users', label: 'User Management', icon: Users },
  ];

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <img 
            src="/EJ Logo.png" 
            alt="EarlyJobs Logo" 
            className="w-10 h-10 object-contain"
          />
          <div>
            <h2 className="font-semibold text-foreground">EarlyJobs</h2>
            <p className="text-xs text-muted-foreground">WhatsApp Platform</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange(item.id)}
                  className={cn(
                    "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors",
                    activeView === item.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
            <span className="text-muted-foreground text-sm">AD</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Admin User</p>
            <p className="text-xs text-muted-foreground">admin@earlyjobs.com</p>
          </div>
          <Settings className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
};
