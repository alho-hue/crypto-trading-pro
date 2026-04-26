import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Users, MessageSquare, Send, Heart, Hash, Settings, Bell, X, Volume2, 
  Image as ImageIcon, AtSign, Plus, Lock, Search, MoreVertical, Crown, 
  Menu, LogOut, User, Moon, Sun, Smile, Paperclip, TrendingUp, 
  TrendingDown, BarChart3, Shield, Zap, Target, AlertTriangle,
  CheckCircle, XCircle, Copy, ExternalLink, Eye, ThumbsUp, ThumbsDown,
  Award, Star, Activity, DollarSign, Percent, Clock, ArrowUpRight,
  ArrowDownRight, Bot, Sparkles, Filter, MessageCircle, Share2,
  BookOpen, LineChart, Wallet, Briefcase, Cpu, Flame, Terminal,
  ChevronRight, ChevronDown, Crown as CrownIcon, BadgeCheck, Ban,
  Radar, FileText, Mail, UserPlus, UserMinus, Mic, MicOff, Headphones, PhoneOff, Pin,
  Calendar
} from 'lucide-react';
import type { UserProfile } from './AuthModal';
import { useCryptoStore } from '../stores/cryptoStore';
import RealVoiceChannel from './RealVoiceChannel';
import GifPicker from './GifPicker';
import MessageSearch from './MessageSearch';
import MessageReactions from './MessageReactions';
import { VoiceMessage, VoicePlayer } from './VoiceMessage';
import UserProfileSocial from './UserProfileSocial';
import { io, Socket } from 'socket.io-client';
import { 
  signalsApi, tradesApi, reputationUtils, 
  messageLikeApi, favoritesApi, onlineUsersApi, usersApi, profileApi, voiceApi, giphyApi,
  type Message as MessageType, type OnlineUser, type User as UserType
} from '../services/socialApi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ===== EMOJIS =====
const EMOJIS = ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾','👍','👎','👊','✊','🤛','🤜','🤞','🤟','🤘','👌','🤌','🤏','👈','👉','👆','👇','☝️','✋','🤚','🖐','🖖','👋','🤙','💪','🦾','🖕','✍️','🙏','🦶','🦵','🦿','👀','👁️','👅','👄','🧠','🫀','🫁','🦷','🦴','👃','🫂','👣','💋','💄','💎','⚡','🔥','💯','💢','💥','💫','💦','💨','🕳️','💣','💬','👁️\u200d🗨️','🗨️','🗯️','💭','💤'];

// ===== TYPES =====
interface ChatSignal {
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
}

interface TradeShare {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  symbol: string;
  direction: 'buy' | 'sell';
  entryPrice: number;
  exitPrice?: number;
  size: number;
  pnl: number;
  pnlPercent: number;
  leverage?: number;
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

interface CommunityLeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  isVerified: boolean;
  isPro: boolean;
  stats: {
    totalTrades: number;
    winningTrades: number;
    totalProfit: number;
    signalsPosted: number;
    signalsAccuracy: number;
    followers: number;
    winRate: number;
  };
  rank: number;
  reputation: number;
}

interface MarketMiniData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

interface QuickAction {
  id: string;
  type: 'open_trade' | 'create_alert' | 'analyze_signal' | 'copy_trade' | 'add_watchlist';
  label: string;
  icon: string;
  payload: any;
}

interface EthernalCommand {
  type: 'analysis' | 'trade_suggestion' | 'validate_signal' | 'portfolio_review' | 'market_overview' | 'help';
  response: string;
  confidence: number;
  actions?: QuickAction[];
  timestamp: number;
}

interface UserReputation {
  userId: string;
  score: number;
  badges: string[];
  trustLevel: 'new' | 'verified' | 'expert' | 'master';
  successfulSignals: number;
  totalSignals: number;
  copiedTrades: number;
  followers: number;
}

interface AIMemory {
  trustedUsers: string[];
  fakeSignallers: string[];
  topPerformers: string[];
  analyzedPatterns: Record<string, number>;
}

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'dm';
  category: string;
  description?: string;
  icon?: string;
  isPrivate?: boolean;
  allowSignals?: boolean;
  allowTrades?: boolean;
}

interface Message {
  id: string;
  userId: string | null;
  username: string;
  displayName: string;
  avatar: string;
  content: string;
  channelId: string;
  likes: number;
  likedBy?: string[];
  timestamp: Date;
  isSystemMessage?: boolean;
  replyTo?: {
    username: string;
    content: string;
  };
  attachments?: Array<{
    type: 'image' | 'file';
    url: string;
    name: string;
    size: number;
  }>;
  voiceUrl?: string;
  voiceDuration?: number;
  isGif?: boolean;
  mentions?: string[];
}

interface LeaderboardUser {
  _id: string;
  username: string;
  displayName: string;
  avatar: string;
  isVerified: boolean;
  isPro: boolean;
  stats: {
    totalTrades: number;
    winningTrades: number;
    totalProfit: number;
    signalsPosted: number;
    signalAccuracy: number;
    followers: number;
  };
  reputation: number;
}

type ActiveTab = 'chat' | 'signals' | 'trades' | 'leaderboard' | 'polls' | 'events';

// Global styles
const globalStyles = `
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes pulse-ring {
    0% { transform: scale(0.8); opacity: 0.5; }
    100% { transform: scale(1.2); opacity: 0; }
  }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  .animate-slideIn { animation: slideIn 0.3s ease-out; }
  .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
  .animate-pulse-ring { animation: pulse-ring 1.5s ease-out infinite; }
  .animate-bounce { animation: bounce 0.5s ease-in-out; }
  .hover-lift { transition: transform 0.2s ease; }
  .hover-lift:hover { transform: translateY(-2px); }
  .glass { backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #40444b; border-radius: 3px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #5865f2; }
`;

