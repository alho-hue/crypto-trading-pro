import { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  avatar?: string;
  createdAt: number;
  stats: {
    totalTrades: number;
    winningTrades: number;
    totalProfit: number;
    followers: number;
    following: number;
  };
  isPublic: boolean;
  allowCopyTrading: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          username: formData.username,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur serveur');
      }

      // Save token and user
      localStorage.setItem('token', data.token);
      localStorage.setItem('current_user', JSON.stringify(data.user));
      
      onAuthSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    console.log(`Login avec ${provider}`);
    // TODO: Implémenter OAuth
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="crypto-card w-full max-w-md relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-full hover:bg-crypto-dark/50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">
            {isLogin ? 'Connexion' : 'Inscription'}
          </h2>
          <p className="text-gray-400 text-sm">
            {isLogin 
              ? 'Connectez-vous pour rejoindre la communauté' 
              : 'Créez un compte pour commencer'}
          </p>
        </div>


        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nom d'utilisateur</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-crypto-dark border border-crypto-border rounded-lg focus:border-crypto-blue focus:outline-none"
                  placeholder="trader_pro"
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-crypto-dark border border-crypto-border rounded-lg focus:border-crypto-blue focus:outline-none"
                placeholder="vous@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-10 pr-12 py-3 bg-crypto-dark border border-crypto-border rounded-lg focus:border-crypto-blue focus:outline-none"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-crypto-red/10 border border-crypto-red/30 rounded-lg text-crypto-red text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-crypto-blue hover:bg-crypto-blue/80 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Chargement...' : isLogin ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>

        {/* Toggle */}
        <p className="mt-6 text-center text-sm text-gray-400">
          {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-crypto-blue hover:underline"
          >
            {isLogin ? "S'inscrire" : 'Se connecter'}
          </button>
        </p>
      </div>
    </div>
  );
}
