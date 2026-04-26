import { useState, useEffect, useRef } from 'react';
import { 
  User, Mail, Phone, MapPin, Calendar, Shield, Bell, 
  Wallet, History, Terminal, Key, Edit2, Camera, Save,
  X, Check, AlertTriangle, ExternalLink, Lock, Unlock,
  Eye, EyeOff, RefreshCw, Loader2, ArrowRight, LogOut,
  Smartphone, QrCode, Copy, CheckCircle, AlertCircle,
  Download, Upload, ArrowLeftRight, BarChart3, Landmark,
  FileText, KeyRound, UserCircle
} from 'lucide-react';
import { showToast } from '../stores/toastStore';
import { formatXOF } from '../utils/currency';

// Services réels
import {
  initializeWallet,
  depositMobileMoney,
  withdrawMobileMoney,
  convertWalletCurrency,
  type WalletState,
  type WalletTransaction
} from '../services/walletRealService';

import {
  enable2FA,
  disable2FA,
  verify2FACode
} from '../services/securityService';

import {
  testAuthenticatedConnection
} from '../services/binanceApi';
import { saveEncryptedKey, clearEncryptedKey } from '../utils/crypto';

// Sauvegarde clés API Binance
const saveBinanceKeys = async (apiKey: string, secretKey: string) => {
  const token = localStorage.getItem('token');
  
  // Chiffrer les clés côté client avant envoi
  const encryptedApiKey = saveEncryptedKey('binance_api_key', apiKey);
  const encryptedSecretKey = saveEncryptedKey('binance_secret_key', secretKey);
  
  const res = await fetch(`${API_URL}/api/binance/keys`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      encryptedApiKey,
      encryptedSecretKey
    })
  });
  return res.ok ? { success: true } : { success: false, message: 'Erreur sauvegarde clés' };
};

import type { MobileMoneyProvider } from '../services/mobileMoneyService';

