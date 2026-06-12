import React from "react";
import { User } from "@supabase/supabase-js";
import { LayoutDashboard, LogOut, Settings, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  user: User;
  onSignOut: () => void;
  onOpenSettings: () => void;
  signOutLoading: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export default function Navbar({ 
  user, 
  onSignOut, 
  onOpenSettings, 
  signOutLoading,
  theme,
  onToggleTheme
}: NavbarProps) {
  const userName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
  const userAvatar = user.user_metadata?.avatar_url || "";

  return (
    <header className="border-b border-border bg-card/85 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 select-none">
        <div className="h-8 w-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-500 dark:text-blue-400 shadow-lg shadow-blue-500/5">
          <LayoutDashboard className="h-4 w-4" />
        </div>
        <span className="font-bold tracking-tight text-lg bg-gradient-to-r from-foreground to-zinc-400 dark:to-zinc-500 bg-clip-text text-transparent">
          Frontend Planner
        </span>
      </div>

      {/* User Actions */}
      <div className="flex items-center gap-3">
        {/* User Identity */}
        <div className="flex items-center gap-2 border border-border bg-muted/40 rounded-full pl-1.5 pr-3 py-1">
          {userAvatar ? (
            <img src={userAvatar} alt={userName} className="h-5.5 w-5.5 rounded-full" />
          ) : (
            <div className="h-5.5 w-5.5 rounded-full bg-zinc-300 dark:bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-600 dark:text-zinc-300 font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-xs text-muted-foreground font-medium max-w-[120px] truncate">{userName}</span>
        </div>

        {/* Theme Toggle Button */}
        <Button
          onClick={onToggleTheme}
          variant="ghost"
          className="h-8 w-8 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer transition-colors"
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-slate-700" />
          )}
        </Button>

        {/* Settings Button */}
        <Button
          onClick={onOpenSettings}
          variant="ghost"
          className="h-8 w-8 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer transition-colors"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>

        {/* Logout Button */}
        <Button
          onClick={onSignOut}
          disabled={signOutLoading}
          variant="ghost"
          className="h-8 w-8 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer transition-colors"
          title="Sign out"
        >
          {signOutLoading ? (
            <div className="h-3.5 w-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
        </Button>
      </div>
    </header>
  );
}
