import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Lock, Mail, LogIn, AlertCircle } from 'lucide-react';
import logoFull from '../assets/logo.png';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-dark-bg transition-colors duration-500 p-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 dark:bg-dark-accent/5 rounded-full blur-[120px] -z-10"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 dark:bg-dark-accent/5 rounded-full blur-[120px] -z-10"></div>

      <div className="w-full max-w-md bg-white dark:bg-dark-card/40 dark:backdrop-blur-xl rounded-3xl shadow-2xl shadow-neutral-200/50 dark:shadow-none border border-neutral-200 dark:border-white/5 p-8 md:p-10 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <img src={logoFull} alt="ZERO-MATA" className="h-24 w-auto object-contain" />
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-[0.2em] text-[10px]">Tableau de Bord Patron</p>
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm mb-8 border border-red-500/20 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">
              Email
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-neutral-400 group-focus-within:text-primary dark:group-focus-within:text-dark-accent transition-colors" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-neutral-100/50 dark:bg-dark-card/60 border border-transparent dark:border-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-dark-accent/20 focus:border-primary dark:focus:border-dark-accent text-primary dark:text-white transition-all duration-300"
                placeholder="nom@exemple.com"
                required
                autoFocus
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">
              Mot de passe
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-neutral-400 group-focus-within:text-primary dark:group-focus-within:text-dark-accent transition-colors" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-neutral-100/50 dark:bg-dark-card/60 border border-transparent dark:border-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-dark-accent/20 focus:border-primary dark:focus:border-dark-accent text-primary dark:text-white transition-all duration-300"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary dark:bg-dark-accent text-white rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-8 flex items-center justify-center gap-3 shadow-lg shadow-primary/20 dark:shadow-dark-accent/20"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Connexion...</span>
              </div>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Se connecter</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-10 flex flex-col items-center gap-4">
           <div className="h-px w-full bg-gradient-to-r from-transparent via-neutral-200 dark:via-white/5 to-transparent"></div>
           <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-[0.2em] text-center">
              Accès Gérant & Propriétaire
           </p>
        </div>
      </div>
    </div>
  );
}