// Fonctions API directes
const changePassword = async (current: string, newPass: string) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/auth/password`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: current, newPassword: newPass })
  });
  return res.ok ? { success: true } : { success: false, message: 'Erreur changement mot de passe' };
};

const getUserSessions = async () => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/auth/sessions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.ok ? res.json() : { sessions: [] };
};

const revokeSession = async (sessionId: string) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/auth/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return { success: res.ok };
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Types
interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  email: string;
  bio?: string;
  phone?: string;
  location?: string;
  avatar?: string;
  twoFactorEnabled: boolean;
  createdAt: string;
}

interface ActivityItem {
  id: string;
  type: 'trade' | 'login' | 'deposit' | 'withdrawal' | 'settings' | 'security' | 'transfer';
  description: string;
  createdAt: string;
  amount?: number;
  currency?: string;
  status?: 'completed' | 'pending' | 'failed';
}

interface ConnectedDevice {
  id: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  lastActive: string;
  current: boolean;
}

interface NotificationSettings {
  trades: boolean;
  alerts: boolean;
  signals: boolean;
  marketing: boolean;
  security: boolean;
}

const MALI_OPERATORS: { id: MobileMoneyProvider; name: string; color: string }[] = [
  { id: 'Orange', name: 'Orange Money', color: '#FF7900' },
  { id: 'MTN', name: 'MTN Mobile Money', color: '#FFCC00' },
  { id: 'Wave', name: 'Wave', color: '#0066CC' }
];

export default function UserProfile() {
  // États
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [saving, setSaving] = useState(false);
  
  // Wallet
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [walletTab, setWalletTab] = useState<'deposit' | 'withdraw' | 'convert'>('deposit');
  const [depositForm, setDepositForm] = useState({ amount: '', phone: '', provider: 'Orange' as MobileMoneyProvider });
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', phone: '', provider: 'Orange' as MobileMoneyProvider });
  const [convertForm, setConvertForm] = useState({ from: 'USDT', to: 'BTC', amount: '' });
  const [processingTx, setProcessingTx] = useState(false);
  
  // Profil
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', bio: '', phone: '', location: '' });
  
  // Sécurité
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFASetup, setTwoFASetup] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFAQRCode, setTwoFAQRCode] = useState('');
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  
  // API Binance
  const [binanceKeys, setBinanceKeys] = useState({ apiKey: '', secretKey: '' });
  const [binanceConnected, setBinanceConnected] = useState(false);
  const [testingBinance, setTestingBinance] = useState(false);
  
  // Appareils et activité
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityItem[]>([]);
  
  // Notifications
  const [notifications, setNotifications] = useState<NotificationSettings>({ 
    trades: true, alerts: true, signals: true, marketing: false, security: true 
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: User },
    { id: 'wallet', label: 'Portefeuille', icon: Wallet },
    { id: 'security', label: 'Sécurité', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'activity', label: 'Activité', icon: History },
    { id: 'api', label: 'API Binance', icon: Terminal }
  ];

  // Chargement initial
  useEffect(() => {
    loadUserData();
    loadWalletData();
    
    refreshInterval.current = setInterval(() => {
      loadWalletData();
    }, 30000);
    
    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
    };
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  // Chargement données utilisateur
  const loadUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showToast.error('Veuillez vous connecter', 'Erreur');
        return;
      }
      
      // Profil
      const res = await fetch(`${API_URL}/api/auth/me`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (!res.ok) throw new Error('Erreur chargement profil');
      
      const data = await res.json();
      setUser(data.user);
      setTwoFAEnabled(data.user.twoFactorEnabled || false);
      setEditForm({
        name: data.user.displayName || data.user.username || '',
        email: data.user.email || '',
        bio: data.user.bio || '',
        phone: data.user.phone || '+223',
        location: data.user.location || 'Bamako, Mali'
      });
      
      // Appareils connectés
      const sessionsRes = await fetch(`${API_URL}/api/auth/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setDevices(sessionsData.sessions || []);
      }
      
      // Activité récente
      const activityRes = await fetch(`${API_URL}/api/activity/recent?limit=20`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivityLogs(activityData.activities || []);
      }
      
      // Test connexion Binance
      try {
        const testResult = await testAuthenticatedConnection();
        setBinanceConnected(testResult.success);
      } catch {
        setBinanceConnected(false);
      }
      
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
      showToast.error('Erreur de connexion au serveur', 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  // Chargement wallet
  const loadWalletData = async () => {
    try {
      const walletResult = await initializeWallet();
      if (walletResult.success && walletResult.state) {
        setWalletState(walletResult.state);
      }
    } catch (error) {
      console.error('Erreur chargement wallet:', error);
    }
  };

  // Sauvegarde profil
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Mapper les champs frontend vers les champs backend
      const profileData = {
        displayName: editForm.name,
        email: editForm.email,
        bio: editForm.bio,
        phone: editForm.phone,
        location: editForm.location
      };

      const res = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      });

      if (!res.ok) throw new Error('Erreur sauvegarde');

      const data = await res.json();

      // Mettre à jour localStorage pour synchroniser avec Layout.tsx
      const currentUserStr = localStorage.getItem('current_user');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        currentUser.displayName = data.user.displayName;
        currentUser.email = data.user.email;
        currentUser.bio = data.user.bio;
        localStorage.setItem('current_user', JSON.stringify(currentUser));
        // Dispatcher un événement pour notifier Layout.tsx du changement
        window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: currentUser }));
      }

      showToast.success('Profil mis à jour', 'Succès');
      setEditing(false);
      loadUserData();
    } catch (error) {
      showToast.error('Erreur lors de la sauvegarde', 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  // Dépôt Mobile Money
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(depositForm.amount);
    if (!amount || amount <= 0) {
      showToast.error('Montant invalide', 'Erreur');
      return;
    }
    if (!depositForm.phone) {
      showToast.error('Numéro de téléphone requis', 'Erreur');
      return;
    }
    
    setProcessingTx(true);
    
    try {
      const result = await depositMobileMoney(amount, depositForm.phone, depositForm.provider);
      
      if (result.success) {
        showToast.success(`Dépôt de ${formatXOF(amount)} initié`, 'Succès');
        setDepositForm({ amount: '', phone: '', provider: 'Orange' });
        loadWalletData();
      } else {
        showToast.error(result.message || 'Erreur dépôt', 'Erreur');
      }
    } catch (error) {
      showToast.error('Erreur lors du dépôt', 'Erreur');
    } finally {
      setProcessingTx(false);
    }
  };

  // Retrait Mobile Money
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(withdrawForm.amount);
    if (!amount || amount <= 0) {
      showToast.error('Montant invalide', 'Erreur');
      return;
    }
    if (!withdrawForm.phone) {
      showToast.error('Numéro de téléphone requis', 'Erreur');
      return;
    }
    
    const balance = walletState?.totalXOF || 0;
    if (amount > balance) {
      showToast.error('Solde insuffisant', 'Erreur');
      return;
    }
    
    setProcessingTx(true);
    
    try {
      const result = await withdrawMobileMoney(amount, withdrawForm.phone, withdrawForm.provider);
      
      if (result.success) {
        showToast.success(`Retrait de ${formatXOF(amount)} initié`, 'Succès');
        setWithdrawForm({ amount: '', phone: '', provider: 'Orange' });
        loadWalletData();
      } else {
        showToast.error(result.message || 'Erreur retrait', 'Erreur');
      }
    } catch (error) {
      showToast.error('Erreur lors du retrait', 'Erreur');
    } finally {
      setProcessingTx(false);
    }
  };

  // Conversion
  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(convertForm.amount);
    if (!amount || amount <= 0) {
      showToast.error('Montant invalide', 'Erreur');
      return;
    }
    
    setProcessingTx(true);
    
    try {
      const result = await convertWalletCurrency(convertForm.from, convertForm.to, amount);
      
      if (result.success) {
        showToast.success(`Conversion ${convertForm.from} → ${convertForm.to} effectuée`, 'Succès');
        setConvertForm({ from: 'USDT', to: 'BTC', amount: '' });
        loadWalletData();
      } else {
        showToast.error(result.message || 'Erreur conversion', 'Erreur');
      }
    } catch (error) {
      showToast.error('Erreur lors de la conversion', 'Erreur');
    } finally {
      setProcessingTx(false);
    }
  };

  // Changement mot de passe
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.new !== passwordForm.confirm) {
      showToast.error('Les mots de passe ne correspondent pas', 'Erreur');
      return;
    }
    if (passwordForm.new.length < 8) {
      showToast.error('Mot de passe trop court (8 caractères minimum)', 'Erreur');
      return;
    }
    
    setSaving(true);
    
    try {
      const result = await changePassword(passwordForm.current, passwordForm.new);
      
      if (result.success) {
        showToast.success('Mot de passe changé avec succès', 'Succès');
        setPasswordForm({ current: '', new: '', confirm: '' });
      } else {
        showToast.error(result.message || 'Erreur changement mot de passe', 'Erreur');
      }
    } catch (error) {
      showToast.error('Erreur lors du changement de mot de passe', 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  // Activation 2FA
  const handleEnable2FA = async () => {
    try {
      const result = await enable2FA();
      
      if (result.success && result.secret && result.qrCode) {
        setTwoFASecret(result.secret);
        setTwoFAQRCode(result.qrCode);
        setTwoFASetup(true);
        showToast.success('Code 2FA généré, entrez-le pour activer', 'Sécurité');
      } else {
        showToast.error(result.message || 'Erreur génération 2FA', 'Erreur');
      }
    } catch (error) {
      showToast.error('Erreur activation 2FA', 'Erreur');
    }
  };

  // Vérification 2FA
  const handleVerify2FA = async () => {
    if (!twoFACode || twoFACode.length !== 6) {
      showToast.error('Code 2FA requis (6 chiffres)', 'Erreur');
      return;
    }
    if (!user?.id) {
      showToast.error('ID utilisateur manquant', 'Erreur');
      return;
    }
    
    try {
      const result = await verify2FACode(user.id, twoFACode);
      
      if (result.success) {
        setTwoFAEnabled(true);
        setTwoFASetup(false);
        setTwoFACode('');
        showToast.success('2FA activé avec succès', 'Sécurité');
      } else {
        showToast.error(result.message || 'Code invalide', 'Erreur');
      }
    } catch (error) {
      showToast.error('Erreur vérification 2FA', 'Erreur');
    }
  };

  // Désactivation 2FA
  const handleDisable2FA = async () => {
    if (!twoFACode || twoFACode.length !== 6) {
      showToast.error('Code 2FA requis', 'Erreur');
      return;
    }
    
    try {
      const result = await disable2FA(twoFACode);
      
      if (result.success) {
        setTwoFAEnabled(false);
        setTwoFACode('');
        showToast.success('2FA désactivé', 'Sécurité');
      } else {
        showToast.error(result.message || 'Code invalide', 'Erreur');
      }
    } catch (error) {
      showToast.error('Erreur désactivation 2FA', 'Erreur');
    }
  };

  // Sauvegarde clés API Binance
  const handleSaveBinanceKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!binanceKeys.apiKey || !binanceKeys.secretKey) {
      showToast.error('Clés API requises', 'Erreur');
      return;
    }
    
    setSaving(true);
    
    try {
      const result = await saveBinanceKeys(binanceKeys.apiKey, binanceKeys.secretKey);
      
      if (result.success) {
        showToast.success('Clés API Binance sauvegardées', 'Succès');
        // NE PAS effacer les clés - elles restent dans localStorage chiffrées
        setBinanceKeys({ apiKey: '', secretKey: '' });
        testBinanceConnection();
      } else {
        showToast.error(result.message || 'Erreur sauvegarde', 'Erreur');
      }
    } catch (error) {
      showToast.error('Erreur lors de la sauvegarde des clés', 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  // Test connexion Binance
  const testBinanceConnection = async () => {
    setTestingBinance(true);
    
    try {
      const result = await testAuthenticatedConnection();
      setBinanceConnected(result.success);
      
      if (result.success) {
        showToast.success('Connexion Binance réussie', 'Succès');
      } else {
        showToast.error('Connexion Binance échouée', 'Erreur');
      }
    } catch (error) {
      setBinanceConnected(false);
      showToast.error('Erreur test connexion Binance', 'Erreur');
    } finally {
      setTestingBinance(false);
    }
  };

  // Révocation session
  const handleRevokeSession = async (sessionId: string) => {
    try {
      const result = await revokeSession(sessionId);
      
      if (result.success) {
        showToast.success('Session révoquée', 'Succès');
        loadUserData();
      } else {
        showToast.error('Erreur révocation', 'Erreur');
      }
    } catch (error) {
      showToast.error('Erreur lors de la révocation', 'Erreur');
    }
  };

  // Upload avatar
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/users/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) throw new Error('Erreur upload');

      const data = await res.json();

      // Mettre à jour localStorage pour synchroniser avec Layout.tsx
      const currentUserStr = localStorage.getItem('current_user');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        currentUser.avatar = data.avatar;
        localStorage.setItem('current_user', JSON.stringify(currentUser));
        // Dispatcher un événement pour notifier Layout.tsx du changement
        window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: currentUser }));
      }

      showToast.success('Avatar mis à jour', 'Succès');
      loadUserData();
    } catch (error) {
      showToast.error('Erreur lors de l\'upload', 'Erreur');
    }
  };

  // Pas d'écran de chargement bloquant - affichage immédiat

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Mon Profil</h1>
          <p className="text-gray-400">Gérez votre compte et vos préférences</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-700 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-crypto-blue text-white'
                : 'bg-crypto-dark text-gray-400 hover:bg-crypto-gray'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="space-y-6">
        {/* Vue d'ensemble / Édition */}
        {activeTab === 'overview' && !editing && (
          <OverviewTab 
            user={user}
            walletState={walletState}
            devices={devices}
            activityLogs={activityLogs}
            onEdit={() => setEditing(true)}
            onAvatarUpload={handleAvatarUpload}
          />
        )}

        {activeTab === 'overview' && editing && (
          <EditProfileForm
            editForm={editForm}
            setEditForm={setEditForm}
            onSave={handleSaveProfile}
            onCancel={() => setEditing(false)}
            saving={saving}
          />
        )}

        {/* Portefeuille */}
        {activeTab === 'wallet' && (
          <WalletTab
            walletState={walletState}
            walletTab={walletTab}
            setWalletTab={setWalletTab}
            depositForm={depositForm}
            setDepositForm={setDepositForm}
            withdrawForm={withdrawForm}
            setWithdrawForm={setWithdrawForm}
            convertForm={convertForm}
            setConvertForm={setConvertForm}
            processingTx={processingTx}
            onDeposit={handleDeposit}
            onWithdraw={handleWithdraw}
            onConvert={handleConvert}
          />
        )}

        {/* Sécurité */}
        {activeTab === 'security' && (
          <SecurityTab
            user={user}
            twoFAEnabled={twoFAEnabled}
            twoFASetup={twoFASetup}
            twoFACode={twoFACode}
            twoFASecret={twoFASecret}
            twoFAQRCode={twoFAQRCode}
            passwordForm={passwordForm}
            showPasswords={showPasswords}
            devices={devices}
            saving={saving}
            onEnable2FA={handleEnable2FA}
            onVerify2FA={handleVerify2FA}
            onDisable2FA={handleDisable2FA}
            onChangePassword={handleChangePassword}
            onRevokeSession={handleRevokeSession}
            setTwoFACode={setTwoFACode}
            setPasswordForm={setPasswordForm}
            setShowPasswords={setShowPasswords}
          />
        )}

        {/* API Binance */}
        {activeTab === 'api' && (
          <ApiTab
            binanceKeys={binanceKeys}
            binanceConnected={binanceConnected}
            testingBinance={testingBinance}
            saving={saving}
            onSaveKeys={handleSaveBinanceKeys}
            onTestConnection={testBinanceConnection}
            setBinanceKeys={setBinanceKeys}
          />
        )}
      </div>
    </div>
  );
}

