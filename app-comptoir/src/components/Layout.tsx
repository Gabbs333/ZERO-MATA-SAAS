import { ReactNode, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ThemeToggle } from './ThemeToggle';
import logoLight from '../assets/logo-light.png';
import logoDark from '../assets/logo-dark.png';
import { useTheme } from '../hooks/useTheme';
import logoIcon from '../assets/icon.png';
import { 
  Menu, 
  X, 
  CheckCircle, 
  Receipt, 
  Package, 
  LogOut, 
  Store,
  Clock
} from 'lucide-react';
import clsx from 'clsx';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut, loading, error } = useAuthStore();
  const { theme } = useTheme();
  
  // Safe access to establishment name with array check (defensive programming)
  const getEtablissementName = () => {
    if (!profile?.etablissement) return null;
    if (Array.isArray(profile.etablissement)) {
      return profile.etablissement[0]?.nom;
    }
    // @ts-ignore - Supabase types might conflict with runtime data
    return profile.etablissement?.nom;
  };

  const etablissementName = getEtablissementName();
  
  // Determine display status
  let displayName = 'Non disponible';
  if (loading) {
    displayName = 'Chargement...';
  } else if (error) {
    displayName = 'Erreur système';
  } else if (!profile) {
    displayName = 'Profil introuvable';
  } else if (etablissementName) {
    displayName = etablissementName;
  } else if (!profile.etablissement_id) {
    displayName = 'Non assigné';
  } else {
    displayName = 'Introuvable'; // ID exists but data fetch failed
  }

  const menuItems = [
    { text: 'Validation', icon: CheckCircle, path: '/' },
    { text: 'Factures', icon: Receipt, path: '/factures' },
    { text: 'Historique', icon: Clock, path: '/historique' },
    { text: 'Stock', icon: Package, path: '/stock' },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex transition-colors overflow-hidden font-body">
      {/* Background ambient glow */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] opacity-50 dark:opacity-20 animate-pulse-slow"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-semantic-purple/10 rounded-full blur-[120px] opacity-50 dark:opacity-20 animate-pulse-slow" style={{ animationDelay: '1.5s' }}></div>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={clsx(
          "fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-r border-neutral-200/50 dark:border-white/5 transform transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none flex flex-col",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-20 flex items-center justify-between px-6 border-b border-neutral-200/50 dark:border-white/5 relative overflow-hidden flex-shrink-0">
          {/* Logo area glow */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
          
          <div className="h-20 w-auto flex items-center justify-start relative z-10">
            <img 
              src={theme === 'dark' ? logoDark : logoLight} 
              alt="ZERO-MATA" 
              className="h-full w-auto object-contain" 
            />
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Establishment Info */}
        <div className="px-4 py-3 border-b border-neutral-200/50 dark:border-white/5 flex-shrink-0 lg:hidden">
          <div className="bg-neutral-100/50 dark:bg-white/5 rounded-xl p-3 border border-neutral-200/50 dark:border-white/5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Store size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Établissement</p>
              <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                {displayName}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
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
                <span className={clsx("font-medium relative z-10 tracking-wide truncate", isActive ? "font-bold" : "")}>{item.text}</span>
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
                        {profile?.prenom?.[0] || 'U'}
                      </span>
                   </div>
                </div>
                <div className="flex-1 min-w-0">
                   <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                     {profile?.prenom} {profile?.nom}
                   </p>
                   <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate capitalize">
                     {profile?.role || 'Staff'}
                   </p>
                </div>
                <button
                   onClick={handleLogout}
                   className="p-2 text-neutral-400 hover:text-semantic-red transition-colors rounded-lg hover:bg-semantic-red/10"
                   title="Déconnexion"
                >
                   <LogOut size={18} />
                </button>
             </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen relative z-10 overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/80 dark:bg-neutral-900/60 backdrop-blur-xl border-b border-neutral-200/50 dark:border-white/5 flex items-center justify-between px-4 lg:px-8 transition-colors sticky top-0 z-40">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>

          <div className="flex-1 text-center lg:text-left lg:flex-none">
            <h1 className="lg:hidden text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-semantic-purple">
              Comptoir
            </h1>
          </div>
          
          {/* Desktop Establishment Branding */}
           <div className="hidden lg:flex items-center gap-3 bg-neutral-100/50 dark:bg-white/5 px-4 py-2 rounded-xl border border-neutral-200/50 dark:border-white/5 mr-auto ml-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                 <Store size={18} />
              </div>
              <div>
                 <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Établissement</p>
                 <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                {displayName}
              </p>
              </div>
           </div>

          <div className="lg:hidden">
            <ThemeToggle />
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
