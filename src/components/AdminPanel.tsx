import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Crown, Users, MessageSquare, Shield, Ban, Trash2, RefreshCw, AlertTriangle,
  LayoutDashboard, Wallet, BarChart3, Settings, Eye,
  DollarSign, TrendingUp, TrendingDown, Activity, Lock,
  Search, Filter, Download, CheckCircle, XCircle, Clock,
  Server, Database, Terminal, PieChart, LineChart,
  Calendar, ChevronDown, ExternalLink, Save, X, LogOut,
  Mail, Key, Cpu, HardDrive, Wifi, Globe, Zap,
  Bell, Flag, UserCheck, UserX, FileText,
  Bot, Brain, Target, AlertCircle, ArrowUpRight, ArrowDownRight,
  Layers, Package, CreditCard, TrendingUp as TrendUp, AlertOctagon,
  Play, Pause, Square, RotateCcw, History, FileSpreadsheet,
  MessageCircle, ThumbsUp, ThumbsDown, EyeOff, Send, MoreVertical,
  Hash, Radio, Volume2, VolumeX, Smile, Paperclip, Reply, AtSign
} from 'lucide-react';
import { notifications } from '../services/notificationService';
import { io, Socket } from 'socket.io-client';

// ============================================
// 🎨 ADMIN BRANDING
// ============================================
const ADMIN_BRAND = {
  name: 'NEUROVEST',
  tagline: 'Admin Control Center',
  colors: {
    primary: '#3b82f6',    // blue-500
    secondary: '#06b6d4',  // cyan-500
    accent: '#8b5cf6',     // violet-500
    success: '#22c55e',    // green-500
    warning: '#f59e0b',    // amber-500
    danger: '#ef4444',     // red-500
    dark: '#0f172a',       // slate-900
    darker: '#020617'      // slate-950
  }
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';

// ============================================
// 🔐 TYPES & INTERFACES
// ============================================

type AdminRole = 'super_admin' | 'admin' | 'moderator';
type AdminTab = 'dashboard' | 'users' | 'trades' | 'economy' | 'community' | 'system' | 'analytics' | 'moderation' | 'settings' | 'ai-dashboard';

interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: AdminRole;
  displayName?: string;
}

interface UserData {
  id: string;
  username: string;
  displayName?: string;
  email: string;
  role: string;
  isOnline: boolean;
  isBanned: boolean;
  isVerified: boolean;
  createdAt: string;
  lastLogin?: string;
  stats: {
    totalTrades: number;
    winningTrades: number;
    totalProfit: number;
    totalVolume: number;
  };
  wallet?: {
    balance: number;
    available: number;
    locked: number;
  };
  followers: number;
  following: number;
  winRate: number;
}

interface TradeData {
  id: string;
  userId: string;
  username: string;
  pair: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  profit?: number;
  status: 'open' | 'closed' | 'cancelled';
  createdAt: string;
}

interface TransactionData {
  id: string;
  userId: string;
  username: string;
  type: 'deposit' | 'withdrawal' | 'trade' | 'fee';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  method?: string;
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  memoryUsed: number;
  memoryTotal: number;
  uptime: string;
  activeConnections: number;
  platform: string;
}

interface OverviewStats {
  users: {
    total: number;
    online: number;
    new24h: number;
    banned: number;
    verified: number;
  };
  trading: {
    totalTrades: number;
    totalProfit: number;
    totalVolume: number;
    winningTraders: number;
  };
  wallet: {
    totalBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    netFlow: number;
  };
}

interface AdminLog {
  id: string;
  adminEmail: string;
  adminRole: string;
  action: string;
  description: string;
  targetType?: string;
  status: 'success' | 'failed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  ipAddress: string;
}

// 💬 CHAT INTERFACES
interface ChatMessage {
  id: string;
  senderId: string;
  senderUsername: string;
  senderRole: AdminRole;
  content: string;
  type: 'text' | 'announcement' | 'alert' | 'system';
  channel: 'all_admins' | 'super_admins_only' | 'mods_only';
  replyTo?: string;
  replyToContent?: string;
  createdAt: string;
  edited?: boolean;
  deleted?: boolean;
}

interface ChatUser {
  userId: string;
  username: string;
  email: string;
  role: AdminRole;
  isOnline: boolean;
  lastActive?: string;
}

interface ReportData {
  id: string;
  reporterId: string;
  reporterUsername: string;
  targetType: 'user' | 'message' | 'post' | 'comment' | 'trade' | 'other';
  targetId: string;
  targetUserId?: string;
  targetUsername?: string;
  reason: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  evidence?: string[];
  resolvedBy?: string;
  resolution?: string;
  resolutionNote?: string;
  resolvedAt?: string;
  createdAt: string;
}

// ============================================
// 🔐 AUTH CONTEXT & HOOKS
// ============================================

// Récupérer le token admin du localStorage
const getAdminToken = () => localStorage.getItem('admin_token');
const setAdminToken = (token: string) => localStorage.setItem('admin_token', token);
const removeAdminToken = () => localStorage.removeItem('admin_token');
const getAdminUser = (): AdminUser | null => {
  const userStr = localStorage.getItem('admin_user');
  return userStr ? JSON.parse(userStr) : null;
};
const setAdminUser = (user: AdminUser) => localStorage.setItem('admin_user', JSON.stringify(user));
const removeAdminUser = () => localStorage.removeItem('admin_user');