// ============ SOUS-COMPOSANTS ============

interface OverviewTabProps {
  user: UserProfile | null;
  walletState: WalletState | null;
  devices: ConnectedDevice[];
  activityLogs: ActivityItem[];
  onEdit: () => void;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function OverviewTab({ user, walletState, devices, activityLogs, onEdit, onAvatarUpload }: OverviewTabProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'trade': return <BarChart3 className="w-4 h-4 text-crypto-blue" />;
      case 'deposit': return <Download className="w-4 h-4 text-crypto-green" />;
      case 'withdrawal': return <Upload className="w-4 h-4 text-crypto-orange" />;
      case 'login': return <KeyRound className="w-4 h-4 text-crypto-purple" />;
      case 'security': return <Lock className="w-4 h-4 text-crypto-orange" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Carte Profil */}
      <div className="lg:col-span-2 crypto-card">
        <div className="flex items-start gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-crypto-blue to-crypto-purple flex items-center justify-center text-3xl font-bold text-white overflow-hidden">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.displayName || user.username}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // En cas d'erreur, cacher l'image pour montrer les initiales
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                /* Initiales uniquement si pas d'avatar */
                (user?.displayName || user?.username || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <button
              onClick={() => document.getElementById('avatar-upload')?.click()}
              className="absolute -bottom-1 -right-1 p-2 bg-crypto-dark rounded-full border-2 border-gray-800 hover:bg-crypto-gray transition-colors"
              title="Changer la photo"
            >
              <Camera className="w-4 h-4 text-crypto-blue" />
            </button>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onAvatarUpload}
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold">{user?.displayName || user?.username || 'Utilisateur'}</h2>
              <button
                onClick={onEdit}
                className="flex items-center gap-2 px-4 py-2 bg-crypto-blue/20 text-crypto-blue rounded-lg hover:bg-crypto-blue/30 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Modifier
              </button>
            </div>
            <p className="text-gray-400 mb-4">{user?.bio || 'Aucune bio'}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-gray-300">
                <Mail className="w-4 h-4 text-crypto-blue" />
                {user?.email || '-'}
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Phone className="w-4 h-4 text-crypto-green" />
                {user?.phone || '+223'}
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <MapPin className="w-4 h-4 text-crypto-purple" />
                {user?.location || 'Bamako, Mali'}
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Calendar className="w-4 h-4 text-crypto-orange" />
                Membre depuis {user?.createdAt ? formatDate(user.createdAt) : '-'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="space-y-4">
        <div className="crypto-card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-crypto-blue" />
            Balance
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Total USDT</span>
              <span className="font-semibold">{walletState?.totalUSDT?.toLocaleString() || '0'} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total FCFA</span>
              <span className="font-semibold text-crypto-green">
                {walletState?.totalXOF ? formatXOF(walletState.totalXOF) : formatXOF(0)}
              </span>
            </div>
          </div>
        </div>

        <div className="crypto-card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-crypto-green" />
            Appareils ({devices.length})
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {devices.slice(0, 3).map((device) => (
              <div key={device.id} className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${device.current ? 'bg-crypto-green' : 'bg-gray-500'}`} />
                <span className="text-gray-300 truncate">{device.device}</span>
                {device.current && <span className="text-xs text-crypto-green">(Actuel)</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activité récente */}
      <div className="lg:col-span-3 crypto-card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-crypto-blue" />
          Activité Récente
        </h3>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {activityLogs.length === 0 ? (
            <p className="text-gray-400 text-center py-4">Aucune activité récente</p>
          ) : (
            activityLogs.slice(0, 10).map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-crypto-dark/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{getActivityIcon(activity.type)}</span>
                  <div>
                    <p className="font-medium">{activity.description}</p>
                    <p className="text-sm text-gray-400">{formatDate(activity.createdAt)}</p>
                  </div>
                </div>
                {activity.amount !== undefined && activity.amount > 0 && (
                  <span className="font-semibold text-crypto-green">
                    +{formatXOF(activity.amount)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============ FORMULAIRE ÉDITION PROFIL ============

interface EditProfileFormProps {
  editForm: { name: string; email: string; bio: string; phone: string; location: string };
  setEditForm: (form: { name: string; email: string; bio: string; phone: string; location: string }) => void;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
}

function EditProfileForm({ editForm, setEditForm, onSave, onCancel, saving }: EditProfileFormProps) {
  return (
    <div className="crypto-card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <UserCircle className="w-6 h-6 text-crypto-blue" />
          Modifier le Profil
        </h2>
        <button
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={onSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Nom complet</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Email</label>
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Bio</label>
          <textarea
            value={editForm.bio}
            onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
            rows={3}
            className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none"
            placeholder="Décrivez-vous en quelques mots..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Téléphone</label>
            <input
              type="tel"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none"
              placeholder="+223 XX XX XX XX"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Localisation</label>
            <input
              type="text"
              value={editForm.location}
              onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
              className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none"
              placeholder="Ville, Pays"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-crypto-blue hover:bg-crypto-blue/80 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-6 py-3 bg-crypto-gray hover:bg-crypto-gray/80 text-white rounded-lg transition-colors"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}

interface WalletTabProps {
  walletState: WalletState | null;
  walletTab: 'deposit' | 'withdraw' | 'convert';
  setWalletTab: (tab: 'deposit' | 'withdraw' | 'convert') => void;
  depositForm: { amount: string; phone: string; provider: MobileMoneyProvider };
  setDepositForm: (form: { amount: string; phone: string; provider: MobileMoneyProvider }) => void;
  withdrawForm: { amount: string; phone: string; provider: MobileMoneyProvider };
  setWithdrawForm: (form: { amount: string; phone: string; provider: MobileMoneyProvider }) => void;
  convertForm: { from: string; to: string; amount: string };
  setConvertForm: (form: { from: string; to: string; amount: string }) => void;
  processingTx: boolean;
  onDeposit: (e: React.FormEvent) => void;
  onWithdraw: (e: React.FormEvent) => void;
  onConvert: (e: React.FormEvent) => void;
}

function WalletTab({
  walletState,
  walletTab,
  setWalletTab,
  depositForm,
  setDepositForm,
  withdrawForm,
  setWithdrawForm,
  convertForm,
  setConvertForm,
  processingTx,
  onDeposit,
  onWithdraw,
  onConvert
}: WalletTabProps) {
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(true);
  
  // Charger le taux de change réel
  useEffect(() => {
    const loadRate = async () => {
      try {
        const response = await fetch(`${API_URL}/api/wallet/exchange-rate`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.rate) {
            setExchangeRate(data.rate);
          }
        }
      } catch (error) {
        console.error('Erreur chargement taux:', error);
      } finally {
        setRateLoading(false);
      }
    };
    
    loadRate();
    // Rafraîchir toutes les 5 minutes
    const interval = setInterval(loadRate, 300000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Balance */}
      <div className="crypto-card">
        <h3 className="font-semibold mb-4">Balance Totale</h3>
        <div className="space-y-4">
          <div className="p-4 bg-gradient-to-r from-crypto-blue/20 to-crypto-purple/20 rounded-lg">
            <p className="text-sm text-gray-400 mb-1">Total en USDT</p>
            <p className="text-2xl font-bold">{walletState?.totalUSDT?.toLocaleString() || '0'} USDT</p>
          </div>
          <div className="p-4 bg-gradient-to-r from-crypto-green/20 to-crypto-blue/20 rounded-lg">
            <p className="text-sm text-gray-400 mb-1">Total en FCFA</p>
            <p className="text-2xl font-bold text-crypto-green">
              {walletState?.totalXOF ? formatXOF(walletState.totalXOF) : formatXOF(0)}
            </p>
          </div>
        </div>
        
        {/* Taux de change */}
        <div className="mt-4 p-3 bg-crypto-dark/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <ArrowLeftRight className="w-4 h-4 text-crypto-blue" />
            <span className="text-gray-400">Taux de change:</span>
            <span className="text-crypto-blue font-medium">
              {rateLoading ? 'Chargement...' : exchangeRate ? `1 USDT = ${exchangeRate.toLocaleString()} FCFA` : 'Non disponible'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {rateLoading ? 'Récupération du taux réel...' : exchangeRate ? `Taux réel mis à jour ${new Date().toLocaleTimeString()}` : 'Erreur de chargement'}
          </p>
        </div>
        
        {/* Crypto balances */}
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-400">Cryptos</h4>
          {walletState?.balances?.filter(b => parseFloat(b.free) > 0).slice(0, 5).map((balance) => (
            <div key={balance.asset} className="flex justify-between items-center p-2 bg-crypto-dark/30 rounded">
              <span className="font-medium">{balance.asset}</span>
              <div className="text-right">
                <p className="font-semibold">{parseFloat(balance.free).toLocaleString()} {balance.asset}</p>
                <p className="text-xs text-gray-400">≈ {balance.valueUSDT?.toLocaleString() || '0'} USDT</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="lg:col-span-2 crypto-card">
        <div className="flex gap-2 mb-6 border-b border-gray-700 pb-4">
          <button
            onClick={() => setWalletTab('deposit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              walletTab === 'deposit' ? 'bg-crypto-green text-white' : 'text-gray-400 hover:bg-crypto-gray'
            }`}
          >
            <Download className="w-4 h-4" /> Dépôt
          </button>
          <button
            onClick={() => setWalletTab('withdraw')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              walletTab === 'withdraw' ? 'bg-crypto-orange text-white' : 'text-gray-400 hover:bg-crypto-gray'
            }`}
          >
            <Upload className="w-4 h-4" /> Retrait
          </button>
          <button
            onClick={() => setWalletTab('convert')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              walletTab === 'convert' ? 'bg-crypto-blue text-white' : 'text-gray-400 hover:bg-crypto-gray'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" /> Convertir
          </button>
        </div>

        {/* Formulaire Dépôt */}
        {walletTab === 'deposit' && (
          <form onSubmit={onDeposit} className="space-y-4">
            <h3 className="font-semibold text-lg">Dépôt Mobile Money</h3>
            <p className="text-sm text-gray-400">Rechargez votre compte via Orange Money, MTN ou Wave</p>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Montant (FCFA)</label>
              <input
                type="number"
                value={depositForm.amount}
                onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                placeholder="5000"
                className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none"
                required
                min="100"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Numéro de téléphone (+223)</label>
              <input
                type="tel"
                value={depositForm.phone}
                onChange={(e) => setDepositForm({ ...depositForm, phone: e.target.value })}
                placeholder="70 00 00 00"
                className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Opérateur</label>
              <div className="grid grid-cols-3 gap-2">
                {MALI_OPERATORS.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setDepositForm({ ...depositForm, provider: op.id })}
                    className={`py-3 px-4 rounded-lg font-medium text-sm transition-colors ${
                      depositForm.provider === op.id
                        ? 'bg-crypto-blue text-white'
                        : 'bg-crypto-dark text-gray-400 hover:bg-crypto-gray'
                    }`}
                    style={depositForm.provider === op.id ? {} : { borderColor: op.color, border: '1px solid' }}
                  >
                    {op.name}
                  </button>
                ))}
              </div>
            </div>
            
            <button
              type="submit"
              disabled={processingTx}
              className="w-full py-3 bg-crypto-green hover:bg-crypto-green/80 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {processingTx ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmer le Dépôt'}
            </button>
          </form>
        )}

        {/* Formulaire Retrait */}
        {walletTab === 'withdraw' && (
          <form onSubmit={onWithdraw} className="space-y-4">
            <h3 className="font-semibold text-lg">Retrait Mobile Money</h3>
            <p className="text-sm text-gray-400">Retirez des fonds vers votre compte Mobile Money</p>
            
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-400">
                Balance disponible: {walletState?.totalXOF ? formatXOF(walletState.totalXOF) : formatXOF(0)}
              </p>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Montant (FCFA)</label>
              <input
                type="number"
                value={withdrawForm.amount}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                placeholder="5000"
                className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none"
                required
                min="100"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Numéro de téléphone (+223)</label>
              <input
                type="tel"
                value={withdrawForm.phone}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, phone: e.target.value })}
                placeholder="70 00 00 00"
                className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Opérateur</label>
              <div className="grid grid-cols-3 gap-2">
                {MALI_OPERATORS.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setWithdrawForm({ ...withdrawForm, provider: op.id })}
                    className={`py-3 px-4 rounded-lg font-medium text-sm transition-colors ${
                      withdrawForm.provider === op.id
                        ? 'bg-crypto-blue text-white'
                        : 'bg-crypto-dark text-gray-400 hover:bg-crypto-gray'
                    }`}
                  >
                    {op.name}
                  </button>
                ))}
              </div>
            </div>
            
            <button
              type="submit"
              disabled={processingTx}
              className="w-full py-3 bg-crypto-orange hover:bg-crypto-orange/80 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {processingTx ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmer le Retrait'}
            </button>
          </form>
        )}

        {/* Formulaire Conversion */}
        {walletTab === 'convert' && (
          <form onSubmit={onConvert} className="space-y-4">
            <h3 className="font-semibold text-lg">Conversion Crypto</h3>
            <p className="text-sm text-gray-400">Convertissez vos cryptos instantanément</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">De</label>
                <select
                  value={convertForm.from}
                  onChange={(e) => setConvertForm({ ...convertForm, from: e.target.value })}
                  className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none"
                >
                  <option value="USDT">USDT</option>
                  <option value="BTC">BTC</option>
                  <option value="ETH">ETH</option>
                  <option value="BNB">BNB</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Vers</label>
                <select
                  value={convertForm.to}
                  onChange={(e) => setConvertForm({ ...convertForm, to: e.target.value })}
                  className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none"
                >
                  <option value="BTC">BTC</option>
                  <option value="ETH">ETH</option>
                  <option value="USDT">USDT</option>
                  <option value="BNB">BNB</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Montant</label>
              <input
                type="number"
                value={convertForm.amount}
                onChange={(e) => setConvertForm({ ...convertForm, amount: e.target.value })}
                placeholder="100"
                className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none"
                required
                min="0"
                step="0.000001"
              />
            </div>
            
            <button
              type="submit"
              disabled={processingTx}
              className="w-full py-3 bg-crypto-blue hover:bg-crypto-blue/80 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {processingTx ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Convertir Maintenant'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

interface SecurityTabProps {
  user: UserProfile | null;
  twoFAEnabled: boolean;
  twoFASetup: boolean;
  twoFACode: string;
  twoFASecret: string;
  twoFAQRCode: string;
  passwordForm: { current: string; new: string; confirm: string };
  showPasswords: { current: boolean; new: boolean; confirm: boolean };
  devices: ConnectedDevice[];
  saving: boolean;
  onEnable2FA: () => void;
  onVerify2FA: () => void;
  onDisable2FA: () => void;
  onChangePassword: (e: React.FormEvent) => void;
  onRevokeSession: (id: string) => void;
  setTwoFACode: (code: string) => void;
  setPasswordForm: (form: { current: string; new: string; confirm: string }) => void;
  setShowPasswords: (show: { current: boolean; new: boolean; confirm: boolean }) => void;
}

function SecurityTab({
  user,
  twoFAEnabled,
  twoFASetup,
  twoFACode,
  twoFASecret,
  twoFAQRCode,
  passwordForm,
  showPasswords,
  devices,
  saving,
  onEnable2FA,
  onVerify2FA,
  onDisable2FA,
  onChangePassword,
  onRevokeSession,
  setTwoFACode,
  setPasswordForm,
  setShowPasswords
}: SecurityTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 2FA */}
      <div className="crypto-card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-crypto-blue" />
          Authentification à 2 Facteurs (2FA)
        </h3>
        
        <div className="flex items-center justify-between p-4 bg-crypto-dark/50 rounded-lg mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${twoFAEnabled ? 'bg-crypto-green/20' : 'bg-gray-700'}`}>
              <Lock className={`w-5 h-5 ${twoFAEnabled ? 'text-crypto-green' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="font-medium">{twoFAEnabled ? '2FA Activé' : '2FA Désactivé'}</p>
              <p className="text-sm text-gray-400">
                {twoFAEnabled ? 'Votre compte est sécurisé' : 'Activez pour plus de sécurité'}
              </p>
            </div>
          </div>
          <button
            onClick={twoFAEnabled ? undefined : onEnable2FA}
            disabled={twoFAEnabled || twoFASetup}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              twoFAEnabled
                ? 'bg-crypto-green/20 text-crypto-green cursor-default'
                : 'bg-crypto-blue hover:bg-crypto-blue/80 text-white'
            }`}
          >
            {twoFAEnabled ? 'Activé' : twoFASetup ? 'Configuration...' : 'Activer'}
          </button>
        </div>

        {twoFASetup && (
          <div className="space-y-4">
            <div className="p-4 bg-crypto-dark/30 rounded-lg">
              <p className="text-sm text-gray-400 mb-2">Scannez ce QR code avec Google Authenticator:</p>
              {twoFAQRCode ? (
                <img src={twoFAQRCode} alt="QR Code 2FA" className="w-40 h-40 mx-auto" />
              ) : (
                <div className="w-40 h-40 mx-auto bg-gray-700 rounded flex items-center justify-center">
                  <QrCode className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2 text-center">
                Code secret: <code className="bg-crypto-dark px-2 py-1 rounded">{twoFASecret}</code>
              </p>
            </div>
            <input
              type="text"
              value={twoFACode}
              onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Code à 6 chiffres"
              className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none text-center text-2xl tracking-widest"
              maxLength={6}
            />
            <button
              onClick={onVerify2FA}
              className="w-full py-3 bg-crypto-green hover:bg-crypto-green/80 text-white rounded-lg font-medium"
            >
              Vérifier et Activer
            </button>
          </div>
        )}

        {twoFAEnabled && !twoFASetup && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Pour désactiver le 2FA, entrez votre code:</p>
            <input
              type="text"
              value={twoFACode}
              onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Code à 6 chiffres"
              className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-orange focus:outline-none text-center text-2xl tracking-widest"
              maxLength={6}
            />
            <button
              onClick={onDisable2FA}
              className="w-full py-3 bg-crypto-orange hover:bg-crypto-orange/80 text-white rounded-lg font-medium"
            >
              Désactiver 2FA
            </button>
          </div>
        )}
      </div>

      {/* Changement mot de passe */}
      <div className="crypto-card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-crypto-purple" />
          Changer le Mot de Passe
        </h3>
        
        <form onSubmit={onChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Mot de passe actuel</label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={passwordForm.current}
                onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                value={passwordForm.new}
                onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none pr-12"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">Confirmer le nouveau mot de passe</label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-crypto-purple hover:bg-crypto-purple/80 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Changer le Mot de Passe'}
          </button>
        </form>
      </div>

      {/* Appareils connectés */}
      <div className="lg:col-span-2 crypto-card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-crypto-green" />
          Appareils Connectés
        </h3>
        
        <div className="space-y-3">
          {devices.length === 0 ? (
            <p className="text-gray-400 text-center py-4">Aucun appareil connecté</p>
          ) : (
            devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between p-4 bg-crypto-dark/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${device.current ? 'bg-crypto-green/20' : 'bg-gray-700'}`}>
                    <Smartphone className={`w-5 h-5 ${device.current ? 'text-crypto-green' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {device.device} / {device.browser}
                      {device.current && <span className="text-xs bg-crypto-green/20 text-crypto-green px-2 py-1 rounded">Actuel</span>}
                    </p>
                    <p className="text-sm text-gray-400">
                      {device.ip} • {device.location} • {new Date(device.lastActive).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
                {!device.current && (
                  <button
                    onClick={() => onRevokeSession(device.id)}
                    className="px-3 py-1 bg-crypto-orange/20 text-crypto-orange rounded hover:bg-crypto-orange/30 transition-colors text-sm"
                  >
                    Révoquer
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface ApiTabProps {
  binanceKeys: { apiKey: string; secretKey: string };
  binanceConnected: boolean;
  testingBinance: boolean;
  saving: boolean;
  onSaveKeys: (e: React.FormEvent) => void;
  onTestConnection: () => void;
  setBinanceKeys: (keys: { apiKey: string; secretKey: string }) => void;
}

function ApiTab({
  binanceKeys,
  binanceConnected,
  testingBinance,
  saving,
  onSaveKeys,
  onTestConnection,
  setBinanceKeys
}: ApiTabProps) {
  return (
    <div className="max-w-2xl">
      <div className="crypto-card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-crypto-blue" />
          Clés API Binance
        </h3>
        
        <div className={`flex items-center gap-3 p-4 rounded-lg mb-6 ${binanceConnected ? 'bg-crypto-green/10 border border-crypto-green/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
          <div className={`w-3 h-3 rounded-full ${binanceConnected ? 'bg-crypto-green' : 'bg-yellow-500'}`} />
          <span className={binanceConnected ? 'text-crypto-green' : 'text-yellow-500'}>
            {binanceConnected ? 'Connecté à Binance' : 'Non connecté'}
          </span>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-yellow-500 mb-1">Sécurité Maximale</p>
              <p>Vos clés API sont stockées côté backend (chiffré AES-256). Elles ne sont jamais exposées au frontend.</p>
            </div>
          </div>
        </div>

        <form onSubmit={onSaveKeys} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Clé API Binance</label>
            <input
              type="text"
              value={binanceKeys.apiKey}
              onChange={(e) => setBinanceKeys({ ...binanceKeys, apiKey: e.target.value })}
              placeholder="Votre clé API..."
              className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">Clé Secrète Binance</label>
            <input
              type="password"
              value={binanceKeys.secretKey}
              onChange={(e) => setBinanceKeys({ ...binanceKeys, secretKey: e.target.value })}
              placeholder="Votre clé secrète..."
              className="w-full px-4 py-3 bg-crypto-dark border border-gray-700 rounded-lg focus:border-crypto-blue focus:outline-none"
              required
            />
          </div>
          
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-crypto-blue hover:bg-crypto-blue/80 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Sauvegarder
            </button>
            
            <button
              type="button"
              onClick={onTestConnection}
              disabled={testingBinance}
              className="flex-1 py-3 bg-crypto-gray hover:bg-crypto-gray/80 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {testingBinance ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
              Tester
            </button>
          </div>
        </form>

        <a
          href="https://www.binance.com/fr/my/settings/api-management"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 text-crypto-blue hover:underline text-sm"
        >
          <ExternalLink className="w-4 h-4" />
          Créer des clés API sur Binance
        </a>
      </div>
    </div>
  );
}

