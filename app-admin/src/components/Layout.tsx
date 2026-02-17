import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import ThemeToggle from './ThemeToggle';
import { 
  LayoutDashboard, 
  Building2, 
  BarChart3, 
  Menu, 
  LogOut,
  X,
  Users,
  CreditCard
} from 'lucide-react';
import clsx from 'clsx';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { label: 'Tableau de Bord', path: '/', icon: LayoutDashboard },
  { label: 'Établissements', path: '/etablissements', icon: Building2 },
  { label: 'Utilisateurs', path: '/utilisateurs', icon: Users },
  { label: 'Abonnements', path: '/abonnements', icon: CreditCard },
  { label: 'Statistiques', path: '/stats', icon: BarChart3 },
];

export default function Layout({ children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut } = useAuthStore();

  const handleLogout = () => {
    signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex transition-colors overflow-hidden">
      {/* Background ambient glow */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] opacity-50 dark:opacity-20 animate-pulse-slow"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-semantic-purple/10 rounded-full blur-[120px] opacity-50 dark:opacity-20 animate-pulse-slow" style={{ animationDelay: '1.5s' }}></div>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={clsx(
          "fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-r border-neutral-200/50 dark:border-white/5 transform transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none flex flex-col",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-20 flex items-center justify-between px-6 border-b border-neutral-200/50 dark:border-white/5 relative overflow-hidden flex-shrink-0">
          {/* Logo area glow */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-semantic-purple flex items-center justify-center text-white font-bold shadow-lg shadow-primary/30">
              A
            </div>
            <span className="text-xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-600 dark:from-white dark:to-neutral-400">
              Admin SaaS
            </span>
          </div>
          <button 
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  "relative group flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-300 w-full",
                  isActive 
                    ? "text-white shadow-lg shadow-primary/25" 
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                {/* Active Background with Gradient */}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-semantic-blue opacity-100 z-0 rounded-xl"></div>
                )}
                
                {/* Hover Background (Glass) */}
                {!isActive && (
                  <div className="absolute inset-0 bg-neutral-100 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity z-0 rounded-xl"></div>
                )}

                {/* Active Border Indicator */}
                {isActive && (
                   <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-white rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.5)] z-10"></div>
                )}

                <Icon size={22} className={clsx("relative z-10 transition-transform duration-300 group-hover:scale-110 flex-shrink-0", isActive ? "text-white" : "text-neutral-500 dark:text-neutral-400 group-hover:text-primary dark:group-hover:text-white")} />
                <span className={clsx("font-medium relative z-10 tracking-wide truncate", isActive ? "font-bold" : "")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        {/* Sidebar Footer / User Mini Profile */}
        <div className="p-4 border-t border-neutral-200/50 dark:border-white/5 bg-neutral-50/50 dark:bg-black/20 backdrop-blur-sm flex-shrink-0 space-y-3">
             <div className="flex items-center justify-between px-2">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Mode</span>
                <ThemeToggle />
             </div>
             <div className="flex items-center gap-3 px-2 pt-2 border-t border-neutral-200/50 dark:border-white/5">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-700 dark:to-neutral-600 p-[1px] flex-shrink-0">
                   <div className="h-full w-full rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center">
                      <span className="font-bold text-neutral-700 dark:text-neutral-300 text-sm">
                        {profile?.prenom?.[0]}{profile?.nom?.[0]}
                      </span>
                   </div>
                </div>
                <div className="flex-1 min-w-0">
                   <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                     {profile?.prenom} {profile?.nom}
                   </p>
                   <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                     Administrateur
                   </p>
                </div>
             </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen relative z-10 overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/80 dark:bg-neutral-900/60 backdrop-blur-xl border-b border-neutral-200/50 dark:border-white/5 flex items-center justify-between px-4 lg:px-8 transition-colors sticky top-0 z-40">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>

          <div className="flex-1 lg:flex-none">
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-semantic-purple lg:hidden ml-2">
              Admin SaaS
            </h1>
          </div>

          <div className="flex items-center space-x-6">
            <div className="hidden lg:block">
              <ThemeToggle />
            </div>

            <div className="text-right hidden sm:block">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100/50 dark:bg-white/5 border border-neutral-200 dark:border-white/10">
                <div className="w-2 h-2 rounded-full bg-semantic-green animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Système opérationnel</span>
              </div>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="group h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-primary dark:text-white transition-all border border-neutral-200 dark:border-white/10 hover:border-primary/50 dark:hover:border-primary/50 hover:shadow-glow"
              >
                <span className="font-bold group-hover:scale-110 transition-transform">
                  {profile?.prenom?.[0]}{profile?.nom?.[0]}
                </span>
              </button>

              {/* Dropdown Menu */}
              {userMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-[#0B1121] rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 py-2 z-20 overflow-hidden transform origin-top-right transition-all animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-4 py-3 border-b border-neutral-100 dark:border-white/5 mb-1">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">Connecté en tant que</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 text-sm text-semantic-red hover:bg-semantic-red/5 flex items-center space-x-3 transition-colors font-medium"
                    >
                      <LogOut size={18} />
                      <span>Déconnexion</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-8 relative">
          <div className="max-w-7xl mx-auto space-y-6 w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
