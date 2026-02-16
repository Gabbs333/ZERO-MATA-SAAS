import { useState, FormEvent } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, LogIn, Mail, Lock } from 'lucide-react';
import logoFull from '../assets/logo.png';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 p-4 transition-colors relative overflow-hidden font-body">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-semantic-purple/5 rounded-full blur-3xl translate-y-1/2"></div>
      </div>

      <div className="relative z-10 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 max-w-md w-full transition-all group hover:shadow-[0_0_40px_rgba(0,0,0,0.1)]">
        <div className="flex justify-center mb-6">
          <img src={logoFull} alt="ZERO-MATA" className="h-24 w-auto object-contain group-hover:scale-105 transition-transform duration-300" />
        </div>
        
        <p className="text-center text-neutral-500 dark:text-neutral-400 mb-8 font-medium">
          Comptoir - Gestion de Snack-Bar
        </p>

        {error && (
          <div className="bg-semantic-red/10 backdrop-blur-sm text-semantic-red p-4 rounded-xl mb-6 text-sm flex items-center gap-3 border border-semantic-red/20 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="group/input">
            <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1.5 ml-1">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <Mail className="h-5 w-5 text-neutral-400 group-focus-within/input:text-primary transition-colors" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full pl-11 pr-4 py-3 bg-white/50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-white/20 focus:border-primary dark:focus:border-white transition-all text-neutral-900 dark:text-white placeholder-neutral-400 group-focus-within/input:bg-white dark:group-focus-within/input:bg-neutral-800"
                placeholder="votre@email.com"
              />
            </div>
          </div>

          <div className="group/input">
            <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1.5 ml-1">
              Mot de passe
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <Lock className="h-5 w-5 text-neutral-400 group-focus-within/input:text-primary transition-colors" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 bg-white/50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-white/20 focus:border-primary dark:focus:border-white transition-all text-neutral-900 dark:text-white placeholder-neutral-400 group-focus-within/input:bg-white dark:group-focus-within/input:bg-neutral-800"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-primary to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Connexion...
              </>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-neutral-400 dark:text-neutral-500 font-medium">
          Accès réservé au personnel du comptoir
        </p>
      </div>
    </div>
  );
}
