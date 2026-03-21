import React from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Files, 
  Image as ImageIcon, 
  Megaphone, 
  Share2, 
  Settings, 
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Monitor
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Asset Library", icon: Files },
  { href: "/brand-assets", label: "Brand Assets", icon: ImageIcon },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/social-accounts", label: "Social Accounts", icon: Share2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      title={`Theme: ${theme}`}
    >
      {theme === "light" && <Sun className="w-4 h-4" />}
      {theme === "dark" && <Moon className="w-4 h-4" />}
      {theme === "system" && <Monitor className="w-4 h-4" />}
    </button>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, tenant } = useAuth();
  const logout = useLogout();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => window.location.href = "/login",
    });
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex flex-col w-64 border-r border-sidebar-border bg-sidebar">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl saturn-gradient flex items-center justify-center shadow-lg">
            <Megaphone className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-xl saturn-gradient-text">
            Saturn
          </span>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-4">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground sidebar-item-active-gradient" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-sidebar-primary" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-sidebar-border">
          <div className="px-3 py-3 rounded-xl bg-sidebar-accent/50 flex flex-col gap-1 mb-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tenant</span>
            <span className="text-sm font-medium truncate">{tenant?.name}</span>
          </div>
          <div className="flex items-center justify-between px-3">
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold truncate">{user?.name}</span>
              <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button 
                onClick={handleLogout}
                className="p-2 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border/50 bg-background/80 backdrop-blur-lg sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl saturn-gradient flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-xl saturn-gradient-text">Saturn</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="w-6 h-6" />
            </Button>
          </div>
        </header>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 md:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <motion.aside 
                initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                className="fixed inset-y-0 left-0 w-3/4 max-w-xs bg-sidebar border-r border-sidebar-border z-50 flex flex-col md:hidden shadow-2xl"
              >
                <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
                  <span className="font-display font-bold text-xl saturn-gradient-text">Menu</span>
                  <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
                  {navItems.map((item) => {
                    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                    return (
                      <Link 
                        key={item.href} 
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl text-base font-medium transition-all ${
                          isActive 
                            ? "bg-sidebar-accent text-sidebar-accent-foreground sidebar-item-active-gradient" 
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
                <div className="p-4 border-t border-sidebar-border mt-auto">
                  <Button variant="destructive" className="w-full justify-start gap-2" onClick={handleLogout}>
                    <LogOut className="w-4 h-4" />
                    Logout
                  </Button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-7xl mx-auto h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
