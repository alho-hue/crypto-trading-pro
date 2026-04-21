const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ===== TYPES =====
export interface Message {
  id: string;
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  content: string;
  channelId: string;
  likes?: number;
  likedBy?: string[];
  isSystemMessage?: boolean;
  timestamp: Date | string | number;
  replyTo?: { username: string; content: string };
  voiceUrl?: string;
  voiceDuration?: number;
  imageUrl?: string;
}

export interface OnlineUser {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  isVerified?: boolean;
  isPro?: boolean;
  status?: 'online' | 'away' | 'dnd' | 'offline';
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  isVerified?: boolean;
  isPro?: boolean;
  reputation?: number;
}

export interface ChatSignal {
  id: string;
  symbol: string;
  direction: 'buy' | 'sell';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  analysis?: string;
  confidence: number;
  timestamp: string;
  status: string;
}
export interface Signal {
  id: string;
  symbol: string;
  direction: 'buy' | 'sell';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  analysis: string;
  timeframe: string;
  userId: string;
  username: string;
  avatar: string;
  likes: number;
  dislikes: number;
  comments: number;
  aiValidation?: {
    isValid: boolean;
    score: number;
    warnings: string[];
  };
  timestamp: number;
  status: 'active' | 'expired' | 'hit_target' | 'hit_stop';
  votes?: {
    bullish: number;
    bearish: number;
    userVote?: 'bullish' | 'bearish' | null;
  };
  riskReward?: string;
}

export interface TradeShare {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  symbol: string;
  direction: 'buy' | 'sell';
  entryPrice: number;
  exitPrice?: number;
  size: number;
  leverage?: number;
  pnl: number;
  pnlPercent: number;
  strategy?: string;
  screenshot?: string;
  analysis?: string;
  isPublic: boolean;
  allowCopy: boolean;
  copyCount: number;
  likes: number;
  comments: string[];
  timestamp: number;
  status: 'open' | 'closed';
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  stats: {
    totalTrades: number;
    winningTrades: number;
    totalProfit: number;
    signalsPosted: number;
    signalAccuracy: number;
    followers: number;
    winRate: number;
  };
  reputation: number;
  isVerified?: boolean;
  isPro?: boolean;
}

export interface ReputationLevel {
  score: number;
  level: 'new' | 'verified' | 'experienced' | 'expert' | 'master';
  title: string;
  badge: string;
}

// ===== SIGNALS API =====
export const signalsApi = {
  // Get all signals
  getSignals: async (filters?: { status?: string; symbol?: string; sortBy?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.symbol) params.append('symbol', filters.symbol);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    
    const res = await fetch(`${API_URL}/api/social/signals?${params}`);
    if (!res.ok) throw new Error('Failed to fetch signals');
    return res.json();
  },

  // Get single signal
  getSignal: async (id: string) => {
    const res = await fetch(`${API_URL}/api/social/signals/${id}`);
    if (!res.ok) throw new Error('Failed to fetch signal');
    return res.json();
  },

  // Create signal
  createSignal: async (signalData: Partial<Signal>) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/social/signals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(signalData)
    });
    if (!res.ok) throw new Error('Failed to create signal');
    return res.json();
  },

  // Vote on signal
  voteSignal: async (id: string, vote: 'bullish' | 'bearish') => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/social/signals/${id}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ vote })
    });
    if (!res.ok) throw new Error('Failed to vote');
    return res.json();
  },

  // Like signal
  likeSignal: async (id: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/social/signals/${id}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to like signal');
    return res.json();
  },

  // Comment on signal
  commentSignal: async (id: string, content: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/social/signals/${id}/comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content })
    });
    if (!res.ok) throw new Error('Failed to comment');
    return res.json();
  },

  // Delete signal
  deleteSignal: async (id: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/social/signals/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to delete signal');
    return res.json();
  }
};

// ===== TRADES API =====
export const tradesApi = {
  // Get all trades
  getTrades: async (filters?: { status?: string; symbol?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.symbol) params.append('symbol', filters.symbol);
    
    const res = await fetch(`${API_URL}/api/social/trades?${params}`);
    if (!res.ok) throw new Error('Failed to fetch trades');
    return res.json();
  },

  // Share trade
  shareTrade: async (tradeData: Partial<TradeShare>) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/social/trades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(tradeData)
    });
    if (!res.ok) throw new Error('Failed to share trade');
    return res.json();
  },

  // Copy trade
  copyTrade: async (id: string, positionSize?: number) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/social/trades/${id}/copy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ positionSize })
    });
    if (!res.ok) throw new Error('Failed to copy trade');
    return res.json();
  },

  // Like trade
  likeTrade: async (id: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/social/trades/${id}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to like trade');
    return res.json();
  }
};