// Headers auth pour fetch
const getAuthHeaders = () => {
  const token = getAdminToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

// ============================================
// 🔐 LOGIN COMPONENT
// ============================================

function AdminLogin({ onLogin }: { onLogin: (admin: AdminUser, token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setAdminToken(data.token);
      setAdminUser(data.admin);
      onLogin(data.admin, data.token);
      notifications.success('Connexion réussie', `Bienvenue ${data.admin.email}`);
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
      notifications.error('Erreur de connexion', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 rounded-2xl border border-gray-800 p-8 shadow-2xl">
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center">
            <Crown className="w-8 h-8 text-red-400" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-white text-center mb-2">
          Panel Admin
        </h1>
        <p className="text-gray-400 text-center mb-8">
          NEUROVEST - Accès réservé
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@neurovest.com"
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Lock className="w-5 h-5" />
            )}
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
            <p className="text-xs text-yellow-400">
              Cet accès est strictement réservé aux administrateurs. 
              Toutes les actions sont loguées et surveillées.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 📊 DASHBOARD TAB
// ============================================

function DashboardTab({ stats, onRefresh }: { stats: OverviewStats | null; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    await onRefresh();
    setTimeout(() => setLoading(false), 500);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Utilisateurs"
          value={stats?.users.total.toLocaleString() || '0'}
          subtitle={`${stats?.users.online || 0} en ligne`}
          trend={`+${stats?.users.new24h || 0} aujourd'hui`}
          icon={Users}
          color="blue"
        />
        <KPICard
          title="Volume Trading"
          value={`$${((stats?.trading.totalVolume || 0) / 1000000).toFixed(2)}M`}
          subtitle={`${stats?.trading.totalTrades.toLocaleString() || 0} trades`}
          trend={`${stats?.trading.winningTraders || 0} traders gagnants`}
          icon={TrendingUp}
          color="green"
        />
        <KPICard
          title="Balance Totale"
          value={`$${(stats?.wallet.totalBalance || 0).toLocaleString()}`}
          subtitle={`${((stats?.wallet.totalDeposits || 0) / 1000).toFixed(1)}K déposés`}
          trend={stats?.wallet.netFlow && stats.wallet.netFlow > 0 ? '+' : ''}
          icon={Wallet}
          color="purple"
        />
        <KPICard
          title="Profit Global"
          value={`$${(stats?.trading.totalProfit || 0).toLocaleString()}`}
          subtitle="PnL total"
          trend={stats?.trading.totalProfit && stats.trading.totalProfit > 0 ? '✅ Positif' : '⚠️ Négatif'}
          icon={DollarSign}
          color={stats?.trading.totalProfit && stats.trading.totalProfit > 0 ? 'green' : 'red'}
        />
      </div>

      {/* System Health & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              Activité en temps réel
            </h3>
            <button
              onClick={handleRefresh}
              className={`p-2 hover:bg-gray-800 rounded-lg transition-all ${loading ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="h-64 bg-gray-800/50 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Graphique d'activité (à implémenter)</p>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-green-400" />
            Activité récente
          </h3>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <div className="flex-1">
                  <p className="text-sm text-white">Action système #{i}</p>
                  <p className="text-xs text-gray-500">{i * 5} min ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, subtitle, trend, icon: Icon, color }: any) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500/20 to-cyan-500/20 text-blue-400',
    green: 'from-green-500/20 to-emerald-500/20 text-green-400',
    purple: 'from-purple-500/20 to-pink-500/20 text-purple-400',
    red: 'from-red-500/20 to-orange-500/20 text-red-400'
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:border-gray-700 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          <p className="text-gray-500 text-xs mt-1">{subtitle}</p>
          {trend && (
            <p className={`text-xs mt-2 ${trend.startsWith('+') ? 'text-green-400' : trend.startsWith('✅') ? 'text-green-400' : trend.startsWith('⚠️') ? 'text-yellow-400' : 'text-gray-400'}`}>
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 bg-gradient-to-br ${colors[color]} rounded-lg`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// 👥 USERS TAB
// ============================================

function UsersTab({ admin }: { admin: AdminUser }) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchUsers = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/admin/users?page=${page}&search=${search}&limit=50`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          removeAdminToken();
          window.location.reload();
          return;
        }
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (error) {
      console.error('Error fetching users:', error);
      notifications.error('Erreur', 'Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const handleBan = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir bannir/débannir cet utilisateur ?')) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: 'Violation des règles' })
      });

      if (!response.ok) throw new Error('Failed to ban user');

      const data = await response.json();
      setUsers(users.map(u => u.id === userId ? { ...u, isBanned: data.user.isBanned } : u));
      notifications.success('Succès', data.message);
    } catch (error) {
      notifications.error('Erreur', 'Action échouée');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('⚠️ SUPPRESSION DÉFINITIVE ! Êtes-vous absolument sûr ?')) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to delete user');

      setUsers(users.filter(u => u.id !== userId));
      notifications.success('Succès', 'Utilisateur supprimé');
    } catch (error) {
      notifications.error('Erreur', 'Suppression échouée');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Rechercher utilisateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button className="px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 flex items-center gap-2 text-gray-400">
          <Filter className="w-5 h-5" />
          Filtres
        </button>
        <button className="px-4 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 flex items-center gap-2 text-white">
          <Download className="w-5 h-5" />
          Exporter
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Utilisateur</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Email</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Rôle</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Trades</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Profit</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Wallet</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Statut</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-800/30">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center font-bold text-white">
                      {(user.username || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-white flex items-center gap-2">
                        {user.displayName || user.username}
                        {user.role !== 'user' && (
                          <Shield className={`w-4 h-4 ${user.role === 'super_admin' ? 'text-red-400' : 'text-blue-400'}`} />
                        )}
                      </div>
                      <div className="text-sm text-gray-500">@{user.username}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-sm text-gray-400">{user.email}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs ${
                    user.role === 'super_admin' ? 'bg-red-500/20 text-red-400' :
                    user.role === 'admin' ? 'bg-blue-500/20 text-blue-400' :
                    user.role === 'moderator' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-4 text-gray-400">{user.stats?.totalTrades || 0}</td>
                <td className={`p-4 ${(user.stats?.totalProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${(user.stats?.totalProfit || 0).toFixed(2)}
                </td>
                <td className="p-4 text-gray-400">${(user.wallet?.balance || 0).toLocaleString()}</td>
                <td className="p-4">
                  {user.isBanned ? (
                    <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">Banni</span>
                  ) : user.isOnline ? (
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">En ligne</span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">Hors ligne</span>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSelectedUser(user); setShowModal(true); }}
                      className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                      title="Voir"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleBan(user.id)}
                      className={`p-2 rounded-lg ${user.isBanned ? 'text-green-400 hover:bg-green-500/20' : 'text-yellow-400 hover:bg-yellow-500/20'}`}
                      title={user.isBanned ? 'Débannir' : 'Bannir'}
                    >
                      {user.isBanned ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-800">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
            >
              Précédent
            </button>
            <span className="text-gray-400">Page {page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {showModal && selectedUser && (
        <UserDetailModal user={selectedUser} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

function UserDetailModal({ user, onClose }: { user: UserData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-800 max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Profil utilisateur</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-3xl font-bold text-white">
              {user.username[0].toUpperCase()}
            </div>
            <div>
              <h4 className="text-xl font-bold text-white">{user.displayName || user.username}</h4>
              <p className="text-gray-400">@{user.username}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-800 rounded-lg text-center">
              <div className="text-2xl font-bold text-white">{user.stats?.totalTrades || 0}</div>
              <div className="text-xs text-gray-400">Trades</div>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg text-center">
              <div className={`text-2xl font-bold ${(user.stats?.totalProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${(user.stats?.totalProfit || 0).toFixed(0)}
              </div>
              <div className="text-xs text-gray-400">Profit</div>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg text-center">
              <div className="text-2xl font-bold text-white">{user.followers || 0}</div>
              <div className="text-xs text-gray-400">Followers</div>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg text-center">
              <div className="text-2xl font-bold text-white">${(user.wallet?.balance || 0).toLocaleString()}</div>
              <div className="text-xs text-gray-400">Balance</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 📈 TRADES TAB
// ============================================

function TradesTab({ admin }: { admin: AdminUser }) {
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrades();
  }, []);

  const fetchTrades = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/trading`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setTrades(data.activeTrades || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Trades Actifs</p>
          <p className="text-2xl font-bold text-white">{trades.filter(t => t.status === 'open').length}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Volume Aujourd'hui</p>
          <p className="text-2xl font-bold text-white">$0.00</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">PnL Global</p>
          <p className="text-2xl font-bold text-green-400">+$0.00</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Erreurs API</p>
          <p className="text-2xl font-bold text-red-400">0</p>
        </div>
      </div>

      {/* Trades Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-semibold text-white">Trades en cours</h3>
          <button onClick={fetchTrades} className="p-2 hover:bg-gray-800 rounded-lg">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Utilisateur</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Paire</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Type</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Montant</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Prix</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Profit</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {trades.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  Aucun trade actif
                </td>
              </tr>
            ) : (
              trades.map((trade) => (
                <tr key={trade.id} className="hover:bg-gray-800/30">
                  <td className="p-4 text-white">{trade.username}</td>
                  <td className="p-4 text-white">{trade.pair}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      trade.type === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {trade.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-white">{trade.amount}</td>
                  <td className="p-4 text-white">${trade.price}</td>
                  <td className={`p-4 ${(trade.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.profit ? `$${trade.profit.toFixed(2)}` : '-'}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                      {trade.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// 💰 ECONOMY TAB
// ============================================

function EconomyTab({ admin }: { admin: AdminUser }) {
  const [stats, setStats] = useState<any>(null);
  const [pending, setPending] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEconomy();
  }, []);

  const fetchEconomy = async () => {
    try {
      const [economyRes, pendingRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/economy`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/admin/economy/pending`, { headers: getAuthHeaders() })
      ]);

      if (!economyRes.ok || !pendingRes.ok) throw new Error('Failed to fetch');

      const economyData = await economyRes.json();
      const pendingData = await pendingRes.json();

      setStats(economyData.overview);
      setPending(pendingData.pending || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Balance Totale</p>
          <p className="text-2xl font-bold text-white">${(stats?.totalBalance || 0).toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Dépôts Totaux</p>
          <p className="text-2xl font-bold text-green-400">+${(stats?.totalDeposits || 0).toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Retraits Totaux</p>
          <p className="text-2xl font-bold text-red-400">-${(stats?.totalWithdrawals || 0).toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Flux Net</p>
          <p className={`text-2xl font-bold ${(stats?.netFlow || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {(stats?.netFlow || 0) >= 0 ? '+' : ''}${(stats?.netFlow || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Pending Transactions */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            Transactions en attente ({pending.length})
          </h3>
          <button onClick={fetchEconomy} className="p-2 hover:bg-gray-800 rounded-lg">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Utilisateur</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Type</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Montant</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Méthode</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Date</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {pending.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  Aucune transaction en attente
                </td>
              </tr>
            ) : (
              pending.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-800/30">
                  <td className="p-4 text-white">{tx.username}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      tx.type === 'deposit' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="p-4 text-white">${tx.amount}</td>
                  <td className="p-4 text-gray-400">{tx.method || '-'}</td>
                  <td className="p-4 text-gray-400">{new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// ⚙️ SYSTEM TAB - DONNÉES RÉELLES
// ============================================

function SystemTab({ admin }: { admin: AdminUser }) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystem();
    const interval = setInterval(fetchSystem, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchSystem = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/system`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setMetrics({
        cpu: data.cpu?.usage || 0,
        memory: data.memory?.usagePercent || 0,
        memoryUsed: data.memory?.used || 0,
        memoryTotal: data.memory?.total || 0,
        uptime: data.server?.uptime?.formatted || '0d 0h',
        activeConnections: 0,
        platform: data.os?.platform || 'unknown'
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* � System Header */}
      <div className="bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-violet-600/20 rounded-xl border border-blue-500/30 p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-xl">
            <Server className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{ADMIN_BRAND.name} Système</h2>
            <p className="text-gray-400">Bienvenue, <span className="text-blue-400 font-semibold">{admin.username || admin.email}</span> • Monitoring serveur</p>
          </div>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Cpu className="w-6 h-6 text-blue-400" />
            <h3 className="font-semibold text-white">CPU</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Usage</span>
              <span className="text-white">{metrics?.cpu.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${metrics?.cpu}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-6 h-6 text-purple-400" />
            <h3 className="font-semibold text-white">Mémoire</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Usage</span>
              <span className="text-white">{metrics?.memory.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${metrics?.memory}%` }} />
            </div>
            <p className="text-xs text-gray-500">
              {(metrics?.memoryUsed ? (metrics.memoryUsed / 1024 / 1024 / 1024).toFixed(2) : 0)} GB / 
              {(metrics?.memoryTotal ? (metrics.memoryTotal / 1024 / 1024 / 1024).toFixed(2) : 0)} GB
            </p>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Server className="w-6 h-6 text-green-400" />
            <h3 className="font-semibold text-white">Serveur</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Uptime</span>
              <span className="text-white">{metrics?.uptime}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Platform</span>
              <span className="text-white">{metrics?.platform}</span>
            </div>
          </div>
        </div>
      </div>

      {/* API Status */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-cyan-400" />
          Statut des APIs
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-white">Binance API</span>
            </div>
            <span className="text-green-400 text-sm">Opérationnel</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-white">Database (MongoDB)</span>
            </div>
            <span className="text-green-400 text-sm">Opérationnel</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-white">WebSocket Server</span>
            </div>
            <span className="text-green-400 text-sm">Opérationnel</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 📊 ANALYTICS TAB - DONNÉES RÉELLES
// ============================================

function AnalyticsTab({ admin }: { admin: AdminUser }) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/analytics?period=${period}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setAnalytics(data.analytics);
    } catch (error) {
      console.error('Error:', error);
      notifications.error('Erreur', 'Impossible de charger les analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* � Analytics Header */}
      <div className="bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-violet-600/20 rounded-xl border border-blue-500/30 p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-xl">
            <LineChart className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{ADMIN_BRAND.name} Analytics</h2>
            <p className="text-gray-400">Bienvenue, <span className="text-blue-400 font-semibold">{admin.username || admin.email}</span> • Accès {admin.role}</p>
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {['24h', '7d', '30d', '90d'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              period === p
                ? 'bg-blue-600 text-white'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
          >
            {p === '24h' ? '24 heures' : p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : '90 jours'}
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Utilisateurs Actifs</p>
          <p className="text-2xl font-bold text-white">{analytics?.users?.active || 0}</p>
          <p className="text-xs text-green-400">+{(analytics?.users?.growth || 0).toFixed(1)}%</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Volume Total</p>
          <p className="text-2xl font-bold text-white">${(analytics?.trading?.volume || 0).toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">PnL Moyen</p>
          <p className={`text-2xl font-bold ${(analytics?.trading?.avgPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${(analytics?.trading?.avgPnl || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Taux de Gain</p>
          <p className="text-2xl font-bold text-white">{(analytics?.trading?.winRate || 0).toFixed(1)}%</p>
        </div>
      </div>

      {/* Performance par Stratégie */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-400" />
          Performance par Stratégie
        </h3>
        <div className="space-y-3">
          {(analytics?.strategies || []).map((strategy: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {strategy.name[0]}
                </div>
                <div>
                  <p className="text-white font-medium">{strategy.name}</p>
                  <p className="text-xs text-gray-500">{strategy.trades} trades</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold ${strategy.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {strategy.pnl >= 0 ? '+' : ''}${strategy.pnl.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">{strategy.winRate.toFixed(1)}% win rate</p>
              </div>
            </div>
          ))}
          {(analytics?.strategies || []).length === 0 && (
            <p className="text-gray-500 text-center py-4">Aucune donnée de stratégie disponible</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// 🛡️ MODERATION TAB - DONNÉES RÉELLES
// ============================================

function ModerationTab({ admin }: { admin: AdminUser }) {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: 'pending', severity: '' });
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, [filter]);

  const fetchReports = async () => {
    try {
      const query = new URLSearchParams();
      if (filter.status) query.append('status', filter.status);
      if (filter.severity) query.append('severity', filter.severity);

      const response = await fetch(`${API_URL}/api/admin/moderation/reports?${query}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setReports(data.reports || []);
    } catch (error) {
      console.error('Error:', error);
      notifications.error('Erreur', 'Impossible de charger les signalements');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/moderation/reports/stats`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (reportId: string, resolution: string, action?: string) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/moderation/reports/${reportId}/resolve`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ resolution, action })
      });
      if (!response.ok) throw new Error('Failed to resolve');
      
      notifications.success('Résolu', 'Signalement traité avec succès');
      fetchReports();
      fetchStats();
    } catch (error) {
      notifications.error('Erreur', 'Échec du traitement');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* � Moderation Header */}
      <div className="bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-violet-600/20 rounded-xl border border-blue-500/30 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{ADMIN_BRAND.name} Modération</h2>
              <p className="text-gray-400">Bienvenue, <span className="text-blue-400 font-semibold">{admin.username || admin.email}</span> • {ADMIN_BRAND.tagline}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
              {stats?.totalPending || 0} en attente
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">En attente</p>
          <p className="text-2xl font-bold text-yellow-400">{stats?.byStatus?.pending || 0}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">En investigation</p>
          <p className="text-2xl font-bold text-blue-400">{stats?.byStatus?.investigating || 0}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Résolus</p>
          <p className="text-2xl font-bold text-green-400">{stats?.byStatus?.resolved || 0}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Critiques</p>
          <p className="text-2xl font-bold text-red-400">{stats?.bySeverity?.critical || 0}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-4">
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white"
        >
          <option value="pending">En attente</option>
          <option value="investigating">En investigation</option>
          <option value="resolved">Résolus</option>
          <option value="dismissed">Rejetés</option>
          <option value="">Tous</option>
        </select>
        <select
          value={filter.severity}
          onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
          className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white"
        >
          <option value="">Toutes gravités</option>
          <option value="critical">Critique</option>
          <option value="high">Haute</option>
          <option value="medium">Moyenne</option>
          <option value="low">Faible</option>
        </select>
        <button
          onClick={fetchReports}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Rafraîchir
        </button>
      </div>

      {/* Liste des signalements */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Signalé par</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Cible</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Raison</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Gravité</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Statut</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Date</th>
              <th className="text-left p-4 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {reports.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  Aucun signalement trouvé
                </td>
              </tr>
            ) : (
              reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-800/30">
                  <td className="p-4 text-white">{report.reporterUsername}</td>
                  <td className="p-4">
                    <span className="text-white">{report.targetUsername || report.targetType}</span>
                    <span className="text-xs text-gray-500 block">{report.targetType}</span>
                  </td>
                  <td className="p-4 text-gray-400">{report.reason}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      report.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                      report.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      report.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {report.severity}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      report.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      report.status === 'investigating' ? 'bg-blue-500/20 text-blue-400' :
                      report.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 text-sm">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      {report.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleResolve(report.id, 'warning', 'warn')}
                            className="p-2 text-yellow-400 hover:bg-yellow-500/20 rounded-lg"
                            title="Avertir"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleResolve(report.id, 'temp_ban', 'temp_ban')}
                            className="p-2 text-orange-400 hover:bg-orange-500/20 rounded-lg"
                            title="Bannir 7j"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleResolve(report.id, 'dismissed')}
                            className="p-2 text-gray-400 hover:bg-gray-500/20 rounded-lg"
                            title="Rejeter"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setSelectedReport(report)}
                        className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                        title="Détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// ⚙️ SETTINGS TAB - DONNÉES RÉELLES
// ============================================

function SettingsTab({ admin }: { admin: AdminUser }) {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/settings`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* � Settings Header */}
      <div className="bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-violet-600/20 rounded-xl border border-blue-500/30 p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-xl">
            <Settings className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{ADMIN_BRAND.name} Configuration</h2>
            <p className="text-gray-400">Bienvenue, <span className="text-blue-400 font-semibold">{admin.username || admin.email}</span> • Paramètres système</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Admin */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-400" />
            Configuration Admin
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between p-3 bg-gray-800/50 rounded-lg">
              <span className="text-gray-400">Token Expiry</span>
              <span className="text-white font-mono">{settings?.auth?.tokenExpiry}</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-800/50 rounded-lg">
              <span className="text-gray-400">Max Login Attempts</span>
              <span className="text-white font-mono">{settings?.auth?.maxLoginAttempts}</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-800/50 rounded-lg">
              <span className="text-gray-400">Lockout Minutes</span>
              <span className="text-white font-mono">{settings?.auth?.lockoutMinutes}</span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Fonctionnalités
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between p-3 bg-gray-800/50 rounded-lg">
              <span className="text-gray-400">Real Trading</span>
              <span className={settings?.features?.realTrading ? 'text-green-400' : 'text-red-400'}>
                {settings?.features?.realTrading ? 'Activé' : 'Désactivé'}
              </span>
            </div>
            <div className="flex justify-between p-3 bg-gray-800/50 rounded-lg">
              <span className="text-gray-400">Testnet</span>
              <span className={settings?.features?.testnet ? 'text-green-400' : 'text-gray-400'}>
                {settings?.features?.testnet ? 'Activé' : 'Désactivé'}
              </span>
            </div>
            <div className="flex justify-between p-3 bg-gray-800/50 rounded-lg">
              <span className="text-gray-400">Environnement</span>
              <span className="text-white font-mono uppercase">{settings?.env}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 👥 COMMUNITY TAB - DONNÉES RÉELLES
// ============================================

function CommunityTab({ admin }: { admin: AdminUser }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommunityData();
  }, []);

  const fetchCommunityData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/community`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setMessages(data.recentMessages || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* � Community Header */}
      <div className="bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-violet-600/20 rounded-xl border border-blue-500/30 p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-xl">
            <Users className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{ADMIN_BRAND.name} Communauté</h2>
            <p className="text-gray-400">Bienvenue, <span className="text-blue-400 font-semibold">{admin.username || admin.email}</span> • Gestion communautaire</p>
          </div>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Messages 24h</p>
          <p className="text-2xl font-bold text-white">0</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Nouveaux sujets</p>
          <p className="text-2xl font-bold text-white">0</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Utilisateurs actifs</p>
          <p className="text-2xl font-bold text-white">0</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Signalements</p>
          <p className="text-2xl font-bold text-yellow-400">0</p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
        <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Gestion Communautaire</h3>
        <p className="text-gray-500">Les fonctionnalités de modération communautaire seront bientôt disponibles.</p>
        <p className="text-gray-600 text-sm mt-2">Connecté en tant que {admin.email}</p>
      </div>
    </div>
  );
}

// ============================================
// 🤖 AI ADMIN DASHBOARD - INTELLIGENCE ARTIFICIELLE
// ============================================

interface AIAnalysis {
  healthScore: number;
  status: 'healthy' | 'warning' | 'critical' | 'error';
  summary: {
    keyPoints: string[];
  };
  alerts: AIAlert[];
  recommendations: AIRecommendation[];
  metrics: {
    trading: any;
    users: any;
    payments: any;
    bots: any;
    system: any;
    risk: any;
  };
}

interface AIAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  category: string;
  timestamp: string;
}

interface AIRecommendation {
  action: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  danger: boolean;
}

function AIDashboardTab({ admin }: { admin: AdminUser }) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'overview' | 'trading' | 'users' | 'payments' | 'bots' | 'system' | 'risk'>('overview');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', content: string, timestamp: Date}[]>([
    { role: 'ai', content: 'Bonjour ! Je suis votre assistant IA NEUROVEST. Je peux analyser la plateforme, détecter des problèmes et vous aider à prendre des décisions.\n\n**Commandes disponibles :**\n• "analyse plateforme" - Vue d\'ensemble\n• "problème trading" - Analyse trading\n• "état paiements" - Analyse paiements\n• "top erreurs" - Liste des erreurs\n• "score santé" - Score global', timestamp: new Date() }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAnalysis();
    fetchQuickActions();
    const interval = setInterval(fetchAnalysis, 30000); // Auto-refresh toutes les 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchAnalysis = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/ai/analyze`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setAnalysis(data.data);
    } catch (error) {
      console.error('AI Analysis error:', error);
      notifications.error('Erreur IA', 'Impossible de charger l\'analyse');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuickActions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/ai/actions`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setQuickActions(data.data.actions || []);
    } catch (error) {
      console.error('Quick actions error:', error);
    }
  };

  const sendCommand = async (command: string) => {
    if (!command.trim()) return;

    // Ajouter message utilisateur
    setChatMessages(prev => [...prev, { role: 'user', content: command, timestamp: new Date() }]);
    setChatInput('');

    try {
      const response = await fetch(`${API_URL}/api/admin/ai/command`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ command })
      });

      if (!response.ok) throw new Error('Failed to execute command');
      const data = await response.json();

      // Formater la réponse
      let aiResponse = '';
      if (data.data?.message) {
        aiResponse = data.data.message;
      } else if (data.data?.type === 'trading_analysis') {
        aiResponse = `**Analyse Trading**\n\n` +
          `• Trades 24h: ${data.data.data?.totalTrades || 0}\n` +
          `• Win Rate: ${data.data.data?.winRate || 0}%\n` +
          `• PnL: $${data.data.data?.totalPnL || 0}\n` +
          `• Erreurs: ${data.data.data?.errors || 0}\n` +
          `• Pertes anormales: ${data.data.data?.abnormalLosses || 0}`;
      } else if (data.data?.type === 'payment_analysis') {
        aiResponse = `**Analyse Paiements**\n\n` +
          `• Transactions: ${data.data.data?.totalTransactions || 0}\n` +
          `• Échoués: ${data.data.data?.failed || 0}\n` +
          `• Dépôts: $${data.data.data?.totalDeposits || 0}\n` +
          `• Retraits: $${data.data.data?.totalWithdrawals || 0}`;
      } else {
        aiResponse = JSON.stringify(data.data, null, 2);
      }

      setChatMessages(prev => [...prev, { role: 'ai', content: aiResponse, timestamp: new Date() }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'ai', content: '❌ Erreur lors de l\'exécution de la commande.', timestamp: new Date() }]);
    }
  };

  const executeQuickAction = async (actionId: string) => {
    notifications.info('Action IA', `Exécution: ${actionId}...`);
    // TODO: Implémenter les actions rapides
    setTimeout(() => {
      notifications.success('Action IA', 'Action exécutée avec succès');
    }, 1000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'from-green-500/20 to-emerald-500/20 border-green-500/30';
    if (score >= 50) return 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30';
    return 'from-red-500/20 to-orange-500/20 border-red-500/30';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'critical': return <AlertOctagon className="w-5 h-5 text-red-400" />;
      default: return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Brain className="w-12 h-12 text-blue-400 animate-pulse mx-auto mb-4" />
          <p className="text-gray-400">L'IA analyse la plateforme...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 🔷 AI Header */}
      <div className="bg-gradient-to-r from-violet-600/20 via-blue-600/20 to-cyan-600/20 rounded-xl border border-violet-500/30 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-violet-500/20 rounded-xl ring-2 ring-violet-500/30">
              <Brain className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                🤖 IA Admin
                <span className="text-sm font-normal text-violet-400 bg-violet-500/20 px-2 py-0.5 rounded-full">BETA</span>
              </h2>
              <p className="text-gray-400">Analyse intelligente et assistance décisionnelle</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all"
            >
              <Bot className="w-5 h-5" />
              Chat IA
            </button>
            <button
              onClick={fetchAnalysis}
              className="p-2 hover:bg-violet-500/20 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5 text-violet-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Score de Santé Global */}
      <div className={`bg-gradient-to-r ${getScoreBg(analysis?.healthScore || 0)} rounded-xl border p-6`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm mb-1">Score de Santé Global</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl font-bold ${getScoreColor(analysis?.healthScore || 0)}`}>
                {analysis?.healthScore || 0}
              </span>
              <span className="text-gray-500">/100</span>
            </div>
            <p className="text-gray-400 text-sm mt-2">
              Statut: <span className={`font-semibold ${getScoreColor(analysis?.healthScore || 0)}`}>
                {analysis?.status?.toUpperCase()}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm mb-1">Alertes</p>
            <div className="flex gap-3">
              <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">
                {analysis?.alerts?.filter(a => a.severity === 'critical').length || 0} Critiques
              </span>
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
                {analysis?.alerts?.filter(a => a.severity === 'warning').length || 0} Warnings
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation des Sections */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
          { id: 'trading', label: 'Trading', icon: BarChart3 },
          { id: 'users', label: 'Utilisateurs', icon: Users },
          { id: 'payments', label: 'Paiements', icon: CreditCard },
          { id: 'bots', label: 'Bots', icon: Bot },
          { id: 'system', label: 'Système', icon: Server },
          { id: 'risk', label: 'Risque', icon: Shield }
        ].map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeSection === section.id
                ? 'bg-violet-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <section.icon className="w-4 h-4" />
            {section.label}
          </button>
        ))}
      </div>

      {/* Contenu selon la section active */}
      {activeSection === 'overview' && (
        <>
          {/* Résumé Intelligent */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-violet-400" />
              Résumé Intelligent
            </h3>
            <div className="space-y-2">
              {analysis?.summary?.keyPoints?.map((point, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                  {point.includes('erreur') || point.includes('problème') ? (
                    <AlertOctagon className="w-5 h-5 text-red-400 mt-0.5" />
                  ) : point.includes('suspect') || point.includes('anomalie') ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  )}
                  <span className="text-gray-300">{point}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alertes Actives */}
          {analysis?.alerts && analysis.alerts.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-red-400" />
                Alertes Actives ({analysis.alerts.length})
              </h3>
              <div className="space-y-3">
                {analysis.alerts.map(alert => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border ${
                      alert.severity === 'critical'
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-yellow-500/10 border-yellow-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {alert.severity === 'critical' ? (
                        <AlertOctagon className="w-5 h-5 text-red-400" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-white">{alert.title}</h4>
                        <p className="text-gray-400 text-sm mt-1">{alert.message}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="px-2 py-0.5 bg-gray-700 rounded">
                            {alert.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommandations */}
          {analysis?.recommendations && analysis.recommendations.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-yellow-400" />
                Recommandations IA ({analysis.recommendations.length})
              </h3>
              <div className="space-y-3">
                {analysis.recommendations.map((rec, idx) => (
                  <div key={idx} className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="p-1 bg-violet-500/20 rounded">
                        <ArrowUpRight className="w-4 h-4 text-violet-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{rec.title}</h4>
                        <p className="text-gray-400 text-sm mt-1">{rec.description}</p>
                        <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${
                          rec.priority === 'high'
                            ? 'bg-red-500/20 text-red-400'
                            : rec.priority === 'medium'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          Priorité: {rec.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions Rapides */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
              <Play className="w-5 h-5 text-blue-400" />
              Actions Rapides IA
            </h3>
            <div className="flex flex-wrap gap-3">
              {quickActions.map(action => (
                <button
                  key={action.id}
                  onClick={() => executeQuickAction(action.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    action.danger
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {action.icon === 'pause' && <Pause className="w-4 h-4" />}
                  {action.icon === 'refresh' && <RefreshCw className="w-4 h-4" />}
                  {action.icon === 'trash' && <Trash2 className="w-4 h-4" />}
                  {action.icon === 'bell' && <Bell className="w-4 h-4" />}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Section Trading */}
      {activeSection === 'trading' && analysis?.metrics?.trading && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Analyse Trading (24h)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-sm">Trades</p>
              <p className="text-2xl font-bold text-white">{analysis.metrics.trading.totalTrades}</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-sm">Win Rate</p>
              <p className="text-2xl font-bold text-white">{analysis.metrics.trading.winRate}%</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-sm">PnL Total</p>
              <p className={`text-2xl font-bold ${parseFloat(analysis.metrics.trading.totalPnL) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${analysis.metrics.trading.totalPnL}
              </p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-sm">Erreurs</p>
              <p className={`text-2xl font-bold ${analysis.metrics.trading.errors > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {analysis.metrics.trading.errors}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Section Users */}
      {activeSection === 'users' && analysis?.metrics?.users && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-cyan-400" />
            Analyse Utilisateurs
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-sm">Total</p>
              <p className="text-2xl font-bold text-white">{analysis.metrics.users.totalUsers}</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-sm">Nouveaux (24h)</p>
              <p className="text-2xl font-bold text-white">{analysis.metrics.users.newUsers24h}</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-sm">Suspects</p>
              <p className={`text-2xl font-bold ${analysis.metrics.users.suspiciousUsers > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {analysis.metrics.users.suspiciousUsers}
              </p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-sm">Bannis (7j)</p>
              <p className="text-2xl font-bold text-white">{analysis.metrics.users.bannedUsers7d}</p>
            </div>
          </div>
        </div>
      )}

      {/* Chat IA Slide-over */}
      {chatOpen && (
        <div className="fixed inset-y-0 right-0 w-[450px] bg-slate-900/95 backdrop-blur-xl border-l border-violet-500/30 shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-violet-600/20 to-blue-600/20 border-b border-violet-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/20 rounded-xl ring-1 ring-violet-500/30">
                <Bot className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Assistant IA</h3>
                <p className="text-xs text-violet-400">Analyse & Décisions</p>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="p-1.5 hover:bg-violet-500/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400 hover:text-violet-400" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] p-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-md'
                    : 'bg-slate-800 text-white rounded-bl-md border border-slate-700'
                }`}>
                  {msg.role === 'ai' && (
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="w-4 h-4 text-violet-400" />
                      <span className="text-xs font-semibold text-violet-400">IA NEUROVEST</span>
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  <p className="text-[10px] opacity-70 mt-1">
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-violet-500/20 bg-slate-900">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendCommand(chatInput)}
                placeholder="Commande: analyse plateforme, problème trading..."
                className="flex-1 bg-slate-800 text-white rounded-lg px-4 py-2 border border-slate-700 focus:border-violet-500 focus:outline-none text-sm"
              />
              <button
                onClick={() => sendCommand(chatInput)}
                className="p-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {['analyse plateforme', 'problème trading', 'état paiements', 'score santé'].map(cmd => (
                <button
                  key={cmd}
                  onClick={() => sendCommand(cmd)}
                  className="text-xs px-2 py-1 bg-slate-800 text-slate-400 rounded hover:bg-violet-500/20 hover:text-violet-400 transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 💬 CHAT SYSTEM - TEMPS RÉEL
// ============================================

function ChatSystem({ admin, socket }: { admin: AdminUser; socket: Socket | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [channel, setChannel] = useState<'all_admins' | 'super_admins_only' | 'mods_only'>('all_admins');
  const [unreadCount, setUnreadCount] = useState(0);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    fetchUnreadCount();
    fetchUsers();

    // Socket.IO listeners
    if (socket) {
      socket.on('new-chat-message', handleSocketMessage);
      socket.on('chat-typing', handleTypingEvent);
      socket.on('message-read', handleMessageRead);
    }

    const interval = setInterval(fetchUnreadCount, 30000);
    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('new-chat-message', handleSocketMessage);
        socket.off('chat-typing', handleTypingEvent);
        socket.off('message-read', handleMessageRead);
      }
    };
  }, [socket, channel]);

  const handleSocketMessage = (data: any) => {
    if (data.message?.channel === channel) {
      setMessages(prev => [...prev, data.message]);
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }
    }
  };

  const handleTypingEvent = (data: any) => {
    if (data.isTyping) {
      setTypingUsers(prev => [...new Set([...prev, data.username])]);
    } else {
      setTypingUsers(prev => prev.filter(u => u !== data.username));
    }
  };

  const handleMessageRead = (data: any) => {
    // Mettre à jour le statut de lecture
    console.log('Message read:', data);
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/chat/messages?channel=${channel}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/chat/unread`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setUnreadCount(data.total || 0);
    } catch (error) {
      console.error('Error fetching unread:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/chat/users`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    // Envoyer via Socket.IO si disponible
    if (socket && socket.connected) {
      socket.emit('chat-message', {
        content: input,
        channel,
        type: 'text'
      }, (response: any) => {
        if (response?.error) {
          notifications.error('Erreur', response.error);
        }
      });
    } else {
      // Fallback HTTP
      try {
        const response = await fetch(`${API_URL}/api/admin/chat/messages`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ content: input, channel })
        });
        if (!response.ok) throw new Error('Failed to send');
        const data = await response.json();
        setMessages(prev => [...prev, data.message]);
      } catch (error) {
        notifications.error('Erreur', 'Impossible d\'envoyer le message');
        return;
      }
    }

    setInput('');
    setIsTyping(false);
  };

  const handleTyping = (value: string) => {
    setInput(value);
    
    if (socket && socket.connected) {
      socket.emit('typing', {
        channel,
        isTyping: value.length > 0
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnreadCount(0);
    }
  }, [messages, isOpen]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'text-red-400 bg-red-500/20';
      case 'admin': return 'text-blue-400 bg-blue-500/20';
      case 'moderator': return 'text-purple-400 bg-purple-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getChannelName = (ch: string) => {
    switch (ch) {
      case 'super_admins_only': return '🔒 Super Admins';
      case 'mods_only': return '🛡️ Modérateurs';
      default: return '💬 Tous les Admins';
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-full shadow-2xl shadow-blue-500/30 transition-all hover:scale-110"
      >
        <MessageSquare className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[420px] h-[550px] bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-blue-500/30 shadow-2xl shadow-blue-500/20 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-blue-600/20 border-b border-blue-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl ring-1 ring-blue-500/30">
                <Radio className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{ADMIN_BRAND.name} Chat</h3>
                <p className="text-xs text-cyan-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                  {getChannelName(channel)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as any)}
                className="text-xs bg-gray-800 text-white rounded px-2 py-1 border border-gray-700"
              >
                <option value="all_admins">Tous</option>
                {admin.role === 'super_admin' && (
                  <option value="super_admins_only">Super Admins</option>
                )}
                <option value="mods_only">Modos</option>
              </select>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-blue-500/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-blue-400" />
              </button>
            </div>
          </div>

          {/* Users Online */}
          <div className="px-4 py-2 bg-slate-800/50 border-b border-blue-500/10">
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs text-gray-500">En ligne:</span>
              {users.filter(u => u.isOnline).map(user => (
                <div
                  key={user.userId}
                  className={`px-2 py-0.5 rounded-full text-xs ${getRoleColor(user.role)}`}
                  title={user.email}
                >
                  {user.username || user.email.split('@')[0]}
                </div>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 ring-2 ring-blue-500/20">
                  <MessageSquare className="w-8 h-8 text-blue-400" />
                </div>
                <p className="text-gray-400 text-sm">Aucun message</p>
                <p className="text-gray-500 text-xs mt-2">Commencez la conversation !</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex flex-col ${
                    msg.senderId === admin.id ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className={`max-w-[85%] p-3.5 rounded-2xl ${
                    msg.senderId === admin.id
                      ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-br-md shadow-lg shadow-blue-500/20'
                      : 'bg-slate-800 text-white rounded-bl-md border border-slate-700'
                  }`}>
                    {msg.senderId !== admin.id && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-blue-400">
                          {msg.senderUsername?.split('@')[0]}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${getRoleColor(msg.senderRole)}`}>
                          {msg.senderRole}
                        </span>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    <p className="text-[10px] opacity-70 mt-1.5">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
            
            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>{typingUsers.join(', ')} écrit...</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-gray-800/50 border-t border-gray-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => handleTyping(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Écrivez un message..."
                className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// 🏠 MAIN ADMIN PANEL
// ============================================

export default function AdminPanel() {
  const [admin, setAdmin] = useState<AdminUser | null>(getAdminUser);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Vérifier auth au chargement
  useEffect(() => {
    const token = getAdminToken();
    const user = getAdminUser();
    if (token && user) {
      setAdmin(user);
    }
  }, []);

  // Charger les données overview
  const fetchOverview = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/overview`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleLogout();
          return;
        }
        throw new Error('Failed to fetch overview');
      }

      const data = await response.json();
      setOverview(data);
    } catch (error) {
      console.error('Error fetching overview:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) {
      fetchOverview();
    }
  }, [admin, fetchOverview]);

  // Socket.IO connection (Admin namespace)
  useEffect(() => {
    if (!admin) return;

    const token = getAdminToken();
    if (!token) return;

    // Connecter au namespace /admin avec authentification
    const socketConnection = io(`${WS_URL}/admin`, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketConnection.on('connect', () => {
      console.log('✅ Admin Socket.IO connected');
      setSocket(socketConnection);
      
      // S'abonner aux canaux par défaut
      socketConnection.emit('join-channel', { channel: 'all_admins' });
    });

    socketConnection.on('connection', (data) => {
      console.log('[Admin Socket] Connected:', data);
    });

    socketConnection.on('new-chat-message', (data) => {
      console.log('[Admin Socket] New chat message:', data);
    });

    socketConnection.on('admin-event', (data) => {
      console.log('[Admin Socket] Event:', data);
      if (data.type === 'new_trade' || data.type === 'new_transaction' || data.type === 'new_user') {
        fetchOverview();
      }
    });

    socketConnection.on('new-report', (data) => {
      console.log('[Admin Socket] New report:', data);
      notifications.info('Nouveau signalement', 'Un utilisateur a été signalé');
    });

    socketConnection.on('connect_error', (error) => {
      console.error('[Admin Socket] Error:', error);
    });

    socketConnection.on('disconnect', () => {
      console.log('📡 Admin Socket.IO disconnected');
    });

    return () => {
      socketConnection.disconnect();
    };
  }, [admin, fetchOverview]);

  const handleLogin = (newAdmin: AdminUser, token: string) => {
    setAdmin(newAdmin);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/admin/logout`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    removeAdminToken();
    removeAdminUser();
    setAdmin(null);
    socket?.disconnect();
    notifications.success('Déconnexion', 'Vous êtes déconnecté');
  };

  // Si pas connecté, afficher login
  if (!admin) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  const tabs: { id: AdminTab; label: string; icon: any; roles: AdminRole[] }[] = [
    { id: 'ai-dashboard', label: '🤖 IA Admin', icon: Brain, roles: ['super_admin', 'admin'] },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'moderator'] },
    { id: 'users', label: 'Utilisateurs', icon: Users, roles: ['super_admin', 'admin', 'moderator'] },
    { id: 'trades', label: 'Trades', icon: BarChart3, roles: ['super_admin', 'admin'] },
    { id: 'economy', label: 'Économie', icon: Wallet, roles: ['super_admin', 'admin'] },
    { id: 'community', label: 'Communauté', icon: MessageSquare, roles: ['super_admin', 'admin', 'moderator'] },
    { id: 'system', label: 'Système', icon: Server, roles: ['super_admin'] },
    { id: 'analytics', label: 'Analytics', icon: LineChart, roles: ['super_admin', 'admin'] },
    { id: 'moderation', label: 'Modération', icon: Shield, roles: ['super_admin', 'admin', 'moderator'] },
    { id: 'settings', label: 'Paramètres', icon: Settings, roles: ['super_admin'] },
  ];

  // Filtrer les tabs selon le rôle
  const availableTabs = tabs.filter(tab => tab.roles.includes(admin.role));

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl">
              <Crown className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-gray-400 text-sm">NEUROVEST • {admin.email} • {admin.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchOverview}
              className="p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all"
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Système OK
            </div>
            <button
              onClick={handleLogout}
              className="p-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all"
              title="Déconnexion"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-gray-900 border-r border-gray-800 min-h-[calc(100vh-80px)] p-4">
          <nav className="space-y-1">
            {availableTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Quick Stats */}
          <div className="mt-8 pt-8 border-t border-gray-800">
            <div className="text-xs text-gray-500 uppercase font-semibold mb-4">En direct</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Utilisateurs</span>
                <span className="font-bold text-white">{overview?.users.online || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Balance Totale</span>
                <span className="font-bold text-green-400">
                  ${((overview?.wallet.totalBalance || 0) / 1000).toFixed(1)}K
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-auto relative">
          {activeTab === 'ai-dashboard' && <AIDashboardTab admin={admin} />}
          {activeTab === 'dashboard' && <DashboardTab stats={overview} onRefresh={fetchOverview} />}
          {activeTab === 'users' && <UsersTab admin={admin} />}
          {activeTab === 'trades' && <TradesTab admin={admin} />}
          {activeTab === 'economy' && <EconomyTab admin={admin} />}
          {activeTab === 'system' && <SystemTab admin={admin} />}
          {activeTab === 'analytics' && <AnalyticsTab admin={admin} />}
          {activeTab === 'moderation' && <ModerationTab admin={admin} />}
          {activeTab === 'settings' && <SettingsTab admin={admin} />}
          {activeTab === 'community' && <CommunityTab admin={admin} />}
          
          {/* 💬 Chat System - Visible sur toutes les pages admin */}
          <ChatSystem admin={admin} socket={socket} />
        </div>
      </div>
    </div>
  );
}