export default function Community() {
  // ===== ÉTATS PRINCIPAUX =====
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeChannel, setActiveChannel] = useState('general');
  const setView = useCryptoStore((state) => state.setView);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [isChannelLoading, setIsChannelLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [mentionUsers, setMentionUsers] = useState<{id: string, username: string, displayName?: string, avatar?: string}[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [replyingTo, setReplyingTo] = useState<{id: string, username: string, content: string} | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // ===== NOUVEAUX ÉTATS =====
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState('');
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const mentionsRef = useRef<HTMLDivElement>(null);
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [onlineUsersList, setOnlineUsersList] = useState<Array<{id: string; username: string; displayName: string; avatar: string; status: string; isAI?: boolean}>>([]);
  const [showOnlineUsers, setShowOnlineUsers] = useState(true);
  
  const [notifications, setNotifications] = useState<Array<{id: string; type: string; title: string; content: string; read: boolean; timestamp: Date}>>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [showProfile, setShowProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [dmChannels, setDmChannels] = useState<Channel[]>([]);
  const [activeDM, setActiveDM] = useState<string | null>(null);

  // ===== NOUVEAUX ÉTATS COMMUNITY FEATURES =====
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageReactions, setMessageReactions] = useState<Record<string, Record<string, string[]>>>({});
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [currentReputation, setCurrentReputation] = useState<{score: number; level: string; title: string; badge: string} | null>(null);

  // ===== ÉTATS SOCIAL TRADING =====
  const [signals, setSignals] = useState<ChatSignal[]>([]);
  const [sharedTrades, setSharedTrades] = useState<TradeShare[]>([]);
  const [communityLeaderboard, setCommunityLeaderboard] = useState<CommunityLeaderboardEntry[]>([]);
  const [userReputation, setUserReputation] = useState<UserReputation | null>(null);
  const [marketData, setMarketData] = useState<Record<string, MarketMiniData>>({});
  const [showSignalModal, setShowSignalModal] = useState(false);
  const [showTradeShareModal, setShowTradeShareModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [aiCommands, setAiCommands] = useState<EthernalCommand[]>([]);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState<string | null>(null);
  const [moderationWarnings, setModerationWarnings] = useState<string[]>([]);
  const [aiMemory, setAiMemory] = useState<AIMemory>({ 
    trustedUsers: [], 
    fakeSignallers: [], 
    topPerformers: [], 
    analyzedPatterns: {} 
  });

  // ===== NOUVEAUX ÉTATS - RÉSEAU SOCIAL COMPLET =====
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set());
  const [favoritedMessages, setFavoritedMessages] = useState<Set<string>>(new Set());
  const [onlineUsersReal, setOnlineUsersReal] = useState<OnlineUser[]>([]);
  const [showOnlineUsersSidebar, setShowOnlineUsersSidebar] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<any>(null);
  const [activeDMChannel, setActiveDMChannel] = useState<string | null>(null);
  const [dmMessages, setDmMessages] = useState<Record<string, Message[]>>({});
  const [unreadDMs, setUnreadDMs] = useState<Record<string, number>>({});
  const [showDMList, setShowDMList] = useState(false);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [mentionUsersAll, setMentionUsersAll] = useState<UserType[]>([]);
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifResults, setGifResults] = useState<string[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);

  // ===== PAGINATION MESSAGES =====
  const [visibleMessageCount, setVisibleMessageCount] = useState(50);
  const MESSAGES_PER_PAGE = 50;

  // ===== SONDAGES ET ÉVÉNEMENTS =====
  const [polls, setPolls] = useState<Array<{
    id: string;
    question: string;
    options: { id: string; text: string; votes: number; voters: string[] }[];
    createdBy: string;
    createdAt: Date;
    endsAt?: Date;
    totalVotes: number;
    userVoted?: string;
    channelId: string;
  }>>([
    {
      id: 'poll-1',
      question: 'Quelle crypto va pump cette semaine ?',
      options: [
        { id: 'opt1', text: 'BTC 🚀', votes: 42, voters: [] },
        { id: 'opt2', text: 'ETH 💎', votes: 38, voters: [] },
        { id: 'opt3', text: 'SOL ⚡', votes: 25, voters: [] },
        { id: 'opt4', text: 'DOGE 🐕', votes: 15, voters: [] }
      ],
      createdBy: 'TraderPro',
      createdAt: new Date(Date.now() - 86400000),
      endsAt: new Date(Date.now() + 172800000),
      totalVotes: 120,
      channelId: 'general'
    }
  ]);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [newPoll, setNewPoll] = useState({ question: '', options: ['', ''] });
  
  const [events, setEvents] = useState<Array<{
    id: string;
    title: string;
    description: string;
    startDate: Date;
    endDate?: Date;
    type: 'webinar' | 'ama' | 'trading-session' | 'competition';
    createdBy: string;
    attendees: string[];
    maxAttendees?: number;
    channelId: string;
    status: 'upcoming' | 'live' | 'ended';
  }>>([
    {
      id: 'event-1',
      title: 'AMA avec Ethernal AI',
      description: 'Session de questions-réponses avec notre intelligence artificielle de trading. Venez poser toutes vos questions!',
      startDate: new Date(Date.now() + 86400000),
      type: 'ama',
      createdBy: 'Admin',
      attendees: [],
      channelId: 'general',
      status: 'upcoming'
    },
    {
      id: 'event-2',
      title: 'Compétition de Trading',
      description: '24h de compétition avec un prix de 1000 USDT pour le meilleur trader!',
      startDate: new Date(Date.now() + 172800000),
      endDate: new Date(Date.now() + 259200000),
      type: 'competition',
      createdBy: 'Admin',
      attendees: ['user1', 'user2', 'user3'],
      maxAttendees: 100,
      channelId: 'general',
      status: 'upcoming'
    }
  ]);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', startDate: '', type: 'webinar' as const });

  // ===== RESPONSIVE =====
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ===== NOUVEAU SIGNAL =====
  const [newSignal, setNewSignal] = useState<Partial<ChatSignal>>({
    symbol: '',
    direction: 'buy',
    entryPrice: 0,
    stopLoss: 0,
    takeProfit: 0,
    confidence: 50,
    analysis: '',
    timeframe: '1h'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const prices = useCryptoStore((state) => state.prices);

  // ===== CHAT CHANNELS =====
  const textChannels: Channel[] = [
    { id: 'signals', name: 'signals', type: 'text', category: 'TRADING', description: 'Signaux de trading vérifiés', icon: 'Target', allowSignals: true, allowTrades: false },
    { id: 'analysis', name: 'analysis', type: 'text', category: 'TRADING', description: 'Analyses techniques', icon: 'BarChart3', allowSignals: false, allowTrades: false },
    { id: 'general', name: 'general', type: 'text', category: 'SOCIAL', description: 'Discussion générale', icon: 'MessageSquare', allowSignals: false, allowTrades: false },
    { id: 'futures', name: 'futures', type: 'text', category: 'TRADING', description: 'Trading futures', icon: 'TrendingUp', allowSignals: true, allowTrades: true },
    { id: 'risk-talk', name: 'risk-talk', type: 'text', category: 'SUPPORT', description: 'Gestion du risque', icon: 'Shield', allowSignals: false, allowTrades: false }
  ];

  const voiceChannels: Channel[] = [
    { id: 'voice-general', name: 'Général', type: 'voice', category: 'SOCIAL', description: 'Salon vocal général' },
    { id: 'voice-trading', name: 'Trading Room', type: 'voice', category: 'TRADING', description: 'Appel en direct traders' }
  ];

  const currentChannel = [...textChannels, ...voiceChannels, ...dmChannels].find(c => c.id === activeChannel) || textChannels[0];

  // ===== EFFETS =====
  useEffect(() => {
    const saved = localStorage.getItem('current_user');
    const adminStatus = sessionStorage.getItem('is_admin') === 'true';
    
    if (saved) {
      try {
        const user = JSON.parse(saved);
        setCurrentUser(user);
        setIsAdmin(adminStatus);
      } catch (e) {
        console.error('Failed to parse user:', e);
      }
    }

    loadAIMemory();
    fetchSocialData();
    fetchOnlineUsers();
    fetchAllUsers(); // Charger tous les utilisateurs pour les mentions
    fetchOnlineUsersReal(); // Charger les vrais membres en ligne
    loadNotifications();
    loadDMChannels();
    
    // Charger les GIFs trending
    giphyApi.trending(20).then(gifs => setGifResults(gifs));
    
    // Initialize Ethernal AI
    setOnlineUsersList([{
      id: 'ethernal-bot',
      username: 'Ethernal',
      displayName: '✨ Ethernal AI',
      avatar: 'https://ui-avatars.com/api/?name=Ethernal&background=5865f2&color=fff&size=128',
      status: 'online',
      isAI: true
    }]);

    // Socket setup
    const newSocket = io(API_URL, { transports: ['websocket', 'polling'] });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to chat server');
      newSocket.emit('join-channel', activeChannel);
    });

    newSocket.on('new-message', (message: Message) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
      if (soundEnabled && message.userId !== currentUser?.id) {
        playNotificationSound();
      }
    });

    newSocket.on('user-typing', (data: { username: string, channelId: string }) => {
      if (data.channelId === activeChannel) {
        setTypingUsers(prev => [...new Set([...prev, data.username])]);
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u !== data.username));
        }, 3000);
      }
    });

    newSocket.on('user-joined', (data: { userId: string, username: string, onlineCount: number }) => {
      setOnlineUsers(data.onlineCount);
    });

    newSocket.on('user-left', (data: { userId: string, onlineCount: number }) => {
      setOnlineUsers(data.onlineCount);
    });

    return () => {
      newSocket.close();
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (socket) {
      socket.emit('join-channel', activeChannel);
      fetchMessages();
    }
  }, [activeChannel, socket]);

  // Reset message count when changing channel
  useEffect(() => {
    setVisibleMessageCount(MESSAGES_PER_PAGE);
  }, [activeChannel]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowMessageSearch(prev => !prev);
      }
      // Escape to close search
      if (e.key === 'Escape') {
        setShowMessageSearch(false);
        setShowGifPicker(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ===== FONCTIONS =====
  const loadAIMemory = () => {
    try {
      const cached = localStorage.getItem('ethernal_memory');
      if (cached) {
        setAiMemory(JSON.parse(cached));
      }
    } catch (error) {
      console.error('Failed to load AI memory:', error);
    }
  };

  const saveAIMemory = (memory: AIMemory) => {
    localStorage.setItem('ethernal_memory', JSON.stringify(memory));
    setAiMemory(memory);
  };

  const loadNotifications = () => {
    try {
      const cached = localStorage.getItem('community_notifications');
      if (cached) {
        setNotifications(JSON.parse(cached));
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const loadDMChannels = () => {
    try {
      const cached = localStorage.getItem('dm_channels');
      if (cached) {
        setDmChannels(JSON.parse(cached));
      }
    } catch (error) {
      console.error('Failed to load DM channels:', error);
    }
  };

  const fetchMessages = async () => {
    setIsChannelLoading(true);
    setMessages([]);
    try {
      const res = await fetch(`${API_URL}/api/chat/messages?channel=${activeChannel}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      setMessages(data.messages || []);
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      // Demo fallback
      setMessages([
        {
          id: '1',
          userId: 'ethernal-bot',
          username: 'Ethernal',
          displayName: '✨ Ethernal AI',
          avatar: 'https://ui-avatars.com/api/?name=Ethernal&background=5865f2&color=fff',
          content: '👋 Bienvenue sur NEUROVEST Community! Je suis Ethernal, votre assistant IA. Mentionnez-moi avec @Ethernal pour obtenir de l\'aide.',
          channelId: activeChannel,
          likes: 42,
          timestamp: new Date(Date.now() - 3600000),
          isSystemMessage: true
        }
      ]);
    } finally {
      setIsChannelLoading(false);
    }
  };

  const fetchSocialData = async () => {
    try {
      const [signalsRes, tradesRes, leaderboardRes] = await Promise.all([
        fetch(`${API_URL}/api/social/signals`),
        fetch(`${API_URL}/api/social/trades`),
        fetch(`${API_URL}/api/social/leaderboard`)
      ]);

      if (signalsRes.ok) {
        const signalsData = await signalsRes.json();
        setSignals(signalsData.signals || []);
      }

      if (tradesRes.ok) {
        const tradesData = await tradesRes.json();
        setSharedTrades(tradesData.trades || []);
      }

      if (leaderboardRes.ok) {
        const leaderboardData = await leaderboardRes.json();
        setCommunityLeaderboard(leaderboardData.leaderboard || []);
      }
    } catch (error) {
      console.error('Failed to fetch social data:', error);
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/online`);
      if (res.ok) {
        const data = await res.json();
        setOnlineUsers(data.count || 0);
        if (data.users) {
          setOnlineUsersList(prev => {
            const existingIds = new Set(prev.map(u => u.id));
            const newUsers = data.users.filter((u: any) => !existingIds.has(u.id));
            return [...prev, ...newUsers];
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch online users:', error);
    }
  };

  // ===== NOUVELLES FONCTIONS - RÉSEAU SOCIAL COMPLET =====
  
  // Charger tous les utilisateurs pour les mentions
  const fetchAllUsers = async () => {
    try {
      const users = await usersApi.getAll(100);
      setAllUsers(users);
      // Add AI bot to mentions
      const withBot = [
        { id: 'ethernal-bot', username: 'Ethernal', displayName: '✨ Ethernal AI', avatar: '' },
        ...users
      ];
      setMentionUsersAll(withBot);
    } catch (error) {
      console.error('Failed to fetch all users:', error);
    }
  };

  // Charger les membres en ligne réels
  const fetchOnlineUsersReal = async () => {
    try {
      const users = await onlineUsersApi.getOnlineUsers();
      setOnlineUsersReal(users);
      setOnlineUsers(users.length);
    } catch (error) {
      console.error('Failed to fetch online users real:', error);
    }
  };

  // Toggle like sur un message avec animation
  const handleLikeMessage = async (messageId: string) => {
    try {
      const result = await messageLikeApi.toggleLike(messageId);
      
      // Update local state
      setLikedMessages(prev => {
        const newSet = new Set(prev);
        if (result.isLiked) {
          newSet.add(messageId);
        } else {
          newSet.delete(messageId);
        }
        return newSet;
      });

      // Update message likes count
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, likes: result.likes }
          : msg
      ));
    } catch (error) {
      console.error('Failed to like message:', error);
    }
  };

  // Toggle favori sur un message
  const handleFavoriteMessage = async (messageId: string) => {
    try {
      const result = await favoritesApi.toggleFavorite(messageId);
      
      setFavoritedMessages(prev => {
        const newSet = new Set(prev);
        if (result.isFavorited) {
          newSet.add(messageId);
        } else {
          newSet.delete(messageId);
        }
        return newSet;
      });
    } catch (error) {
      console.error('Failed to favorite message:', error);
    }
  };

  // Envoyer un message vocal
  const handleSendVoiceMessage = async (audioBlob: Blob, duration: number) => {
    try {
      setUploading(true);
      const result = await voiceApi.upload(audioBlob, duration);
      
      // Envoyer le message avec l'URL audio
      const res = await fetch(`${API_URL}/api/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content: '🎤 Message vocal',
          channelId: activeChannel,
          voiceUrl: result.audioUrl,
          voiceDuration: result.duration
        })
      });

      if (!res.ok) throw new Error('Failed to send voice message');
      
      const data = await res.json();
      
      if (socket) {
        socket.emit('send-message', data.message);
      }
      
      setIsRecordingVoice(false);
    } catch (error) {
      console.error('Failed to send voice message:', error);
      alert('Erreur lors de l\'envoi du message vocal');
    } finally {
      setUploading(false);
    }
  };

  // Rechercher des GIFs
  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      const trending = await giphyApi.trending(20);
      setGifResults(trending);
      return;
    }
    
    setIsLoadingGifs(true);
    try {
      const results = await giphyApi.search(query, 20);
      setGifResults(results);
    } catch (error) {
      console.error('Failed to search GIFs:', error);
    } finally {
      setIsLoadingGifs(false);
    }
  };

  // Sélectionner un GIF
  const handleSelectGif = async (gifUrl: string) => {
    try {
      const res = await fetch(`${API_URL}/api/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content: gifUrl,
          channelId: activeChannel,
          isGif: true
        })
      });

      if (!res.ok) throw new Error('Failed to send GIF');
      
      const data = await res.json();
      
      if (socket) {
        socket.emit('send-message', data.message);
      }
      
      setShowGifPicker(false);
    } catch (error) {
      console.error('Failed to send GIF:', error);
    }
  };

  // Ouvrir le profil d'un utilisateur
  const openUserProfileFull = async (username: string) => {
    try {
      const profile = await profileApi.getProfile(username);
      setSelectedUserProfile(profile);
      setShowUserProfileModal(true);
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  };

  // Démarrer un DM
  const startDMReal = async (userId: string, username: string, displayName: string) => {
    const channelId = `dm-${userId}`;
    
    // Créer le canal DM s'il n'existe pas
    if (!dmChannels.find(c => c.id === channelId)) {
      const newChannel: Channel = {
        id: channelId,
        name: displayName || username,
        type: 'dm',
        category: 'DM',
        description: `Conversation avec ${username}`,
        icon: 'Mail'
      };
      setDmChannels(prev => [...prev, newChannel]);
    }
    
    setActiveDMChannel(channelId);
    setActiveChannel(channelId);
    setActiveTab('chat');
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {}
  };

  const moderateMessage = async (content: string) => {
    const spamPatterns = [
      /(spam|scam|fraud)/gi,
      /(buy now|limited time|act fast)/gi,
      /\b[A-Z]{5,}\b/g
    ];
    
    for (const pattern of spamPatterns) {
      if (pattern.test(content)) {
        return { allowed: false, reason: 'Contenu potentiellement spam détecté' };
      }
    }
    
    if (content.length > 1000) {
      return { allowed: false, reason: 'Message trop long' };
    }
    
    return { allowed: true };
  };

  const analyzeMessageWithAI = async (content: string) => {
    const tradingPatterns = {
      signal: /(buy|sell|long|short|entry|target|stop loss|tp|sl)/gi,
      symbol: /\b(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|SHIB|^[A-Z]{3,5}USDT$)\b/gi,
      analysis: /(support|resistance|trend|breakout|pump|dump)/gi,
      sentiment: /(bullish|bearish|moon|crash| ATH)/gi
    };
    
    const hasSignal = tradingPatterns.signal.test(content);
    const hasSymbol = tradingPatterns.symbol.test(content);
    const hasAnalysis = tradingPatterns.analysis.test(content);
    const hasSentiment = tradingPatterns.sentiment.test(content);
    
    return {
      isSignal: hasSignal && hasSymbol,
      hasAnalysis,
      sentiment: hasSentiment ? (content.match(/bullish|moon|pump/gi) ? 'bullish' : 'bearish') : 'neutral',
      warnings: []
    };
  };

  const handleAICommand = async (message: string) => {
    setIsAIProcessing(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const lowerMsg = message.toLowerCase();
    let response = '';
    
    if (lowerMsg.includes('signal') || lowerMsg.includes('analyse')) {
      response = `📊 **Analyse de marché**\n\nJe détecte plusieurs opportunités intéressantes aujourd'hui:\n\n• BTC/USDT: Support fort à $41,200\n• ETH/USDT: Résistance à $2,800 à surveiller\n• SOL/USDT: Momentum haussier confirmé\n\nSouhaitez-vous que je formalise un signal pour l'une de ces paires?`;
    } else if (lowerMsg.includes('risk') || lowerMsg.includes('risque')) {
      response = `⚠️ **Gestion du Risque**\n\nRappels importants:\n\n1. Risk/Reward minimum 1:2\n2. Position size: max 2% par trade\n3. Utilisez toujours un stop loss\n4. Diversifiez vos positions\n\nVotre risk management est la clé de la survie sur les marchés!`;
    } else if (lowerMsg.includes('help') || lowerMsg.includes('aide')) {
      response = `🤖 **Commandes disponibles:**\n\n• @Ethernal analyse [symbol] - Analyse technique\n• @Ethernal signal [symbol] [direction] - Créer un signal\n• @Ethernal risk - Conseils de gestion du risque\n• @Ethernal validate [message] - Valider un signal\n• @Ethernal portfolio - Analyse de portefeuille\n• @Ethernal market - Vue d'ensemble du marché`;
    } else {
      response = `🤖 **Ethernal AI**\n\nJe peux vous aider avec:\n\n• 📊 Analyses techniques\n• 🎯 Validation de signaux\n• ⚠️ Conseils de risk management\n• 📈 Vue d'ensemble du marché\n\nTapez **@Ethernal help** pour voir toutes les commandes.`;
    }
    
    const aiMessage: Message = {
      id: `ethernal-${Date.now()}`,
      userId: 'ethernal-bot',
      username: 'Ethernal',
      displayName: '✨ Ethernal AI',
      avatar: 'https://ui-avatars.com/api/?name=Ethernal&background=5865f2&color=fff',
      content: response,
      channelId: activeChannel,
      likes: 0,
      timestamp: new Date(),
      isSystemMessage: true
    };
    
    setMessages(prev => [...prev, aiMessage]);
    setIsAIProcessing(false);
  };

  const sendMessage = async () => {
    if (!currentUser || (!newMessage.trim() && selectedFiles.length === 0)) return;

    if (newMessage.toLowerCase().includes('@ethernal')) {
      await handleAICommand(newMessage);
      setNewMessage('');
      return;
    }

    try {
      let attachments: any[] = [];
      if (selectedFiles.length > 0) {
        attachments = await uploadFiles(selectedFiles);
      }

      const moderation = await moderateMessage(newMessage);
      if (!moderation.allowed) {
        setModerationWarnings(prev => [...prev, moderation.reason || 'Message non autorisé']);
        return;
      }

      const aiAnalysis = await analyzeMessageWithAI(newMessage);

      const messageData = {
        content: newMessage,
        channelId: activeChannel,
        userId: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.displayName || currentUser.username,
        avatar: currentUser.avatar?.replace(/^http:/, 'https:') || `https://ui-avatars.com/api/?name=${currentUser.username}&background=random`,
        replyTo: replyingTo,
        attachments,
        mentions: newMessage.match(/@(\w+)/g)?.map(m => m.slice(1)) || []
      };

      if (socket) {
        socket.emit('send-message', messageData);
      }

      // Local optimistic update
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        userId: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.displayName || currentUser.username,
        avatar: currentUser.avatar?.replace(/^http:/, 'https:') || `https://ui-avatars.com/api/?name=${currentUser.username}&background=random`,
        content: newMessage,
        channelId: activeChannel,
        likes: 0,
        timestamp: new Date(),
        replyTo: replyingTo ? { username: replyingTo.username, content: replyingTo.content } : undefined,
        attachments,
        mentions: messageData.mentions
      };

      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      setReplyingTo(null);
      setSelectedFiles([]);
      scrollToBottom();

      if (aiAnalysis.isSignal && aiAnalysis.warnings.length === 0) {
        setShowSignalModal(true);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // ===== UPLOAD FILES =====
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  };

  const uploadFiles = async (files: File[]) => {
    setUploading(true);
    setUploadProgress(0);
    const uploadedAttachments: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formData
        });

        if (res.ok) {
          const data = await res.json();
          uploadedAttachments.push({
            type: file.type.startsWith('image/') ? 'image' : 'file',
            url: data.url,
            name: file.name,
            size: file.size
          });
        }
      } catch (error) {
        console.error('Upload failed:', error);
      }
      setUploadProgress(((i + 1) / files.length) * 100);
    }

    setUploading(false);
    setSelectedFiles([]);
    return uploadedAttachments;
  };

  // ===== EMOJI =====
  const insertEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // ===== MENTIONS =====
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart || 0;
    setNewMessage(value);
    setCursorPosition(cursor);

    const beforeCursor = value.substring(0, cursor);
    const atIndex = beforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1 && (atIndex === 0 || value[atIndex - 1] === ' ')) {
      const search = beforeCursor.substring(atIndex + 1);
      if (!search.includes(' ')) {
        setMentionSearch(search.toLowerCase());
        setShowMentions(true);
        setMentionIndex(0);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (user: any) => {
    const beforeCursor = newMessage.substring(0, cursorPosition);
    const afterCursor = newMessage.substring(cursorPosition);
    const atIndex = beforeCursor.lastIndexOf('@');
    
    const newValue = beforeCursor.substring(0, atIndex) + `@${user.username} ` + afterCursor;
    setNewMessage(newValue);
    setShowMentions(false);
  };

  const filteredMentions = mentionUsers.filter(user => 
    user.username.toLowerCase().includes(mentionSearch) ||
    (user.displayName?.toLowerCase() || '').includes(mentionSearch)
  );

  // Add special mentions for admins
  const getSpecialMentions = () => {
    if (!isAdmin) return [];
    const specialMentions = [
      { id: 'everyone', username: 'everyone', displayName: '👥 @everyone - Tous les utilisateurs' },
      { id: 'here', username: 'here', displayName: '🔔 @here - Utilisateurs en ligne' }
    ];
    return specialMentions.filter(m => 
      m.username.toLowerCase().includes(mentionSearch) ||
      m.displayName.toLowerCase().includes(mentionSearch)
    );
  };

  const allMentions = [...filteredMentions, ...getSpecialMentions()];

  // ===== FOLLOW/UNFOLLOW =====
  const handleFollowUser = async (userId: string) => {
    try {
      await fetch(`${API_URL}/api/social/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ userId })
      });
      addNotification({
        id: Date.now().toString(),
        type: 'follow',
        title: 'Nouveau follower',
        content: 'Vous suivez maintenant cet utilisateur',
        read: false,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to follow:', error);
    }
  };

  const handleUnfollowUser = async (userId: string) => {
    try {
      await fetch(`${API_URL}/api/social/unfollow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ userId })
      });
    } catch (error) {
      console.error('Failed to unfollow:', error);
    }
  };

  // ===== PROFIL UTILISATEUR =====
  const openUserProfile = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}/profile`);
      if (res.ok) {
        const profile = await res.json();
        setSelectedUser(profile);
        setShowProfile(true);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  // ===== DM =====
  const startDM = (userId: string, username: string, displayName: string, avatar: string) => {
    const channelId = `dm-${[currentUser?.id, userId].sort().join('-')}`;
    
    const newDM: Channel = {
      id: channelId,
      name: displayName || username,
      type: 'text',
      category: 'DM',
      description: `DM avec ${username}`,
      allowSignals: false,
      allowTrades: false
    };
    
    const existing = dmChannels.find(c => c.id === channelId);
    if (!existing) {
      const updated = [...dmChannels, newDM];
      setDmChannels(updated);
      localStorage.setItem('dm_channels', JSON.stringify(updated));
    }
    
    setActiveDM(channelId);
    setActiveChannel(channelId);
  };

  // ===== NOTIFICATIONS =====
  const addNotification = (notification: any) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  // ===== GESTION SIGNAUX =====
  const handleCreateSignal = async () => {
    if (!currentUser || !newSignal.symbol) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/social/signals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newSignal,
          userId: currentUser.id,
          username: currentUser.username,
          avatar: currentUser.avatar
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSignals(prev => [data.signal, ...prev]);
        setShowSignalModal(false);
        setNewSignal({
          symbol: '',
          direction: 'buy',
          entryPrice: 0,
          stopLoss: 0,
          takeProfit: 0,
          confidence: 50,
          analysis: '',
          timeframe: '1h'
        });
      }
    } catch (error) {
      console.error('Failed to create signal:', error);
    }
  };

  const handleVoteSignal = async (signalId: string, vote: 'bullish' | 'bearish') => {
    try {
      const res = await fetch(`${API_URL}/api/social/signals/${signalId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ vote })
      });

      if (res.ok) {
        setSignals(prev => prev.map(s => {
          if (s.id !== signalId) return s;
          const currentBullish = s.votes?.bullish ?? 0;
          const currentBearish = s.votes?.bearish ?? 0;
          return { 
            ...s, 
            votes: { 
              bullish: vote === 'bullish' ? currentBullish + 1 : currentBullish,
              bearish: vote === 'bearish' ? currentBearish + 1 : currentBearish,
              userVote: vote
            } 
          };
        }));
      }
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handleShareTrade = async (trade: TradeShare) => {
    try {
      const res = await fetch(`${API_URL}/api/social/trades`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(trade)
      });

      if (res.ok) {
        const data = await res.json();
        setSharedTrades(prev => [data.trade, ...prev]);
        setShowTradeShareModal(false);
      }
    } catch (error) {
      console.error('Failed to share trade:', error);
    }
  };

  const handleCopyTrade = async (tradeId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/social/trades/${tradeId}/copy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (res.ok) {
        addNotification({
          id: Date.now().toString(),
          type: 'copy',
          title: 'Trade copié',
          content: 'Le trade a été copié dans votre portefeuille',
          read: false,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Failed to copy trade:', error);
    }
  };

  const cancelReply = () => setReplyingTo(null);

  // ===== NOUVELLES FONCTIONS =====
  const handleGifSelect = async (gifUrl: string) => {
    if (!currentUser) return;
    
    const messageData = {
      content: gifUrl,
      channelId: activeChannel,
      userId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.displayName || currentUser.username,
      avatar: currentUser.avatar?.replace(/^http:/, 'https:') || `https://ui-avatars.com/api/?name=${currentUser.username}&background=random`,
      replyTo: null,
      attachments: [{
        type: 'image' as const,
        url: gifUrl,
        name: 'GIF',
        size: 0
      }],
      mentions: [],
      isGif: true
    };

    if (socket) {
      socket.emit('send-message', messageData);
    }
    
    setShowGifPicker(false);
    scrollToBottom();
  };

  const handleSearchJump = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('animate-pulse');
      setTimeout(() => element.classList.remove('animate-pulse'), 2000);
    }
    setShowMessageSearch(false);
  };

  const handleMessageReaction = async (messageId: string, reactions: Record<string, string[]>) => {
    setMessageReactions(prev => ({
      ...prev,
      [messageId]: reactions
    }));
  };

  const handlePinMessage = (message: Message) => {
    const isPinned = pinnedMessages.some(m => m.id === message.id);
    if (isPinned) {
      setPinnedMessages(prev => prev.filter(m => m.id !== message.id));
    } else {
      setPinnedMessages(prev => [message, ...prev].slice(0, 10)); // Max 10 pinned
    }
  };

  const calculateUserReputation = (stats: any) => {
    const score = reputationUtils.calculateScore({
      winRate: stats?.winRate || 0,
      totalProfit: stats?.totalProfit || 0,
      signalAccuracy: stats?.signalAccuracy || 0,
      followers: stats?.followers || 0,
      isVerified: stats?.isVerified || false,
      isPro: stats?.isPro || false,
      reportCount: 0
    });
    return reputationUtils.getLevel(score);
  };

  const handleLogout = () => {
    localStorage.removeItem('current_user');
    sessionStorage.removeItem('is_admin');
    setCurrentUser(null);
    if (socket) socket.disconnect();
    window.location.reload();
  };

  // ===== RENDU =====
  return (
    <div className="h-full flex bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <style>{globalStyles}</style>
      
      {/* ===== SIDEBAR GAUCHE - Mobile: Drawer, Desktop: Fixed ===== */}
      <div className={`fixed lg:static inset-y-0 left-0 z-40 w-72 lg:w-60 bg-slate-900/95 lg:bg-slate-900/80 backdrop-blur-xl flex flex-col border-r border-slate-700/50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Header - Modern with Mobile Close */}
        <div className="p-4 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-white text-lg">Community</span>
                <p className="text-[10px] text-slate-400">NEUROVEST Social</p>
              </div>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Channels - Modern */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {/* Text Channels */}
          <div>
            <div className="flex items-center gap-2 px-2 mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <div className="p-1 rounded bg-indigo-500/20">
                <Hash className="w-3 h-3 text-indigo-400" />
              </div>
              Canaux Textuels
              <div className="flex-1 h-px bg-slate-700/50 ml-2"></div>
            </div>
            <div className="space-y-1">
              {textChannels.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => { setActiveChannel(channel.id); setActiveTab('chat'); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 group ${
                    activeChannel === channel.id
                      ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/10 text-white border-l-2 border-indigo-500 shadow-lg shadow-indigo-500/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 hover:translate-x-1'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg transition-all ${
                    activeChannel === channel.id 
                      ? 'bg-indigo-500/20' 
                      : 'bg-slate-800 group-hover:bg-slate-700'
                  }`}>
                    {channel.id === 'signals' ? <Target className="w-4 h-4" /> :
                     channel.id === 'analysis' ? <BarChart3 className="w-4 h-4" /> :
                     channel.id === 'futures' ? <TrendingUp className="w-4 h-4" /> :
                     <MessageSquare className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-medium truncate block">{channel.name}</span>
                    {channel.description && (
                      <span className="text-[10px] text-slate-500 truncate block">{channel.description}</span>
                    )}
                  </div>
                  {channel.allowSignals && (
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded font-medium">S</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Channels */}
          <div>
            <div className="flex items-center gap-2 px-2 mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <div className="p-1 rounded bg-purple-500/20">
                <Volume2 className="w-3 h-3 text-purple-400" />
              </div>
              Canaux Vocaux
              <div className="flex-1 h-px bg-slate-700/50 ml-2"></div>
            </div>
            <div className="space-y-1">
              {voiceChannels.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => { setActiveChannel(channel.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 group ${
                    activeChannel === channel.id
                      ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/10 text-white border-l-2 border-purple-500 shadow-lg shadow-purple-500/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 hover:translate-x-1'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg transition-all ${
                    activeChannel === channel.id 
                      ? 'bg-purple-500/20' 
                      : 'bg-slate-800 group-hover:bg-slate-700'
                  }`}>
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-medium truncate block">{channel.name}</span>
                    <span className="text-[10px] text-slate-500 truncate block">
                      {channel.id === 'trading-floor' ? '5 connectés 🔴' : 'En ligne'}
                    </span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                </button>
              ))}
            </div>
          </div>

          {/* DM Channels - Modern */}
          {dmChannels.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-2 mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <div className="p-1 rounded bg-pink-500/20">
                  <Mail className="w-3 h-3 text-pink-400" />
                </div>
                Messages Privés
                <div className="flex-1 h-px bg-slate-700/50 ml-2"></div>
              </div>
              <div className="space-y-1">
                {dmChannels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => { setActiveChannel(channel.id); setActiveDM(channel.id); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 group ${
                      activeChannel === channel.id
                        ? 'bg-gradient-to-r from-pink-500/20 to-rose-500/10 text-white border-l-2 border-pink-500'
                        : 'text-slate-400 hover:text-white hover:bg-white/5 hover:translate-x-1'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg transition-all ${
                      activeChannel === channel.id 
                        ? 'bg-pink-500/20' 
                        : 'bg-slate-800 group-hover:bg-slate-700'
                    }`}>
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="font-medium truncate block">{channel.name}</span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile - Modern */}
        <div className="p-3 bg-gradient-to-r from-slate-800/80 to-slate-900/80 backdrop-blur border-t border-slate-700/50 flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold text-white shadow-lg overflow-hidden">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar.replace(/^http:/, 'https:')}
                  alt={currentUser.displayName || currentUser.username}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                currentUser?.displayName?.[0] || currentUser?.username?.[0] || '?'
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-slate-800"></div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate text-white">{currentUser?.displayName || currentUser?.username}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">@{currentUser?.username}</span>
              {currentReputation && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  currentReputation.level === 'master' ? 'bg-amber-500/20 text-amber-400' :
                  currentReputation.level === 'expert' ? 'bg-purple-500/20 text-purple-400' :
                  currentReputation.level === 'verified' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-slate-600/30 text-slate-400'
                }`}>
                  {currentReputation.badge}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <button 
              onClick={() => setView('profile')} 
              className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
              title="Mon profil"
            >
              <User className="w-4 h-4" />
            </button>
            <button 
              onClick={handleLogout} 
              className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-all"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900/30 overflow-hidden">
        {/* Header - Modern Glassmorphism */}
        <div className="h-14 lg:h-16 border-b border-slate-700/50 flex items-center justify-between px-3 lg:px-5 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-2 lg:gap-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className={`p-1.5 lg:p-2 rounded-xl ${currentChannel.type === 'voice' ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-400' : 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400'} shadow-lg`}>
              {currentChannel.type === 'voice' ? <Volume2 className="w-4 h-4 lg:w-5 lg:h-5" /> : <Hash className="w-4 h-4 lg:w-5 lg:h-5" />}
            </div>
            <div className="min-w-0">
              <span className="font-bold text-white text-sm lg:text-base truncate">{currentChannel.name}</span>
              <p className="text-xs text-slate-400 hidden sm:block">{currentChannel.description}</p>
            </div>
            {/* Badges du canal */}
            <div className="hidden md:flex items-center gap-2">
              {currentChannel.allowSignals && (
                <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-[10px] rounded-full border border-green-500/20 font-medium">
                  Signaux activés
                </span>
              )}
              {currentChannel.allowTrades && (
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded-full border border-blue-500/20 font-medium">
                  Trades partagés
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-0.5 lg:gap-1">
            {currentChannel.allowSignals && (
              <button
                onClick={() => setShowSignalModal(true)}
                className="flex items-center gap-1 px-2 lg:px-3 py-1.5 lg:py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all text-xs font-medium"
              >
                <Target className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Signal</span>
              </button>
            )}
            
            {/* Notifications - Modern */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 lg:p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200 group"
              >
                <Bell className="w-4 h-4 lg:w-5 lg:h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gradient-to-br from-red-500 to-pink-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold shadow-lg animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 top-full mt-3 w-80 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl z-50 max-h-96 overflow-hidden">
                  <div className="p-3 border-b border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-indigo-400" />
                      <span className="font-semibold text-sm text-white">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded-full font-medium">
                          {unreadCount} nouvelle{unreadCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllNotificationsRead}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                      >
                        Tout lire
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center">
                        <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm">Aucune notification</p>
                      </div>
                    ) : (
                      notifications.slice(0, 10).map(notif => (
                        <div 
                          key={notif.id}
                          className={`p-3 border-b border-slate-700/30 hover:bg-white/5 cursor-pointer transition-all ${!notif.read ? 'bg-indigo-500/5' : ''}`}
                          onClick={() => markNotificationRead(notif.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!notif.read ? 'bg-indigo-500 shadow-lg shadow-indigo-500/50' : 'bg-transparent'}`}></div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-white mb-0.5">{notif.title}</div>
                              <div className="text-xs text-slate-400 line-clamp-2">{notif.content}</div>
                              <div className="text-[10px] text-slate-500 mt-1.5">{new Date(notif.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowMessageSearch(!showMessageSearch)}
              className={`p-2 lg:p-2.5 rounded-xl transition-all duration-200 ${showMessageSearch ? 'bg-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
              title="Rechercher (Ctrl+K)"
            >
              <Search className="w-4 h-4 lg:w-5 lg:h-5" />
            </button>

            <button 
              onClick={() => setShowOnlineUsersSidebar(!showOnlineUsersSidebar)}
              className={`relative p-2 lg:p-2.5 rounded-xl transition-all duration-200 ${showOnlineUsersSidebar ? 'bg-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
              title="Utilisateurs en ligne"
            >
              <Users className="w-4 h-4 lg:w-5 lg:h-5" />
              {onlineUsersReal.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {onlineUsersReal.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Message Search */}
        {showMessageSearch && (
          <MessageSearch
            messages={messages}
            onJumpToMessage={handleSearchJump}
            onClose={() => setShowMessageSearch(false)}
          />
        )}

        {/* Navigation Tabs - Modern Pills */}
        <div className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-4 py-2 lg:py-3 border-b border-slate-700/50 bg-slate-900/40 backdrop-blur-sm overflow-x-auto custom-scrollbar">
          {[
            { id: 'chat', label: 'Chat', icon: MessageSquare, color: 'from-indigo-500 to-purple-500', desc: 'Discussions' },
            { id: 'signals', label: 'Signaux', icon: Target, color: 'from-green-500 to-emerald-500', desc: 'Trading' },
            { id: 'trades', label: 'Trades', icon: BarChart3, color: 'from-blue-500 to-cyan-500', desc: 'Performance' },
            { id: 'polls', label: 'Sondages', icon: Activity, color: 'from-pink-500 to-rose-500', desc: 'Votes' },
            { id: 'events', label: 'Événements', icon: Sparkles, color: 'from-amber-500 to-yellow-500', desc: 'Agenda' },
            { id: 'leaderboard', label: 'Classement', icon: Award, color: 'from-violet-500 to-purple-500', desc: 'Top traders' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-medium transition-all duration-200 group flex-shrink-0 ${
                activeTab === tab.id
                  ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className={`p-1 lg:p-1.5 rounded-lg transition-all ${activeTab === tab.id ? 'bg-white/20' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
                <tab.icon className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </div>
              <div className="hidden sm:block text-left">
                <span className="block">{tab.label}</span>
                <span className={`text-[10px] block ${activeTab === tab.id ? 'text-white/70' : 'text-slate-500'}`}>{tab.desc}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden flex">
          {activeTab === 'chat' && currentChannel.type === 'text' && (
            <div className="flex-1 flex flex-col min-w-0">
              <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-0 custom-scrollbar"
              >
                {/* Pinned Messages - Modern */}
                {pinnedMessages.length > 0 && (
                  <div className="mb-4 p-3 bg-gradient-to-r from-amber-500/10 to-yellow-500/5 border border-amber-500/20 rounded-xl backdrop-blur-sm">
                    <button 
                      onClick={() => setShowPinnedMessages(!showPinnedMessages)}
                      className="flex items-center gap-3 w-full group"
                    >
                      <div className="p-1.5 bg-amber-500/20 rounded-lg">
                        <Pin className="w-4 h-4 text-amber-400" />
                      </div>
                      <span className="text-sm font-semibold text-amber-400">{pinnedMessages.length} message{pinnedMessages.length > 1 ? 's' : ''} épinglé{pinnedMessages.length > 1 ? 's' : ''}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 ml-auto transition-transform duration-200 ${showPinnedMessages ? 'rotate-180' : ''}`} />
                    </button>
                    {showPinnedMessages && (
                      <div className="mt-2 space-y-1">
                        {pinnedMessages.slice(0, 3).map(msg => (
                          <div 
                            key={msg.id} 
                            onClick={() => handleSearchJump(msg.id!)}
                            className="p-1.5 bg-[#1e1f22]/50 rounded cursor-pointer hover:bg-[#2f3136] transition-colors"
                          >
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-medium text-white text-xs">{msg.username}</span>
                              <span className="text-gray-500 line-clamp-1">{msg.content.slice(0, 60)}...</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {isChannelLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
                    <p>Aucun message dans ce canal</p>
                    <p className="text-sm mt-2">Soyez le premier à poster!</p>
                  </div>
                ) : (
                  <>
                    {/* Charger plus de messages */}
                    {messages.length > visibleMessageCount && (
                      <div className="flex justify-center py-4">
                        <button
                          onClick={() => setVisibleMessageCount(prev => prev + MESSAGES_PER_PAGE)}
                          className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-sm rounded-lg transition-all border border-slate-700/50"
                        >
                          Charger {MESSAGES_PER_PAGE} messages précédents
                        </button>
                      </div>
                    )}
                    {messages.slice(-visibleMessageCount).map((message, index) => (
                    <div 
                      id={`message-${message.id}`}
                      key={message.id || index}
                      className={`flex gap-2 lg:gap-4 px-3 lg:px-4 py-2 lg:py-3 hover:bg-white/5 animate-slideIn group ${message.isSystemMessage ? 'bg-indigo-500/10 rounded-lg' : ''} ${pinnedMessages.some(m => m.id === message.id) ? 'border-l-2 border-amber-500 pl-2 lg:pl-3' : ''}`}
                    >
                      <div className="flex-shrink-0">
                        {message.userId === 'ethernal-bot' ? (
                          <div className="relative w-8 h-8 lg:w-10 lg:h-10 group">
                            {/* Animated glow ring */}
                            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-600 animate-pulse blur-sm opacity-75 group-hover:opacity-100 transition-opacity"></div>
                            {/* Main avatar */}
                            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 border-2 border-white/20">
                              <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-white animate-pulse" />
                            </div>
                            {/* AI indicator dot */}
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 bg-cyan-400 shadow-lg shadow-cyan-400/50"></span>
                          </div>
                        ) : (
                          <div 
                            className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all shadow-lg"
                            onClick={() => message.userId && openUserProfile(message.userId)}
                          >
                            {message.avatar ? (
                              <img 
                                src={message.avatar} 
                                alt={message.username}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = `https://ui-avatars.com/api/?name=${message.username}&background=random`;
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm lg:text-base">
                                {message.displayName?.[0] || message.username[0]}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span 
                            className={`font-semibold cursor-pointer hover:underline ${
                              message.userId === 'ethernal-bot' ? 'bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent' : 'text-white'
                            }`}
                            onClick={() => message.userId && message.userId !== 'ethernal-bot' && openUserProfile(message.userId)}
                          >
                            {message.displayName}
                          </span>
                          {message.userId === 'ethernal-bot' && (
                            <span className="px-2 py-0.5 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-400 text-xs rounded-lg font-bold border border-cyan-500/30 shadow-sm shadow-cyan-500/10 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              AI
                            </span>
                          )}
                          <span className="text-xs text-slate-500">
                            {message.timestamp instanceof Date 
                              ? message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                              : new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                            }
                          </span>
                        </div>
                        
                        {message.replyTo && (
                          <div className="mb-2 p-2 bg-slate-800/50 rounded-lg text-sm text-slate-400 border-l-2 border-indigo-500">
                            <span className="text-indigo-400 font-medium">@{message.replyTo.username}</span>
                            <p className="truncate">{message.replyTo.content}</p>
                          </div>
                        )}
                        
                        <div className="text-slate-200 whitespace-pre-wrap break-words text-sm lg:text-base">
                          {/* Affichage des GIFs */}
                          {message.isGif ? (
                            <img 
                              src={message.content} 
                              alt="GIF"
                              className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(message.content, '_blank')}
                            />
                          ) : (
                            message.content
                          )}
                        </div>

                        {/* Message Vocal */}
                        {message.voiceUrl && (
                          <div className="mt-2">
                            <VoicePlayer 
                              audioUrl={`${API_URL}${message.voiceUrl}`} 
                              duration={message.voiceDuration || 0} 
                            />
                          </div>
                        )}

                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {message.attachments.map((att, i) => (
                              <div key={i} className="relative">
                                {att.type === 'image' ? (
                                  <img 
                                    src={att.url} 
                                    alt={att.name}
                                    className="max-w-xs max-h-48 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => window.open(att.url, '_blank')}
                                  />
                                ) : (
                                  <a 
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2 bg-[#40444b] rounded-lg text-sm hover:bg-[#4f545c] transition-colors"
                                  >
                                    <FileText className="w-4 h-4 text-[#5865f2]" />
                                    <span className="text-gray-300">{att.name}</span>
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 mt-2">
                          {/* Message Actions - Compact avec animations */}
                          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setReplyingTo({
                                id: message.id!,
                                username: message.username,
                                content: message.content
                              })}
                              className="p-1 text-gray-500 hover:text-[#5865f2] hover:bg-[#5865f2]/10 rounded transition-colors"
                              title="Répondre"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            
                            {/* Like avec animation */}
                            <button 
                              onClick={() => handleLikeMessage(message.id!)}
                              className={`p-1 rounded transition-all duration-200 flex items-center gap-1 ${
                                likedMessages.has(message.id!) || message.likedBy?.includes(currentUser?.id || '')
                                  ? 'text-red-500 bg-red-500/10 scale-110' 
                                  : 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'
                              }`}
                              title={likedMessages.has(message.id!) ? 'Je n\'aime plus' : 'J\'aime'}
                            >
                              <Heart 
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  likedMessages.has(message.id!) ? 'fill-current animate-pulse' : ''
                                }`} 
                              />
                              {(message.likes || 0) > 0 && (
                                <span className="text-xs">{message.likes}</span>
                              )}
                            </button>
                            
                            {/* Favori */}
                            <button 
                              onClick={() => handleFavoriteMessage(message.id!)}
                              className={`p-1 rounded transition-all duration-200 ${
                                favoritedMessages.has(message.id!)
                                  ? 'text-yellow-500 bg-yellow-500/10 scale-110' 
                                  : 'text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10'
                              }`}
                              title={favoritedMessages.has(message.id!) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                            >
                              <Star 
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  favoritedMessages.has(message.id!) ? 'fill-current' : ''
                                }`} 
                              />
                            </button>
                            
                            {/* Épingler */}
                            <button 
                              onClick={() => handlePinMessage(message)}
                              className={`p-1 rounded transition-colors ${
                                pinnedMessages.some(m => m.id === message.id) 
                                  ? 'text-blue-500 bg-blue-500/10' 
                                  : 'text-gray-500 hover:text-blue-400 hover:bg-blue-500/10'
                              }`}
                              title={pinnedMessages.some(m => m.id === message.id) ? 'Désépingler' : 'Épingler'}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          {/* Message Reactions - Compact */}
                          {!message.isSystemMessage && (
                            <div className="mt-1">
                              <MessageReactions
                                messageId={message.id!}
                                reactions={messageReactions[message.id!] || {}}
                                currentUserId={currentUser?.id || 'anonymous'}
                                onReactionChange={(reactions) => handleMessageReaction(message.id!, reactions)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input Area - Modern */}
              <div className="p-2 lg:p-3 border-t border-slate-700/50 bg-slate-900/60 backdrop-blur-sm">
                {replyingTo && (
                  <div className="mb-2 px-3 py-1.5 bg-indigo-500/10 rounded-lg flex items-center justify-between border border-indigo-500/20">
                    <div className="text-xs text-slate-400">
                      Réponse à <span className="text-indigo-400">@{replyingTo.username}</span>
                    </div>
                    <button onClick={cancelReply} className="text-slate-500 hover:text-white p-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Selected Files */}
                {selectedFiles.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {selectedFiles.map((file, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 rounded-lg text-xs border border-indigo-500/20">
                        <FileText className="w-3 h-3 text-indigo-400" />
                        <span className="text-slate-300 truncate max-w-[120px]">{file.name}</span>
                        <button 
                          onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-slate-400 hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="relative">
                  {/* Voice Message Recorder */}
                  {isRecordingVoice ? (
                    <VoiceMessage 
                      onSend={handleSendVoiceMessage}
                      onCancel={() => setIsRecordingVoice(false)}
                    />
                  ) : (
                  <div className="flex items-center gap-1 lg:gap-2 bg-slate-800/80 backdrop-blur-xl rounded-xl lg:rounded-2xl px-2 lg:px-3 py-1.5 lg:py-2 border border-slate-700/50 shadow-xl focus-within:border-indigo-500/50 focus-within:shadow-indigo-500/10 transition-all duration-200">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      multiple
                      accept="image/*,application/pdf"
                      className="hidden"
                    />
                    
                    {/* Actions groupe 1 - Attachments */}
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 lg:p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg lg:rounded-xl transition-all duration-200"
                      title="Joindre un fichier"
                    >
                      <Plus className="w-4 h-4 lg:w-5 lg:h-5" />
                    </button>
                    
                    {/* Input */}
                    <input
                      ref={inputRef}
                      type="text"
                      value={newMessage}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !showMentions) {
                          e.preventDefault();
                          sendMessage();
                        }
                        if (showMentions) {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setMentionIndex(prev => (prev + 1) % allMentions.length);
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setMentionIndex(prev => (prev - 1 + allMentions.length) % allMentions.length);
                          } else if (e.key === 'Enter' || e.key === 'Tab') {
                            e.preventDefault();
                            if (allMentions[mentionIndex]) {
                              insertMention(allMentions[mentionIndex]);
                            }
                          } else if (e.key === 'Escape') {
                            setShowMentions(false);
                          }
                        }
                      }}
                      placeholder={`Message #${currentChannel.name}`}
                      className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm lg:text-base px-1"
                    />
                    
                    {/* Actions groupe 2 - Media */}
                    <div className="flex items-center gap-0.5 lg:gap-1">
                      <button 
                        onClick={() => setShowGifPicker(!showGifPicker)}
                        className={`p-1.5 lg:p-2 rounded-lg lg:rounded-xl transition-all duration-200 text-[10px] lg:text-xs font-bold ${showGifPicker ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                        title="GIF"
                      >
                        GIF
                      </button>
                      
                      {showGifPicker && (
                        <GifPicker
                          onSelect={handleGifSelect}
                          onClose={() => setShowGifPicker(false)}
                        />
                      )}

                      <button 
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`p-1.5 lg:p-2 rounded-lg lg:rounded-xl transition-all duration-200 ${showEmojiPicker ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                        title="Emoji"
                      >
                        <Smile className="w-4 h-4 lg:w-5 lg:h-5" />
                      </button>
                      
                      {/* Emoji Picker - Modern */}
                      {showEmojiPicker && (
                        <div 
                          ref={emojiPickerRef}
                          className="absolute bottom-full right-0 mb-3 w-72 h-80 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl z-50 overflow-hidden"
                        >
                          <div className="p-3 border-b border-slate-700/50 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
                            <input
                              type="text"
                              value={emojiSearch}
                              onChange={(e) => setEmojiSearch(e.target.value)}
                              placeholder="Rechercher un emoji..."
                              className="w-full p-2.5 bg-slate-800/80 rounded-xl text-sm text-white placeholder-slate-500 outline-none border border-slate-700/50 focus:border-indigo-500/50 transition-all"
                              autoFocus
                            />
                          </div>
                          <div className="p-3 overflow-y-auto h-[calc(100%-60px)] custom-scrollbar">
                            <div className="grid grid-cols-8 gap-1">
                              {EMOJIS.filter(e => e.includes(emojiSearch) || !emojiSearch).slice(0, 96).map((emoji, i) => (
                                <button
                                  key={i}
                                  onClick={() => insertEmoji(emoji)}
                                  className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-all duration-150 text-xl hover:scale-110"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Smart Button: Voice if empty, Send if has text - Modern */}
                    {!newMessage.trim() && selectedFiles.length === 0 ? (
                      <button 
                        onClick={() => setIsRecordingVoice(true)}
                        className="p-2 lg:p-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg lg:rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-200 ml-0.5 lg:ml-1 group"
                        title="Enregistrer un message vocal"
                      >
                        <Mic className="w-4 h-4 lg:w-5 lg:h-5 group-hover:scale-110 transition-transform" />
                      </button>
                    ) : (
                      <button 
                        onClick={sendMessage}
                        disabled={!newMessage.trim() && selectedFiles.length === 0}
                        className="p-2 lg:p-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg lg:rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none ml-0.5 lg:ml-1 group"
                      >
                        <Send className="w-4 h-4 lg:w-5 lg:h-5 group-hover:scale-110 transition-transform" />
                      </button>
                    )}
                  </div>
                  )}
                  
                  {/* Mentions Autocomplete - Modern */}
                  {showMentions && allMentions.length > 0 && (
                    <div 
                      ref={mentionsRef}
                      className="absolute bottom-full left-0 mb-3 w-64 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl z-50 max-h-48 overflow-hidden"
                    >
                      <div className="p-3 text-xs text-slate-400 border-b border-slate-700/50 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 flex items-center gap-2">
                        <Users className="w-3.5 h-3.5" />
                        Mentionner quelqu'un
                      </div>
                      <div className="max-h-36 overflow-y-auto custom-scrollbar">
                        {allMentions.map((user, index) => (
                          <button
                            key={user.id}
                            onClick={() => insertMention(user)}
                            className={`w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-all text-left ${
                              index === mentionIndex 
                                ? user.id === 'ethernal-bot' 
                                  ? 'bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 border-l-2 border-cyan-500' 
                                  : 'bg-indigo-500/10 border-l-2 border-indigo-500' 
                                : ''
                            } ${user.id === 'ethernal-bot' ? 'bg-gradient-to-r from-cyan-500/5 to-indigo-500/5' : ''}`}
                          >
                            {user.id === 'ethernal-bot' ? (
                              <div className="relative w-8 h-8">
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-600 animate-pulse blur-sm opacity-60"></div>
                                <div className="relative w-full h-full rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                                  <Sparkles className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold text-white shadow-lg">
                                {user.displayName?.[0] || user.username?.[0] || '?'}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white truncate flex items-center gap-2">
                                {user.id === 'ethernal-bot' ? (
                                  <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">{user.displayName || user.username}</span>
                                ) : (
                                  user.displayName || user.username
                                )}
                                {user.id === 'ethernal-bot' && (
                                  <span className="px-1.5 py-0.5 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-400 text-[9px] rounded font-bold border border-cyan-500/30">AI</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500">@{user.username}</div>
                            </div>
                            {index === mentionIndex && (
                              <span className={`text-[10px] font-medium ${user.id === 'ethernal-bot' ? 'text-cyan-400' : 'text-indigo-400'}`}>↵</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Footer hint - Hidden on mobile */}
                <div className="hidden lg:flex mt-1.5 items-center gap-3 text-[10px] text-slate-600">
                  <span><kbd className="px-1 py-0.5 bg-slate-800 rounded">@</kbd> mention</span>
                  <span><kbd className="px-1 py-0.5 bg-slate-800 rounded">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-slate-800 rounded">K</kbd> search</span>
                  <span className="text-indigo-400">@Ethernal</span> IA
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chat' && currentChannel.type === 'voice' && (
            <RealVoiceChannel 
              channelName={currentChannel.name} 
              currentUser={currentUser}
              socket={socket}
              onClose={() => setActiveChannel('general')}
            />
          )}

          {/* Right Sidebar - Online Users - Modern & Responsive */}
          {showOnlineUsersSidebar && activeTab === 'chat' && (
            <>
              {/* Mobile Overlay */}
              <div 
                className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                onClick={() => setShowOnlineUsersSidebar(false)}
              />
              <div className="fixed lg:static inset-y-0 right-0 z-40 w-72 lg:w-64 bg-slate-900/95 lg:bg-slate-900/60 backdrop-blur-xl border-l border-slate-700/50 flex flex-col">
                <div className="p-4 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-transparent flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <div className="p-1 rounded bg-indigo-500/20">
                      <Users className="w-3 h-3 text-indigo-400" />
                    </div>
                    En ligne — <span className="text-indigo-400">{onlineUsersReal.length + 1}</span>
                  </h3>
                  <button 
                    onClick={() => setShowOnlineUsersSidebar(false)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                {/* AI Bot - Premium Style */}
                <div 
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all duration-200 group border border-transparent hover:border-cyan-500/30 bg-gradient-to-r from-cyan-500/5 to-indigo-500/5"
                >
                  <div className="relative">
                    {/* Animated glow */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-600 animate-pulse blur-sm opacity-60 group-hover:opacity-80 transition-opacity"></div>
                    {/* Avatar */}
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 border border-white/20">
                      <Sparkles className="w-5 h-5 text-white animate-pulse" />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 bg-cyan-400 shadow-lg shadow-cyan-400/50"></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-semibold truncate flex items-center gap-1.5">
                      <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">Ethernal AI</span>
                      <span className="px-1.5 py-0.5 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-400 text-[9px] rounded font-bold border border-cyan-500/30 flex items-center gap-0.5">
                        <Sparkles className="w-3 h-3" />
                        AI
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 truncate">Assistant IA intelligent</div>
                  </div>
                </div>
                
                {/* Divider */}
                <div className="my-2 h-px bg-slate-700/30"></div>
                
                {/* Real Online Users - Modern */}
                {onlineUsersReal.map(user => (
                  <div 
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all duration-200 group border border-transparent hover:border-indigo-500/20"
                    onClick={() => openUserProfileFull(user.username)}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg">
                        {user.avatar ? (
                          <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm text-white font-bold">
                            {user.displayName?.[0] || user.username[0]}
                          </div>
                        )}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                        user.status === 'online' ? 'bg-green-500' :
                        user.status === 'away' ? 'bg-amber-500' :
                        user.status === 'dnd' ? 'bg-red-500' :
                        'bg-slate-500'
                      }`}></span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium truncate group-hover:text-indigo-400 transition-colors">
                        {user.displayName}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        @{user.username}
                      </div>
                    </div>
                    {/* DM Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startDMReal(user.id, user.username, user.displayName);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                      title="Envoyer un message"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                {onlineUsersReal.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-xs">
                    Aucun utilisateur en ligne
                  </div>
                )}
              </div>
            </div>
          </>
          )}

          {/* SIGNALS TAB */}
          {activeTab === 'signals' && (
            <div className="h-full overflow-y-auto p-4 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                    <Target className="w-6 h-6 text-indigo-400" />
                    Signaux de Trading
                  </h3>
                  <span className="text-sm text-slate-400">{signals.length} signaux actifs</span>
                </div>

                {signals.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Target className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>Aucun signal actif pour le moment</p>
                    <button 
                      onClick={() => setShowSignalModal(true)}
                      className="mt-4 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
                    >
                      Créer un signal
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {signals.map(signal => (
                      <div key={signal.id} className="bg-[#1e1f22] rounded-xl p-4 border border-[#2f3136] hover:border-[#5865f2]/50 transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <img 
                              src={signal.avatar || `https://ui-avatars.com/api/?name=${signal.username}&background=random`} 
                              alt={signal.username}
                              className="w-10 h-10 rounded-full"
                            />
                            <div>
                              <div className="font-semibold text-white">{signal.username}</div>
                              <div className="text-xs text-gray-400">
                                {new Date(signal.timestamp).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            signal.direction === 'buy' 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {signal.direction === 'buy' ? 'ACHAT' : 'VENTE'}
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 mb-3">
                          <div className="bg-[#292b2f]/50 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-gray-500 uppercase">Symbol</div>
                            <div className="font-bold text-white text-sm">{signal.symbol}</div>
                          </div>
                          <div className="bg-[#292b2f]/50 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-gray-500 uppercase">Entry</div>
                            <div className="font-bold text-white text-sm">${signal.entryPrice}</div>
                          </div>
                          <div className="bg-[#292b2f]/50 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-gray-500 uppercase">SL</div>
                            <div className="font-bold text-red-400 text-sm">${signal.stopLoss}</div>
                          </div>
                          <div className="bg-[#292b2f]/50 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-gray-500 uppercase">TP</div>
                            <div className="font-bold text-green-400 text-sm">${signal.takeProfit}</div>
                          </div>
                        </div>

                        {signal.aiValidation && (
                          <div className={`mb-2 p-2 rounded-lg ${
                            signal.aiValidation.isValid 
                              ? 'bg-green-500/5 border border-green-500/10' 
                              : 'bg-yellow-500/5 border border-yellow-500/10'
                          }`}>
                            <div className="flex items-center gap-2">
                              <Bot className="w-3.5 h-3.5 text-[#5865f2]" />
                              <span className="text-xs font-medium">IA: {signal.aiValidation.score}/100</span>
                              {signal.aiValidation.warnings.length > 0 && (
                                <span className="text-xs text-yellow-400 ml-auto">{signal.aiValidation.warnings.length} alerte(s)</span>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => handleVoteSignal(signal.id, 'bullish')}
                              className={`flex items-center gap-1.5 transition-colors ${
                                signal.votes?.userVote === 'bullish' 
                                  ? 'text-green-400' 
                                  : 'text-gray-400 hover:text-green-400'
                              }`}
                            >
                              <TrendingUp className="w-4 h-4" />
                              {signal.votes?.bullish || 0}
                            </button>
                            <button 
                              onClick={() => handleVoteSignal(signal.id, 'bearish')}
                              className={`flex items-center gap-1.5 transition-colors ${
                                signal.votes?.userVote === 'bearish' 
                                  ? 'text-red-400' 
                                  : 'text-gray-400 hover:text-red-400'
                              }`}
                            >
                              <TrendingDown className="w-4 h-4" />
                              {signal.votes?.bearish || 0}
                            </button>
                          </div>
                          <button className="text-sm text-[#5865f2] hover:underline">
                            Voir les détails →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TRADES TAB */}
          {activeTab === 'trades' && (
            <div className="h-full overflow-y-auto p-4 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                    <BarChart3 className="w-6 h-6 text-blue-400" />
                    Trades Partagés
                  </h3>
                  <button 
                    onClick={() => setShowTradeShareModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all"
                  >
                    Partager un trade
                  </button>
                </div>

                {sharedTrades.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>Aucun trade partagé</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {sharedTrades.map(trade => (
                      <div key={trade.id} className="bg-[#1e1f22] rounded-xl p-4 border border-[#2f3136]">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={trade.avatar || `https://ui-avatars.com/api/?name=${trade.username}&background=random`}
                              alt={trade.username}
                              className="w-10 h-10 rounded-full"
                            />
                            <div>
                              <div className="font-semibold text-white">{trade.username}</div>
                              <div className="text-xs text-gray-400">{new Date(trade.timestamp).toLocaleString()}</div>
                            </div>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            trade.pnl >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {trade.pnl >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-[#292b2f]/50 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-gray-500 uppercase">Symbol</div>
                            <div className="font-bold text-white">{trade.symbol}</div>
                          </div>
                          <div className="bg-[#292b2f]/50 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-gray-500 uppercase">Direction</div>
                            <div className={`font-bold text-sm ${trade.direction === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                              {trade.direction.toUpperCase()}
                            </div>
                          </div>
                          <div className="bg-[#292b2f]/50 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-gray-500 uppercase">P&L</div>
                            <div className={`font-bold text-sm ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {trade.pnl >= 0 ? '+' : '-'}${Math.abs(trade.pnl).toFixed(0)}
                            </div>
                          </div>
                        </div>

                        {trade.allowCopy && (
                          <button 
                            onClick={() => handleCopyTrade(trade.id)}
                            className="w-full py-1.5 bg-[#5865f2]/10 text-[#5865f2] rounded-lg hover:bg-[#5865f2]/20 transition-colors text-xs font-medium"
                          >
                            Copier ce trade
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LEADERBOARD TAB - Compact */}
          {activeTab === 'leaderboard' && (
            <div className="h-full overflow-y-auto p-3 custom-scrollbar">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-2 mb-4 px-1">
                  <Award className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-bold text-white">Classement</h3>
                </div>

                {communityLeaderboard.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Chargement...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {communityLeaderboard.map((entry, index) => (
                      <div 
                        key={entry.userId}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${
                          index === 0 ? 'bg-amber-500/10 border-amber-500/30' :
                          index === 1 ? 'bg-slate-400/10 border-slate-400/30' :
                          index === 2 ? 'bg-orange-500/10 border-orange-500/30' :
                          'bg-slate-800/50 border-slate-700/50'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-amber-500 text-black' :
                          index === 1 ? 'bg-slate-400 text-black' :
                          index === 2 ? 'bg-orange-500 text-white' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {entry.rank}
                        </div>
                        
                        <img 
                          src={entry.avatar || `https://ui-avatars.com/api/?name=${entry.username}&background=random`}
                          alt={entry.username}
                          className="w-9 h-9 rounded-full"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-white text-sm truncate">{entry.displayName}</span>
                            {entry.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                            {entry.isPro && <Crown className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
                          </div>
                          <div className="text-xs text-gray-500">@{entry.username}</div>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          <div className="text-center">
                            <div className="font-bold text-white">{entry.stats.winRate.toFixed(0)}%</div>
                            <div className="text-[10px] text-gray-500">WR</div>
                          </div>
                          <div className="text-center">
                            <div className={`font-bold ${entry.stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ${entry.stats.totalProfit.toFixed(0)}
                            </div>
                            <div className="text-[10px] text-gray-500">P&L</div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-[#5865f2]">{entry.reputation}</div>
                            <div className="text-[10px] text-gray-500">Rep</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* POLLS TAB - Modern */}
          {activeTab === 'polls' && (
            <div className="h-full overflow-y-auto p-4 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">Sondages Communautaires</h2>
                    <p className="text-sm text-slate-400">Votez et donnez votre opinion</p>
                  </div>
                  <button
                    onClick={() => setShowCreatePoll(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-medium shadow-lg hover:shadow-pink-500/30 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Créer un sondage
                  </button>
                </div>

                {polls.map(poll => (
                  <div key={poll.id} className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">{poll.question}</h3>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            Par {poll.createdBy}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {poll.endsAt && new Date() < poll.endsAt ? 
                              `Se termine ${new Date(poll.endsAt).toLocaleDateString()}` : 
                              'Terminé'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {poll.totalVotes} votes
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {poll.options.map(option => {
                        const percentage = poll.totalVotes > 0 ? (option.votes / poll.totalVotes) * 100 : 0;
                        return (
                          <button
                            key={option.id}
                            onClick={() => {
                              if (!poll.userVoted) {
                                setPolls(polls.map(p => 
                                  p.id === poll.id ? {
                                    ...p, 
                                    userVoted: option.id,
                                    options: p.options.map(o => 
                                      o.id === option.id ? { ...o, votes: o.votes + 1, voters: [...o.voters, currentUser?.id || ''] } : o
                                    ),
                                    totalVotes: p.totalVotes + 1
                                  } : p
                                ));
                              }
                            }}
                            disabled={!!poll.userVoted}
                            className={`w-full relative overflow-hidden rounded-xl p-3 text-left transition-all ${
                              poll.userVoted === option.id 
                                ? 'bg-pink-500/20 border border-pink-500/50' 
                                : poll.userVoted 
                                  ? 'bg-slate-700/30 opacity-60' 
                                  : 'bg-slate-700/50 hover:bg-slate-700/70 border border-transparent hover:border-slate-600'
                            }`}
                          >
                            <div 
                              className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-rose-500/10 transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                            <div className="relative flex items-center justify-between">
                              <span className="font-medium text-white">{option.text}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-400">{option.votes} votes</span>
                                <span className="text-sm font-bold text-pink-400">{percentage.toFixed(1)}%</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EVENTS TAB - Modern */}
          {activeTab === 'events' && (
            <div className="h-full overflow-y-auto p-4 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">Événements à Venir</h2>
                    <p className="text-sm text-slate-400">Ne manquez rien de la communauté</p>
                  </div>
                  <button
                    onClick={() => setShowCreateEvent(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl font-medium shadow-lg hover:shadow-amber-500/30 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Créer un événement
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {events.map(event => (
                    <div key={event.id} className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5 hover:border-amber-500/30 transition-all group">
                      <div className="flex items-start gap-3 mb-4">
                        <div className={`p-3 rounded-xl ${
                          event.type === 'webinar' ? 'bg-blue-500/20 text-blue-400' :
                          event.type === 'ama' ? 'bg-purple-500/20 text-purple-400' :
                          event.type === 'trading-session' ? 'bg-green-500/20 text-green-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {event.type === 'webinar' ? <Users className="w-5 h-5" /> :
                           event.type === 'ama' ? <MessageSquare className="w-5 h-5" /> :
                           event.type === 'trading-session' ? <BarChart3 className="w-5 h-5" /> :
                           <Award className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              event.status === 'upcoming' ? 'bg-green-500/20 text-green-400' :
                              event.status === 'live' ? 'bg-red-500/20 text-red-400 animate-pulse' :
                              'bg-slate-600/30 text-slate-400'
                            }`}>
                              {event.status === 'upcoming' ? 'À VENIR' : event.status === 'live' ? 'EN DIRECT' : 'TERMINÉ'}
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase">{event.type}</span>
                          </div>
                          <h3 className="text-lg font-semibold text-white mt-1 group-hover:text-amber-400 transition-colors">{event.title}</h3>
                        </div>
                      </div>

                      <p className="text-sm text-slate-400 mb-4 line-clamp-2">{event.description}</p>

                      <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(event.startDate).toLocaleDateString()} à {new Date(event.startDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {event.attendees.length}{event.maxAttendees ? `/${event.maxAttendees}` : ''} participants
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          if (!event.attendees.includes(currentUser?.id || '')) {
                            setEvents(events.map(e => 
                              e.id === event.id ? { ...e, attendees: [...e.attendees, currentUser?.id || ''] } : e
                            ));
                          }
                        }}
                        disabled={event.attendees.includes(currentUser?.id || '')}
                        className={`w-full py-2.5 rounded-xl font-medium transition-all ${
                          event.attendees.includes(currentUser?.id || '')
                            ? 'bg-green-500/20 text-green-400 cursor-default'
                            : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:shadow-lg hover:shadow-amber-500/30'
                        }`}
                      >
                        {event.attendees.includes(currentUser?.id || '') ? 'Inscrit ✓' : 'Participer'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== USER PROFILE SOCIAL - Complet ===== */}
      {showProfile && selectedUser && selectedUser.id && (
        <div className="fixed inset-0 z-50 overflow-auto">
          <UserProfileSocial 
            userId={selectedUser.id}
            username={selectedUser.username || ''}
            onClose={() => setShowProfile(false)}
            onStartDM={(dmUserId, dmUsername, dmDisplayName, dmAvatar) => {
              const finalUserId = dmUserId || '';
              const finalUsername = dmUsername || '';
              const finalDisplayName = dmDisplayName || finalUsername || 'Utilisateur';
              const finalAvatar = dmAvatar || '';
              
              if (finalUserId && finalUsername) {
                startDM(finalUserId, finalUsername, finalDisplayName, finalAvatar);
              }
              setShowProfile(false);
            }}
          />
        </div>
      )}

      {/* ===== SIGNAL MODAL ===== */}
      {showSignalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1f22] rounded-2xl p-6 w-full max-w-lg border border-[#2f3136] shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Nouveau Signal</h3>
              <button onClick={() => setShowSignalModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Symbole</label>
                  <input
                    type="text"
                    value={newSignal.symbol}
                    onChange={(e) => setNewSignal({...newSignal, symbol: e.target.value.toUpperCase()})}
                    placeholder="BTCUSDT"
                    className="w-full p-3 bg-[#292b2f] rounded-lg text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#5865f2]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Direction</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewSignal({...newSignal, direction: 'buy'})}
                      className={`flex-1 p-3 rounded-lg font-medium transition-colors ${
                        newSignal.direction === 'buy'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                          : 'bg-[#292b2f] text-gray-400'
                      }`}
                    >
                      <TrendingUp className="w-5 h-5 mx-auto" />
                    </button>
                    <button
                      onClick={() => setNewSignal({...newSignal, direction: 'sell'})}
                      className={`flex-1 p-3 rounded-lg font-medium transition-colors ${
                        newSignal.direction === 'sell'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                          : 'bg-[#292b2f] text-gray-400'
                      }`}
                    >
                      <TrendingDown className="w-5 h-5 mx-auto" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Entry Price</label>
                  <input
                    type="number"
                    value={newSignal.entryPrice || ''}
                    onChange={(e) => setNewSignal({...newSignal, entryPrice: parseFloat(e.target.value)})}
                    className="w-full p-3 bg-[#292b2f] rounded-lg text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#5865f2]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Stop Loss</label>
                  <input
                    type="number"
                    value={newSignal.stopLoss || ''}
                    onChange={(e) => setNewSignal({...newSignal, stopLoss: parseFloat(e.target.value)})}
                    className="w-full p-3 bg-[#292b2f] rounded-lg text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#5865f2]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Take Profit</label>
                  <input
                    type="number"
                    value={newSignal.takeProfit || ''}
                    onChange={(e) => setNewSignal({...newSignal, takeProfit: parseFloat(e.target.value)})}
                    className="w-full p-3 bg-[#292b2f] rounded-lg text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#5865f2]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Analyse</label>
                <textarea
                  value={newSignal.analysis}
                  onChange={(e) => setNewSignal({...newSignal, analysis: e.target.value})}
                  rows={4}
                  placeholder="Décrivez votre analyse technique..."
                  className="w-full p-3 bg-[#292b2f] rounded-lg text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#5865f2] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Confiance: {newSignal.confidence}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newSignal.confidence}
                  onChange={(e) => setNewSignal({...newSignal, confidence: parseInt(e.target.value)})}
                  className="w-full h-2 bg-[#292b2f] rounded-lg appearance-none cursor-pointer accent-[#5865f2]"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSignalModal(false)}
                className="flex-1 p-3 rounded-lg bg-[#292b2f] text-white hover:bg-[#40444b] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateSignal}
                disabled={!newSignal.symbol || !newSignal.entryPrice}
                className="flex-1 p-3 rounded-lg bg-[#5865f2] text-white hover:bg-[#4752c4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Créer le signal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
