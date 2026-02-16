import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Settings, 
  Banknote, 
  Truck, 
  ShoppingCart, 
  Search, 
  LogOut, 
  ChevronLeft,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { NotificationsPopover } from './NotificationsPopover';
import logoFull from '../assets/logo.png';
import logoIcon from '../assets/icon.png';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuthStore();
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setShowMobileNav(false);
      } else {
        setShowMobileNav(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed.toString());
  }, [isCollapsed]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);
  const { data: profileWithEtablissement } = useSupabaseQuery<{
    etablissement: { nom: string } | null;
  } | null>(
    ['profile-etablissement', profile?.id],
    async () => {
      if (!profile?.id) return { data: null, error: null };
      return supabase
        .from('profiles')
        .select('*, etablissement:etablissements(nom)')
        .eq('id', profile.id)
        .single()
        .then(({ data, error }) => ({ data: data as { etablissement: { nom: string } | null } | null, error }));
    },
    { enabled: !!profile?.id }
  );

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const menuItems = [
    { text: 'Overview', icon: LayoutDashboard, path: '/dashboard', roles: ['gerant', 'patron'] },
    { text: 'Stock', icon: Package, path: '/stock', roles: ['gerant', 'patron'] },
    { text: 'Staff', icon: Users, path: '/utilisateurs', roles: ['patron'] },
    { text: 'Settings', icon: Settings, path: '/profil', roles: ['gerant', 'patron'] },
  ];

  const secondaryItems = [
      { text: 'Finances', icon: Banknote, path: '/finances', roles: ['gerant', 'patron'] },
      { text: 'Supply', icon: Truck, path: '/ravitaillements', roles: ['gerant', 'patron'] },
      { text: 'Products', icon: ShoppingCart, path: '/produits', roles: ['gerant', 'patron'] },
      { text: 'Tables', icon: LayoutDashboard, path: '/tables', roles: ['gerant', 'patron'] },
      { text: 'Performance', icon: Banknote, path: '/profits', roles: ['patron'] },
  ];

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(profile?.role || '')
  );

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className={`min-h-screen bg-neutral-50 dark:bg-dark-bg pb-24 md:pb-0 ${isCollapsed ? 'md:pl-20' : 'md:pl-64'} transition-all duration-300 relative overflow-x-hidden`}>
      {/* Ambient Glow Effects for Dark Mode (Deep Space theme) */}
      <div className="hidden dark:block absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-dark-accent/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="hidden dark:block absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Top App Bar (Mobile & Desktop) */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-dark-bg/80 backdrop-blur-xl border-b border-neutral-200 dark:border-white/5 transition-colors duration-300">
        <div className="flex items-center justify-between p-4 pb-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative group cursor-pointer" onClick={() => navigate('/profil')}>
              <div 
                className="bg-center bg-no-repeat bg-cover rounded-2xl size-10 border border-neutral-200 dark:border-white/10 shadow-sm group-hover:scale-105 transition-transform"
                style={{ backgroundImage: `url("https://ui-avatars.com/api/?name=${profile?.prenom}+${profile?.nom}&background=random")` }}
              ></div>
              <div className="absolute -bottom-0.5 -right-0.5 size-3.5 bg-green-500 rounded-full border-2 border-white dark:border-dark-bg shadow-sm"></div>
            </div>
            <div className="flex flex-col">
              <h2 className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-none mb-1">
                {profile?.role === 'patron' ? 'Mode Propriétaire' : 'Mode Gérant'}
              </h2>
              <h1 className="text-primary dark:text-white text-base font-bold leading-none tracking-tight">
                {profileWithEtablissement?.etablissement?.nom || 'Chargement...'}
              </h1>
            </div>
          </div>
          
          <div className="flex gap-2 items-center">
             <div className="hidden sm:block">
               <ThemeToggle />
             </div>
             <button 
                onClick={handleLogout}
                className="flex items-center justify-center size-10 rounded-2xl bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-neutral-400 hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400"
                title="Déconnexion"
             >
                <LogOut className="w-5 h-5" />
             </button>
             <NotificationsPopover />
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className={`hidden md:flex fixed top-0 left-0 bottom-0 ${isCollapsed ? 'w-20' : 'w-64'} flex-col bg-white dark:bg-dark-card border-r border-neutral-200 dark:border-white/5 z-50 transition-all duration-300`}>
          <div className={`p-6 border-b border-neutral-200 dark:border-white/5 relative flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between'}`}>
             <div className={`flex items-center gap-3 ${isCollapsed ? 'hidden' : 'flex'}`}>
                <div className="h-14 w-auto flex items-center justify-start">
                   <img src={logoFull} alt="ZERO-MATA" className="h-full w-auto object-contain" />
                </div>
             </div>
             
             {isCollapsed && (
               <div className="size-10 flex items-center justify-center bg-white rounded-xl shadow-sm p-1.5 border border-neutral-100 dark:border-white/5">
                 <img src={logoIcon} alt="ZM" className="w-full h-full object-contain" />
               </div>
             )}

             <button 
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={`absolute -right-3 top-1/2 -translate-y-1/2 size-6 rounded-full bg-white dark:bg-dark-card border border-neutral-200 dark:border-white/10 flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:text-primary dark:hover:text-dark-accent transition-colors shadow-sm z-50`}
             >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
             </button>
          </div>
          
          <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5 custom-scrollbar">
              {!isCollapsed && <p className="px-4 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-3 mt-2">Principal</p>}
              {filteredMenuItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    title={isCollapsed ? item.text : ''}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
                        isActive(item.path) 
                        ? 'bg-primary text-white dark:bg-dark-accent dark:text-white shadow-xl shadow-primary/20 dark:shadow-dark-accent/20 scale-[1.02]' 
                        : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white'
                    } ${isCollapsed ? 'justify-center px-0 h-12 w-12 mx-auto' : ''}`}
                  >
                      <item.icon className={`w-5 h-5 shrink-0 ${isActive(item.path) ? 'animate-pulse-slow' : 'opacity-70'}`} />
                      {!isCollapsed && <span className="truncate">{item.text}</span>}
                  </button>
              ))}

               {!isCollapsed && <p className="px-4 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-3 mt-8">Opérations</p>}
               {secondaryItems.filter(item => item.roles.includes(profile?.role || '')).map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    title={isCollapsed ? item.text : ''}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
                        isActive(item.path) 
                        ? 'bg-primary text-white dark:bg-dark-accent dark:text-white shadow-xl shadow-primary/20 dark:shadow-dark-accent/20 scale-[1.02]' 
                        : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white'
                    } ${isCollapsed ? 'justify-center px-0 h-12 w-12 mx-auto' : ''}`}
                  >
                      <item.icon className={`w-5 h-5 shrink-0 ${isActive(item.path) ? 'animate-pulse-slow' : 'opacity-70'}`} />
                      {!isCollapsed && <span className="truncate">{item.text}</span>}
                  </button>
              ))}
          </nav>

          <div className="p-4 border-t border-neutral-200 dark:border-white/5 space-y-3">
             <div className={`flex items-center rounded-2xl bg-neutral-100 dark:bg-white/5 border border-transparent dark:border-white/5 transition-colors ${isCollapsed ? 'justify-center p-2' : 'justify-between px-4 py-3'}`}>
                {!isCollapsed && <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Mode Sombre</span>}
                <ThemeToggle />
             </div>
             {!isCollapsed && (
               <div className="flex items-center gap-3 px-4 text-[10px] text-neutral-400 font-medium">
                  <div className="size-1.5 rounded-full bg-green-500"></div>
                  <span>Système en ligne</span>
               </div>
             )}
          </div>
      </div>

      {/* Mobile Sidebar Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] animate-in fade-in duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div className={`md:hidden fixed top-0 left-0 bottom-0 w-72 bg-white dark:bg-dark-card z-[70] shadow-2xl transition-transform duration-300 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 border-b border-neutral-200 dark:border-white/5 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <img src={logoFull} alt="ZERO-MATA" className="h-10 w-auto object-contain" />
             </div>
             <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-xl bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400"
             >
                <X className="w-5 h-5" />
             </button>
          </div>
          
          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5 custom-scrollbar">
              <p className="px-3 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-3 mt-2">Principal</p>
              {filteredMenuItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
                        isActive(item.path) 
                        ? 'bg-primary text-white dark:bg-dark-accent dark:text-white shadow-xl shadow-primary/20 dark:shadow-dark-accent/20 scale-[1.02]' 
                        : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white'
                    }`}
                  >
                      <item.icon className={`w-5 h-5 ${isActive(item.path) ? 'animate-pulse-slow' : 'opacity-70'}`} />
                      {item.text}
                  </button>
              ))}

               <p className="px-3 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-3 mt-8">Opérations</p>
               {secondaryItems.filter(item => item.roles.includes(profile?.role || '')).map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
                        isActive(item.path) 
                        ? 'bg-primary text-white dark:bg-dark-accent dark:text-white shadow-xl shadow-primary/20 dark:shadow-dark-accent/20 scale-[1.02]' 
                        : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white'
                    }`}
                  >
                      <item.icon className={`w-5 h-5 ${isActive(item.path) ? 'animate-pulse-slow' : 'opacity-70'}`} />
                      {item.text}
                  </button>
              ))}
          </nav>

          <div className="p-4 border-t border-neutral-200 dark:border-white/5 space-y-3">
             <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-white/5 border border-transparent dark:border-white/5 transition-colors">
                <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Mode Sombre</span>
                <ThemeToggle />
             </div>
             <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
             >
                <LogOut className="w-5 h-5" />
                <span>Déconnexion</span>
             </button>
          </div>
      </div>

      {/* Mobile Floating Menu Button (Shows when bottom nav is hidden) */}
      <button 
        onClick={() => setIsMobileMenuOpen(true)}
        className={`md:hidden fixed bottom-6 right-6 size-12 rounded-full bg-primary dark:bg-dark-accent text-white dark:text-primary shadow-xl z-[45] flex items-center justify-center transition-all duration-500 ${!showMobileNav ? 'scale-100 opacity-100 translate-y-0' : 'scale-0 opacity-0 translate-y-10 pointer-events-none'}`}
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 min-h-screen">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className={`md:hidden fixed bottom-0 left-0 w-full bg-white/90 dark:bg-dark-card/95 backdrop-blur-2xl border-t border-neutral-200 dark:border-white/5 pb-safe z-50 transition-all duration-500 shadow-2xl shadow-black ${showMobileNav ? 'translate-y-0' : 'translate-y-full opacity-0 pointer-events-none'}`}>
        <div className="flex flex-col gap-3 p-3">
          {/* Operations Bar (Scrollable) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar px-1">
            {secondaryItems.filter(item => item.roles.includes(profile?.role || '')).map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all active:scale-95 ${
                  isActive(item.path)
                    ? 'bg-primary text-white dark:bg-dark-accent shadow-lg shadow-primary/20 dark:shadow-dark-accent/20'
                    : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400 border border-neutral-200/50 dark:border-white/5'
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.text}
              </button>
            ))}
          </div>

          {/* Main Navigation Bar */}
          <div className="flex justify-around items-center pt-2 border-t border-neutral-100 dark:border-white/5">
            {filteredMenuItems.map((item) => (
              <button 
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-1.5 py-1 px-3 min-w-[64px] transition-all active:scale-90"
              >
                <div className={`p-2 rounded-2xl transition-all ${isActive(item.path) ? 'bg-primary/10 dark:bg-dark-accent/10' : ''}`}>
                  <item.icon className={`w-6 h-6 transition-all duration-300 ${isActive(item.path) ? 'text-primary dark:text-dark-accent scale-110' : 'text-neutral-400 dark:text-neutral-500'}`} />
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-[0.15em] transition-colors ${isActive(item.path) ? 'text-primary dark:text-white' : 'text-neutral-400 dark:text-neutral-500'}`}>
                  {item.text}
                </span>
              </button>
            ))}
            {/* Theme Toggle in Mobile Nav */}
            <div className="flex flex-col items-center gap-1.5 py-1 px-3">
              <div className="p-1">
                <ThemeToggle />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-neutral-400 dark:text-neutral-500">Thème</span>
            </div>
          </div>
        </div>
        {/* iOS Home Indicator simulation */}
        <div className="w-full flex justify-center pb-2">
            <div className="w-12 h-1 bg-neutral-200 dark:bg-white/10 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
