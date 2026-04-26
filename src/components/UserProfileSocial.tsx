/**
 * 🌐 UserProfileSocial - Profil réseau social
 * Affiche le profil public d'un utilisateur avec followers, following, stats
 * Permet follow/unfollow et envoi de DM
 */

import { useState, useEffect } from 'react';
import { 
  User, Users, MessageCircle, ArrowLeft, 
  TrendingUp, Award, Calendar, 
  UserPlus, UserMinus, Loader2, Copy, CheckCircle,
  Mail, BarChart3, Target
} from 'lucide-react';
import { showToast } from '../stores/toastStore';
import { useCryptoStore } from '../stores/cryptoStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface UserProfileData {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  stats?: {
    trades?: number;
    profit?: number;
    winRate?: number;
  };
  followers: number;
  following: number;
  isPublic: boolean;
  allowCopyTrading?: boolean;
  isOnline?: boolean;
  lastActive?: string;
  createdAt?: string;
}

interface FollowerUser {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
}

interface UserProfileSocialProps {
  userId?: string;
  username?: string;
  onClose?: () => void;
  onStartDM?: (userId: string, username: string, displayName: string, avatar?: string) => void;
}

export default function UserProfileSocial({ userId, username, onClose, onStartDM }: UserProfileSocialProps) {
  const setView = useCryptoStore((state) => state.setView);
  
  // Récupérer current user depuis localStorage
  const getCurrentUser = () => {
    const userStr = localStorage.getItem('current_user');
    return userStr ? JSON.parse(userStr) : null;
  };
  const currentUser = getCurrentUser();
  
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'followers' | 'following'>('overview');
  const [followersList, setFollowersList] = useState<FollowerUser[]>([]);
  const [followingList, setFollowingList] = useState<FollowerUser[]>([]);
  const [copied, setCopied] = useState(false);

  // Charger le profil
  useEffect(() => {
    if (userId || username) {
      loadProfile();
    }
  }, [userId, username]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url;
      
      if (userId) {
        url = `${API_URL}/api/users/${userId}/profile`;
      } else if (username) {
        url = `${API_URL}/api/users/${username}`;
      } else {
        return;
      }
      
      const res = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (!res.ok) {
        throw new Error('Profil non trouvé');
      }
      
      const data = await res.json();
      setProfile(data.user);
      
      // Vérifier si on suit déjà ce user
      if (currentUser?.id && data.user.id !== currentUser.id) {
        checkFollowingStatus(data.user.id);
      }
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      showToast.error('Impossible de charger le profil', 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const checkFollowingStatus = async (targetId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // Charger la liste des following du current user
      const res = await fetch(`${API_URL}/api/users/${currentUser.id}/following`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        const isFollowingUser = data.following.some((f: any) => f.id === targetId);
        setIsFollowing(isFollowingUser);
      }
    } catch (error) {
      console.error('Erreur check following:', error);
    }
  };

  const handleFollow = async () => {
    if (!profile || !currentUser) {
      showToast.error('Vous devez être connecté', 'Erreur');
      return;
    }
    
    if (profile.id === currentUser.id) {
      showToast.error('Vous ne pouvez pas vous suivre vous-même', 'Erreur');
      return;
    }
    
    setFollowLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/users/${profile.id}/follow`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.following);
        // Mettre à jour le compteur local
        setProfile(prev => prev ? {
          ...prev,
          followers: data.followers
        } : null);
        
        showToast.success(
          data.following ? `Vous suivez maintenant ${profile.displayName}` : `Vous ne suivez plus ${profile.displayName}`,
          'Succès'
        );
      }
    } catch (error) {
      showToast.error('Erreur lors du follow', 'Erreur');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleStartDM = () => {
    if (!profile) return;
    
    if (onStartDM) {
      onStartDM(profile.id, profile.username, profile.displayName, profile.avatar);
    } else {
      // Rediriger vers Community avec DM ouvert
      setView('community');
      // TODO: Ouvrir DM automatiquement
    }
    
    if (onClose) onClose();
  };

  const loadFollowers = async () => {
    if (!profile) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${profile.id}/followers`);
      if (res.ok) {
        const data = await res.json();
        setFollowersList(data.followers);
      }
    } catch (error) {
      console.error('Erreur chargement followers:', error);
    }
  };

  const loadFollowing = async () => {
    if (!profile) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${profile.id}/following`);
      if (res.ok) {
        const data = await res.json();
        setFollowingList(data.following);
      }
    } catch (error) {
      console.error('Erreur chargement following:', error);
    }
  };

  const copyUsername = () => {
    if (profile?.username) {
      navigator.clipboard.writeText(`@${profile.username}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast.success('Nom d\'utilisateur copié', 'Copié');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-gray-400">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Profil non trouvé</h2>
          <p className="text-gray-400 mb-4">Cet utilisateur n'existe pas ou son profil est privé</p>
          {onClose && (
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
            >
              Retour
            </button>
          )}
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;
  const joinDate = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('fr-FR', { 
    month: 'long', 
    year: 'numeric' 
  }) : null;

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-400" />
            </button>
          )}
          <h1 className="text-2xl font-bold text-white">Profil</h1>
        </div>

        {/* Profile Card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden mb-6">
          {/* Cover / Header */}
          <div className="h-32 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600"></div>
          
          {/* Avatar & Info */}
          <div className="px-6 pb-6">
            <div className="flex flex-col md:flex-row items-start md:items-end -mt-12 mb-4 gap-4">
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gray-800 border-4 border-gray-900 overflow-hidden">
                  {profile.avatar ? (
                    <img 
                      src={profile.avatar} 
                      alt={profile.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
                      {profile.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                {profile.isOnline && (
                  <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-gray-900"></div>
                )}
              </div>
              
              {/* Name & Actions */}
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-white truncate">
                  {profile.displayName}
                </h2>
                <button 
                  onClick={copyUsername}
                  className="flex items-center gap-1 text-gray-400 hover:text-gray-300 transition-colors"
                >
                  @{profile.username}
                  {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              
              {/* Action Buttons */}
              {!isOwnProfile && (
                <div className="flex gap-2">
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isFollowing 
                        ? 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700' 
                        : 'bg-blue-600 text-white hover:bg-blue-500'
                    }`}
                  >
                    {followLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFollowing ? (
                      <>
                        <UserMinus className="w-4 h-4" />
                        Ne plus suivre
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Suivre
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={handleStartDM}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Message
                  </button>
                </div>
              )}
              
              {isOwnProfile && (
                <button
                  onClick={() => setView('profile')}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
                >
                  Modifier mon profil
                </button>
              )}
            </div>
            
            {/* Bio */}
            {profile.bio && (
              <p className="text-gray-300 mb-4 max-w-2xl">{profile.bio}</p>
            )}
            
            {/* Stats Row */}
            <div className="flex flex-wrap gap-6 text-sm">
              <button 
                onClick={() => { setActiveTab('following'); loadFollowing(); }}
                className="hover:text-blue-400 transition-colors"
              >
                <span className="font-bold text-white">{profile.following}</span>
                <span className="text-gray-400 ml-1">abonnements</span>
              </button>
              <button 
                onClick={() => { setActiveTab('followers'); loadFollowers(); }}
                className="hover:text-blue-400 transition-colors"
              >
                <span className="font-bold text-white">{profile.followers}</span>
                <span className="text-gray-400 ml-1">abonnés</span>
              </button>
              {joinDate && (
                <div className="flex items-center gap-1 text-gray-400">
                  <Calendar className="w-4 h-4" />
                  A rejoint {joinDate}
                </div>
              )}
              {profile.allowCopyTrading && (
                <div className="flex items-center gap-1 text-green-400">
                  <Target className="w-4 h-4" />
                  Copy Trading activé
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {profile.stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-gray-400">Trades</span>
              </div>
              <p className="text-2xl font-bold text-white">{profile.stats.trades || 0}</p>
            </div>
            
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <span className="text-gray-400">Win Rate</span>
              </div>
              <p className="text-2xl font-bold text-white">{(profile.stats.winRate || 0).toFixed(1)}%</p>
            </div>
            
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Award className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-gray-400">Profit</span>
              </div>
              <p className={`text-2xl font-bold ${(profile.stats.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(profile.stats.profit || 0) >= 0 ? '+' : ''}{profile.stats.profit?.toFixed(2) || '0.00'}%
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'overview' 
                  ? 'text-blue-400 border-b-2 border-blue-400' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Vue d'ensemble
            </button>
            <button
              onClick={() => { setActiveTab('followers'); loadFollowers(); }}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'followers' 
                  ? 'text-blue-400 border-b-2 border-blue-400' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Abonnés ({profile.followers})
            </button>
            <button
              onClick={() => { setActiveTab('following'); loadFollowing(); }}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'following' 
                  ? 'text-blue-400 border-b-2 border-blue-400' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Abonnements ({profile.following})
            </button>
          </div>
          
          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'overview' && (
              <div className="text-center py-8">
                <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Les statistiques détaillées du trader seront bientôt disponibles</p>
                {profile.allowCopyTrading && !isOwnProfile && (
                  <button 
                    className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors"
                    onClick={() => showToast.info('Copy Trading - Bientôt disponible', 'Info')}
                  >
                    Copier ce trader
                  </button>
                )}
              </div>
            )}
            
            {activeTab === 'followers' && (
              <div className="space-y-2">
                {followersList.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">Aucun abonné pour le moment</p>
                ) : (
                  followersList.map(user => (
                    <div 
                      key={user.id} 
                      className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                      onClick={() => {/* TODO: Ouvrir profil */}}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                        {user.avatar ? (
                          <img src={user.avatar.startsWith('http') ? user.avatar.replace(/^http:/, 'https:') : user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          user.displayName?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">{user.displayName}</p>
                        <p className="text-sm text-gray-400">@{user.username}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            
            {activeTab === 'following' && (
              <div className="space-y-2">
                {followingList.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">Aucun abonnement</p>
                ) : (
                  followingList.map(user => (
                    <div 
                      key={user.id} 
                      className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                      onClick={() => {/* TODO: Ouvrir profil */}}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                        {user.avatar ? (
                          <img src={user.avatar.startsWith('http') ? user.avatar.replace(/^http:/, 'https:') : user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          user.displayName?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">{user.displayName}</p>
                        <p className="text-sm text-gray-400">@{user.username}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