// ===== LEADERBOARD API =====
export const leaderboardApi = {
  // Get leaderboard
  getLeaderboard: async (sortBy: string = 'totalProfit', limit: number = 100) => {
    const res = await fetch(`${API_URL}/api/leaderboard?sortBy=${sortBy}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch leaderboard');
    return res.json();
  },

  // Get leaderboard stats
  getStats: async () => {
    const res = await fetch(`${API_URL}/api/leaderboard/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  }
};

// ===== REPUTATION UTILS =====
export const reputationUtils = {
  // Calculate reputation score
  calculateScore: (stats: {
    winRate: number;
    totalProfit: number;
    signalAccuracy: number;
    followers: number;
    isVerified?: boolean;
    isPro?: boolean;
    reportCount?: number;
  }): number => {
    let score = 100; // Base score
    score += stats.winRate * 5;
    score += stats.totalProfit / 100;
    score += stats.signalAccuracy * 3;
    score += stats.followers * 2;
    score -= (stats.reportCount || 0) * 50;
    if (stats.isVerified) score += 100;
    if (stats.isPro) score += 200;
    return Math.max(0, Math.min(1000, score));
  },

  // Get reputation level
  getLevel: (score: number): ReputationLevel => {
    if (score >= 1000) {
      return { score, level: 'master', title: 'Maître', badge: '🔴' };
    } else if (score >= 700) {
      return { score, level: 'expert', title: 'Expert', badge: '🟠' };
    } else if (score >= 300) {
      return { score, level: 'experienced', title: 'Expérimenté', badge: '🟡' };
    } else if (score >= 100) {
      return { score, level: 'verified', title: 'Vérifié', badge: '🔵' };
    } else {
      return { score, level: 'new', title: 'Nouveau', badge: '🟢' };
    }
  },

  // Check if user has access to VIP channels
  hasVipAccess: (score: number): boolean => score >= 500,

  // Get badges for user
  getBadges: (stats: {
    isVerified: boolean;
    isPro: boolean;
    rank?: number;
    winRate: number;
    totalProfit: number;
    recentPerformance?: number;
  }): string[] => {
    const badges: string[] = [];
    if (stats.isVerified) badges.push('🟦 Verified');
    if (stats.isPro) badges.push('👑 Pro');
    if (stats.rank && stats.rank <= 10) badges.push('⭐ Top 10');
    if (stats.winRate > 80) badges.push('🎯 Sniper');
    if (stats.totalProfit > 10000) badges.push('💎 Diamond');
    if (stats.recentPerformance && stats.recentPerformance > 50) badges.push('🔥 Hot');
    return badges;
  }
};

// ===== GIPHY API =====
// Clé de démo Giphy - pour production, utilisez votre propre clé sur https://developers.giphy.com
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || 'GlvgY7C1z12dV9G8D12dV9G8D';

// Fallback: Si Giphy échoue, utiliser des GIFs de démo
const DEMO_GIFS = [
  'https://media.giphy.com/media/3o7TKtnuHOHHUjR38Y/giphy.gif',
  'https://media.giphy.com/media/l0HlOvJ7yaacjwVsk/giphy.gif',
  'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
  'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
  'https://media.giphy.com/media/3o7TKU8RvR4P8c5f8Y/giphy.gif'
];
const GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs';

export const giphyApi = {
  // Search GIFs
  search: async (query: string, limit: number = 20): Promise<string[]> => {
    try {
      const res = await fetch(
        `${GIPHY_BASE_URL}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&rating=pg-13`
      );
      if (!res.ok) throw new Error('Failed to search GIFs');
      const data = await res.json();
      if (!data.data || data.data.length === 0) {
        return DEMO_GIFS.slice(0, limit);
      }
      return data.data.map((gif: any) => gif.images.fixed_height?.url || gif.images.downsized?.url).filter(Boolean);
    } catch (error) {
      console.error('Giphy search error:', error);
      return DEMO_GIFS.slice(0, limit);
    }
  },

  // Get trending GIFs
  trending: async (limit: number = 20): Promise<string[]> => {
    try {
      const res = await fetch(
        `${GIPHY_BASE_URL}/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&rating=pg-13`
      );
      if (!res.ok) {
        // Retourner des GIFs de démo si l'API échoue
        return DEMO_GIFS.slice(0, limit);
      }
      const data = await res.json();
      if (!data.data || data.data.length === 0) {
        return DEMO_GIFS.slice(0, limit);
      }
      return data.data.map((gif: any) => gif.images.fixed_height?.url || gif.images.downsized?.url).filter(Boolean);
    } catch (error) {
      console.error('Giphy trending error:', error);
      return DEMO_GIFS.slice(0, limit);
    }
  }
};

// ===== MESSAGE REACTIONS - Style Telegram =====
// Réactions communes style Telegram
export const messageReactions = [
  '👍', '👎', '❤️', '🔥', '🎉', '🤩', '😂', '😮', '😢', '😡',
  '🤔', '🤯', '😠', '💩', '🤡', '🚀', '🌭', '🥱', '😴', '💯'
];

// Catégories de réactions pour l'affichage
export const reactionCategories = {
  popular: ['👍', '❤️', '🔥', '🎉', '👏'],
  emotions: ['😁', '😢', '😠', '😡', '🤩', '🥱'],
  crypto: ['📈', '📉', '💰', '💎', '🚀', '⚡', '🌙', '🐂', '🐻'],
  other: ['🤔', '💯', '🤯', '🌚', '👀', '🙏']
};

export const messageReactionsApi = {
  // Add reaction to message (stored locally for now)
  addReaction: async (messageId: string, emoji: string) => {
    const reactions = JSON.parse(localStorage.getItem('message_reactions') || '{}');
    if (!reactions[messageId]) reactions[messageId] = {};
    if (!reactions[messageId][emoji]) reactions[messageId][emoji] = [];
    
    const userId = localStorage.getItem('current_user') 
      ? JSON.parse(localStorage.getItem('current_user')!).id 
      : 'anonymous';
    
    const index = reactions[messageId][emoji].indexOf(userId);
    if (index === -1) {
      reactions[messageId][emoji].push(userId);
    } else {
      reactions[messageId][emoji].splice(index, 1);
      if (reactions[messageId][emoji].length === 0) {
        delete reactions[messageId][emoji];
      }
    }
    
    localStorage.setItem('message_reactions', JSON.stringify(reactions));
    return reactions[messageId];
  },

  // Get reactions for message
  getReactions: (messageId: string) => {
    const reactions = JSON.parse(localStorage.getItem('message_reactions') || '{}');
    return reactions[messageId] || {};
  }
};

// ===== MESSAGE LIKE API =====
export const messageLikeApi = {
  // Like/unlike a message
  toggleLike: async (messageId: string): Promise<{ likes: number; isLiked: boolean }> => {
    const res = await fetch(`${API_URL}/api/social/messages/${messageId}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!res.ok) throw new Error('Failed to toggle like');
    return res.json();
  }
};

// ===== FAVORITES API =====
export const favoritesApi = {
  // Toggle favorite
  toggleFavorite: async (messageId: string): Promise<{ isFavorited: boolean }> => {
    const res = await fetch(`${API_URL}/api/social/messages/${messageId}/favorite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!res.ok) throw new Error('Failed to toggle favorite');
    return res.json();
  },

  // Get user's favorites
  getFavorites: async (): Promise<Message[]> => {
    const res = await fetch(`${API_URL}/api/social/favorites`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!res.ok) throw new Error('Failed to get favorites');
    const data = await res.json();
    return data.favorites || [];
  }
};

// ===== ONLINE USERS API =====
export const onlineUsersApi = {
  // Get online users list
  getOnlineUsers: async (): Promise<OnlineUser[]> => {
    const res = await fetch(`${API_URL}/api/social/online-users`);
    if (!res.ok) throw new Error('Failed to get online users');
    const data = await res.json();
    return data.users || [];
  }
};

// ===== USERS API (for mentions) =====
export const usersApi = {
  // Search users
  search: async (query: string = '', limit: number = 20): Promise<User[]> => {
    const res = await fetch(`${API_URL}/api/social/users?search=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to search users');
    const data = await res.json();
    return data.users || [];
  },

  // Get all users
  getAll: async (limit: number = 50): Promise<User[]> => {
    const res = await fetch(`${API_URL}/api/social/users?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to get users');
    const data = await res.json();
    return data.users || [];
  }
};

// ===== PROFILE API =====
export const profileApi = {
  // Get full user profile
  getProfile: async (username: string): Promise<{
    user: User & { bio?: string; createdAt?: string; followers: number; following: number };
    signals: ChatSignal[];
    trades: TradeShare[];
  }> => {
    const res = await fetch(`${API_URL}/api/social/profile/${username}`);
    if (!res.ok) throw new Error('Failed to get profile');
    return res.json();
  }
};

// ===== VOICE MESSAGES API =====
export const voiceApi = {
  // Upload voice message
  upload: async (audioBlob: Blob, duration: number): Promise<{ audioUrl: string; duration: number }> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice-message.webm');
    formData.append('duration', duration.toString());

    const res = await fetch(`${API_URL}/api/social/voice/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    });
    if (!res.ok) throw new Error('Failed to upload voice');
    return res.json();
  }
};
