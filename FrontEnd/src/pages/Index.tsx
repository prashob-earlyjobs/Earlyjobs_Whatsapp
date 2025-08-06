import { useState, useEffect } from "react";
import { LogOut, User, Settings, Plus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sidebar } from "@/components/Sidebar";
import { ChatInterface } from "@/components/ChatInterface";
import { BulkMessaging } from "@/components/BulkMessaging";
import { TemplateManager } from "@/components/TemplateManager";
import { Analytics } from "@/components/Analytics";
import { UserManagement } from "@/components/UserManagement";
import { StartConversationModal } from "@/components/StartConversationModal";
import { useAuth } from "@/contexts/AuthContext";
import { Conversation } from "@/lib/api";

const Index = () => {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const [activeView, setActiveView] = useState("chats");
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Clear selected conversation when user logs out or on initial load
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      setSelectedConversation(null);
    }
  }, [isAuthenticated, isLoading]);

  // Trigger refresh when auth state changes (helps with page refresh)
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setRefreshTrigger(prev => prev + 1);
    }
  }, [isAuthenticated, isLoading]);

  const handleLogout = async () => {
    try {
      await logout();
      // Clear selected conversation on logout
      setSelectedConversation(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleStartConversation = () => {
    setIsStartModalOpen(true);
  };

  const handleConversationStarted = (conversation: Conversation) => {
    // Switch to chats view if not already there
    if (activeView !== "chats") {
      setActiveView("chats");
    }
    // Select the new conversation
    setSelectedConversation(conversation);
    // Trigger refresh of conversation list
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const renderContent = () => {
    switch (activeView) {
      case "chats":
        return (
          <ChatInterface
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
            onStartNewConversation={handleStartConversation}
            refreshTrigger={refreshTrigger}
          />
        );
      case "bulk":
        return <BulkMessaging onBulkMessageComplete={() => setRefreshTrigger(prev => prev + 1)} />;
      case "templates":
        return <TemplateManager />;
      case "analytics":
        // Check if user has admin access for analytics
        if (user?.role !== 'admin') {
          return (
            <div className="h-full p-6 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                      <Shield className="w-8 h-8 text-red-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
                      <p className="text-muted-foreground mb-4">
                        You don't have permission to access the Analytics dashboard.
                      </p>
                      <div className="max-w-md mx-auto p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">
                          Analytics access is restricted to administrators only. 
                          Please contact your system administrator if you need access to this feature.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return <Analytics />;
      case "users":
        return <UserManagement />;
      default:
        return (
          <ChatInterface
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
            onStartNewConversation={handleStartConversation}
            refreshTrigger={refreshTrigger}
          />
        );
    }
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return "U";
    const names = user.name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return user.name[0].toUpperCase();
  };

  // Get role display name
  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "bde":
        return "Business Development";
      case "hr":
        return "HR Manager";
      case "franchise":
        return "Franchise Manager";
      case "tech":
        return "Technical Support";
      default:
        return role;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col">
        <header className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Start New Conversation Button - Only show in chats view */}
              {activeView === "chats" && (
                <Button
                  onClick={handleStartConversation}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <Plus className="w-4 h-4" />
                  New Chat
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-muted-foreground">Connected</span>
              </div>

              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {getRoleDisplayName(user?.role || "")}
                      </p>
                      {user?.department && (
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.department}
                        </p>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-hidden">{renderContent()}</main>
      </div>

      {/* Start Conversation Modal */}
      <StartConversationModal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        onSuccess={handleConversationStarted}
      />
    </div>
  );
};

export default Index;
