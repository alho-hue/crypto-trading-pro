import { useState, useEffect, useMemo, useCallback } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { useTradeStore } from '../stores/tradeStore';
import { showToast } from '../stores/toastStore';
import { 
  Plus, Trash2, X, BookOpen, TrendingUp, TrendingDown, Calendar, 
  Brain, Camera, Edit3, Save, Upload, Image as ImageIcon, AlertTriangle,
  Target, Activity, BarChart3, Smile, Frown, Meh, CheckCircle2, XCircle,
  RefreshCw, Filter, ChevronDown, ChevronUp, Clock, Zap, Shield,
  FileText, Award, TrendingDown as TrendDown
} from 'lucide-react';
import { format, startOfDay, startOfWeek, isSameDay, isSameWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { type Trade } from '../services/tradeService';
import { fetchMyTrades } from '../services/binanceApi';
import { getTradeHistory } from '../services/tradingApi';
import type { JournalEntry, TradeNote, BehavioralPattern, DisciplineMetrics } from '../types/journal';

// Emotion options
const EMOTIONS = [
  { value: 'confident', label: 'Confiant', icon: Smile, color: 'text-green-400', bg: 'bg-green-500/20' },
  { value: 'neutral', label: 'Neutre', icon: Meh, color: 'text-gray-400', bg: 'bg-gray-500/20' },
  { value: 'stressed', label: 'Stressé', icon: Frown, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  { value: 'fomo', label: 'FOMO', icon: Zap, color: 'text-orange-400', bg: 'bg-orange-500/20' },
  { value: 'revenge', label: 'Vengeance', icon: TrendDown, color: 'text-red-400', bg: 'bg-red-500/20' },
];

// Common mistakes
const COMMON_MISTAKES = [
  'Stop Loss non respecté',
  'Take Profit trop tôt',
  'Entrée sans setup clair',
  'Position trop large',
  'Trading émotionnel',
  'Revenge trading',
  'Overtrading',
  'Manque de patience',
  'Ignorer le plan',
  'FOMO entry',
];

// Strategy options
const STRATEGIES = [
  'Support/Résistance',
  'Trend Following',
  'Breakout',
  'Pullback',
  'Pattern Trading',
  'Scalping',
  'RSI Strategy',
  'MACD Crossover',
  'Bollinger Bounce',
  'Golden/Death Cross',
  'Autre',
];

export default function TradingJournal() {
  // Data states
  const [trades, setTrades] = useState<Trade[]>([]);
  const [journalEntries, setJournalEntries] = useState<Record<string, JournalEntry>>({});
  const [loading, setLoading] = useState(false);
  const [hasApiKeys, setHasApiKeys] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  
  // UI states
  const [activeTab, setActiveTab] = useState<'trades' | 'analytics' | 'daily' | 'behavior'>('trades');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expandedTrades, setExpandedTrades] = useState<Set<string>>(new Set());
  
  // Filter states
  const [filterSource, setFilterSource] = useState<'all' | 'binance' | 'bot' | 'ai' | 'manual'>('all');
  const [filterEmotion, setFilterEmotion] = useState<string>('all');
  const [filterHasNotes, setFilterHasNotes] = useState<boolean | null>(null);
  
  // Note form state
  const [noteForm, setNoteForm] = useState<TradeNote>({
    why: '',
    emotion: 'neutral',
    mistakes: [],
    lessons: '',
    screenshotUrl: '',
  });
  
  // Store integration
  const storeTrades = useTradeStore(state => state.trades);
  const refreshAll = useTradeStore(state => state.refreshAll);

  // Load all trades from multiple sources
  const loadAllTrades = useCallback(async () => {
    setLoading(true);
    try {
      const allTrades: Trade[] = [];
      
      // 1. From TradeStore (backend)
      await refreshAll();
      allTrades.push(...storeTrades);
      
      // 2. From Trading API
      const apiHistory = await getTradeHistory(false, 100);
      if (apiHistory.trades) {
        allTrades.push(...apiHistory.trades as Trade[]);
      }
      
      // 3. From Binance (if API keys available)
      try {
        const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'];
        for (const symbol of symbols) {
          const binanceTrades = await fetchMyTrades(symbol, 50);
          if (Array.isArray(binanceTrades)) {
            allTrades.push(...binanceTrades.map((t: any) => ({
              _id: `binance_${t.id}`,
              userId: 'binance_import',
              symbol: t.symbol,
              side: t.isBuyer ? 'buy' : 'sell',
              type: 'market' as const,
              entryPrice: parseFloat(t.price),
              quantity: parseFloat(t.qty),
              filledQuantity: parseFloat(t.qty),
              fees: parseFloat(t.commission),
              status: 'closed' as const,
              source: 'bot' as const,
              isAutoTrade: false,
              paperTrading: false,
              leverage: 1,
              marginType: 'crossed' as const,
              entryTime: new Date(t.time),
              lastUpdateTime: new Date(t.time),
              createdAt: new Date(t.time),
              updatedAt: new Date(t.time),
              pnl: t.isBuyer ? undefined : (parseFloat(t.quoteQty) - parseFloat(t.qty) * parseFloat(t.price)),
            } as unknown as Trade)));
          }
        }
      } catch (e) {
        console.warn('Binance trades not loaded:', e);
      }
      
      // Deduplicate by ID
      const uniqueTrades = Array.from(new Map(allTrades.map(t => [t._id, t])).values());
      uniqueTrades.sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());
      
      setTrades(uniqueTrades);
      // Only show toast if explicitly requested (manual sync)
      if (showNotification) {
        showToast.success(`${uniqueTrades.length} trades chargés`);
      }
    } catch (error) {
      console.error('Failed to load trades:', error);
      if (showNotification) {
        showToast.error('Erreur lors du chargement des trades');
      }
    } finally {
      setLoading(false);
      setShowNotification(false); // Reset after showing
    }
  }, [storeTrades, refreshAll, showNotification]);

  // Load on mount only once (silently, no toast)
  useEffect(() => {
    let isMounted = true;
    
    const initialLoad = async () => {
      // Load trades silently
      await refreshAll();
      if (isMounted && storeTrades.length > 0) {
        setTrades(storeTrades);
      }
      
      // Load journal entries from localStorage
      const saved = localStorage.getItem('trading_journal_entries');
      if (saved && isMounted) {
        setJournalEntries(JSON.parse(saved));
      }
    };
    
    initialLoad();
    
    return () => { isMounted = false; };
  }, []); // Empty deps - only run once on mount

  // Save journal entries
  const saveJournalEntry = useCallback((tradeId: string, entry: JournalEntry) => {
    const updated = { ...journalEntries, [tradeId]: entry };
    setJournalEntries(updated);
    localStorage.setItem('trading_journal_entries', JSON.stringify(updated));
  }, [journalEntries]);

  // Handle screenshot upload
  const handleScreenshotUpload = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('screenshot', file);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/upload/screenshot', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      return data.url;
    } catch (error) {
      // Fallback: use FileReader for local preview
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
  }, []);

  // Open note modal
  const openNoteModal = useCallback((trade: Trade) => {
    setSelectedTrade(trade);
    const existing = journalEntries[trade._id || ''];
    if (existing?.note) {
      setNoteForm(existing.note);
    } else {
      setNoteForm({
        why: '',
        emotion: 'neutral',
        mistakes: [],
        lessons: '',
        screenshotUrl: '',
      });
    }
    setShowNoteModal(true);
  }, [journalEntries]);

  // Save note
  const saveNote = useCallback(() => {
    if (!selectedTrade) return;
    
    const tradeId = selectedTrade._id || '';
    const entry: JournalEntry = {
      tradeId,
      note: noteForm,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    saveJournalEntry(tradeId, entry);
    setShowNoteModal(false);
    showToast.success('Note sauvegardée');
  }, [selectedTrade, noteForm, saveJournalEntry]);

  // Run AI Analysis
  const runAIAnalysis = useCallback(async () => {
    const tradesWithNotes = trades.filter(t => {
      const entry = journalEntries[t._id || ''];
      return entry?.note?.why || entry?.note?.lessons;
    });
    
    if (tradesWithNotes.length < 3) {
      showToast.warning('Au moins 3 trades avec notes requis pour l\'analyse IA');
      return;
    }
    
    setAnalyzing(true);
    setShowAIAnalysis(true);
    
    try {
      // Calculate emotional stats inline
      const emotionalTrades = tradesWithNotes.filter(t => {
        const entry = journalEntries[t._id || ''];
        return entry?.note?.emotion === 'stressed' || entry?.note?.emotion === 'fomo' || entry?.note?.emotion === 'revenge';
      });
      
      const emotionalPnL = emotionalTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      
      const confidentTrades = tradesWithNotes.filter(t => {
        const entry = journalEntries[t._id || ''];
        return entry?.note?.emotion === 'confident';
      });
      const confidentPnL = confidentTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      
      // Calculate discipline score inline
      const closedTrades = trades.filter(t => t.status === 'closed');
      const withNotes = closedTrades.filter(t => journalEntries[t._id || '']);
      const withSL = closedTrades.filter(t => t.stopLoss);
      const slHit = withSL.filter(t => t.exitReason === 'stop_loss');
      const slScore = withSL.length > 0 ? Math.round((slHit.length / withSL.length) * 100) : 0;
      
      const withStrategy = withNotes.filter(t => {
        const entry = journalEntries[t._id || ''];
        return entry?.note?.why && entry.note.why.length > 10;
      });
      const strategyScore = closedTrades.length > 0 ? Math.round((withStrategy.length / closedTrades.length) * 100) : 0;
      
      const emotionalOk = withNotes.filter(t => {
        const entry = journalEntries[t._id || ''];
        return entry?.note?.emotion === 'confident' || entry?.note?.emotion === 'neutral';
      });
      const emotionScore = withNotes.length > 0 ? Math.round((emotionalOk.length / withNotes.length) * 100) : 0;
      const overallScore = Math.round((slScore + strategyScore + emotionScore) / 3);
      
      // Detect patterns inline
      const patterns: BehavioralPattern[] = [];
      const tradesByDay = new Map<string, number>();
      trades.forEach(t => {
        const day = format(new Date(t.entryTime), 'yyyy-MM-dd');
        tradesByDay.set(day, (tradesByDay.get(day) || 0) + 1);
      });
      const overtradingDays = Array.from(tradesByDay.entries()).filter(([_, count]) => count > 5);
      if (overtradingDays.length > 0) {
        const impact = overtradingDays.map(([date]) => {
          return trades.filter(t => format(new Date(t.entryTime), 'yyyy-MM-dd') === date && t.pnl !== undefined)
            .reduce((sum, t) => sum + (t.pnl || 0), 0);
        }).reduce((a, b) => a + b, 0);
        patterns.push({
          type: 'overtrading',
          severity: overtradingDays.length > 3 ? 'high' : 'medium',
          description: `${overtradingDays.length} jours avec plus de 5 trades`,
          impact,
          recommendation: 'Limitez-vous à 3-5 trades par jour maximum',
        });
      }
      
      const slMissed = trades.filter(t => {
        const entry = journalEntries[t._id || ''];
        return entry?.note?.mistakes?.includes('Stop Loss non respecté');
      });
      if (slMissed.length > 0) {
        const impact = slMissed.reduce((sum, t) => sum + (t.pnl || 0), 0);
        patterns.push({
          type: 'sl_not_respected',
          severity: slMissed.length > 2 ? 'high' : 'medium',
          description: `${slMissed.length} fois où le SL n'a pas été respecté`,
          impact,
          recommendation: 'Utilisez des ordres stop market obligatoires',
        });
      }
      
      const result = {
        insights: [
          {
            title: 'Analyse Émotionnelle',
            description: `Vous avez pris ${emotionalTrades.length} trades sous le coup de l'émotion (stress, FOMO, vengeance) avec un P&L total de ${formatPrice(emotionalPnL)}. En comparaison, vos trades en état de confiance ont généré ${formatPrice(confidentPnL)}.`,
          },
          {
            title: 'Respect de la Discipline',
            description: `Score de discipline: ${overallScore}/100. Respect du SL: ${slScore}%, Respect du plan: ${strategyScore}%, Gestion émotionnelle: ${emotionScore}%.`,
          },
          ...patterns.map(p => ({
            title: `Pattern: ${p.type.replace('_', ' ')}`,
            description: `${p.description}. Impact P&L: ${formatPrice(p.impact)}. 💡 ${p.recommendation}`,
          })),
          {
            title: 'Recommandations Personnalisées',
            description: overallScore < 60 
              ? 'Votre discipline nécessite une attention particulière. Concentrez-vous sur le respect de vos stops et l\'écriture systématique de notes avant chaque trade.'
              : overallScore < 80
              ? 'De bons progrès! Continuez à documenter vos trades et à travailler sur la gestion émotionnelle pour atteindre l\'excellence.'
              : 'Excellent travail sur la discipline! Vous êtes sur la bonne voie pour devenir un trader cohérent et profitable.',
          },
        ],
      };
      
      setAiAnalysis(result);
      showToast.success('Analyse IA complète');
    } catch (error) {
      console.error('AI analysis failed:', error);
      showToast.error('Erreur lors de l\'analyse IA');
    } finally {
      setAnalyzing(false);
    }
  }, [trades, journalEntries]);

  // Calculate behavioral patterns
  const behavioralPatterns = useMemo((): BehavioralPattern[] => {
    const patterns: BehavioralPattern[] = [];
    
    // Overtrading detection
    const tradesByDay = new Map<string, number>();
    trades.forEach(t => {
      const day = format(new Date(t.entryTime), 'yyyy-MM-dd');
      tradesByDay.set(day, (tradesByDay.get(day) || 0) + 1);
    });
    
    const overtradingDays = Array.from(tradesByDay.entries())
      .filter(([_, count]) => count > 5)
      .map(([date, count]) => ({ date, count }));
    
    if (overtradingDays.length > 0) {
      const overtradingPnL = overtradingDays.map(d => {
        const dayTrades = trades.filter(t => 
          format(new Date(t.entryTime), 'yyyy-MM-dd') === d.date && t.pnl !== undefined
        );
        return dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      }).reduce((a, b) => a + b, 0);
      
      patterns.push({
        type: 'overtrading',
        severity: overtradingDays.length > 3 ? 'high' : 'medium',
        description: `${overtradingDays.length} jours avec plus de 5 trades`,
        impact: overtradingPnL,
        recommendation: 'Limitez-vous à 3-5 trades par jour maximum',
      });
    }
    
    // Revenge trading detection
    const losses = trades.filter(t => (t.pnl || 0) < 0);
    const revengeTrades: Trade[] = [];
    
    for (let i = 0; i < losses.length; i++) {
      const loss = losses[i];
      const nextTrades = trades.filter(t => 
        new Date(t.entryTime) > new Date(loss.entryTime) &&
        new Date(t.entryTime).getTime() - new Date(loss.entryTime).getTime() < 30 * 60 * 1000
      );
      
      if (nextTrades.length > 0) {
        const entry = journalEntries[nextTrades[0]._id || ''];
        if (entry?.note?.emotion === 'revenge' || entry?.note?.emotion === 'fomo') {
          revengeTrades.push(nextTrades[0]);
        }
      }
    }
    
    if (revengeTrades.length > 0) {
      const revengePnL = revengeTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      patterns.push({
        type: 'revenge_trading',
        severity: revengeTrades.length > 3 ? 'high' : 'medium',
        description: `${revengeTrades.length} trades de vengeance détectés`,
        impact: revengePnL,
        recommendation: 'Attendez 30 minutes après une perte avant de reprendre',
      });
    }
    
    // SL not respected
    const slMissed = trades.filter(t => {
      const entry = journalEntries[t._id || ''];
      return entry?.note?.mistakes?.includes('Stop Loss non respecté');
    });
    
    if (slMissed.length > 0) {
      const slMissedPnL = slMissed.reduce((sum, t) => sum + (t.pnl || 0), 0);
      patterns.push({
        type: 'sl_not_respected',
        severity: slMissed.length > 2 ? 'high' : 'medium',
        description: `${slMissed.length} fois où le SL n'a pas été respecté`,
        impact: slMissedPnL,
        recommendation: 'Utilisez des ordres stop market obligatoires',
      });
    }
    
    // Emotional trading
    const emotionalTrades = trades.filter(t => {
      const entry = journalEntries[t._id || ''];
      return entry?.note?.emotion === 'stressed' || entry?.note?.emotion === 'fomo' || entry?.note?.emotion === 'revenge';
    });
    
    if (emotionalTrades.length > 0) {
      const emotionalPnL = emotionalTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      patterns.push({
        type: 'emotional_trading',
        severity: emotionalTrades.length > trades.length * 0.3 ? 'high' : 'medium',
        description: `${emotionalTrades.length} trades émotionnels`,
        impact: emotionalPnL,
        recommendation: 'Prenez des pauses, méditez avant de trader',
      });
    }
    
    return patterns;
  }, [trades, journalEntries]);

  // Calculate discipline metrics
  const disciplineMetrics = useMemo((): DisciplineMetrics => {
    const closedTrades = trades.filter(t => t.status === 'closed');
    const withNotes = closedTrades.filter(t => journalEntries[t._id || '']);
    
    // SL respect score
    const withSL = closedTrades.filter(t => t.stopLoss);
    const slHit = withSL.filter(t => t.exitReason === 'stop_loss');
    const slRespectScore = withSL.length > 0 
      ? (slHit.length / withSL.length) * 100 
      : 0;
    
    // Strategy respect score
    const withStrategy = withNotes.filter(t => {
      const entry = journalEntries[t._id || ''];
      return entry?.note?.why && entry.note.why.length > 10;
    });
    const strategyScore = closedTrades.length > 0 
      ? (withStrategy.length / closedTrades.length) * 100 
      : 0;
    
    // Emotion management score
    const emotionalTrades = withNotes.filter(t => {
      const entry = journalEntries[t._id || ''];
      return entry?.note?.emotion === 'confident' || entry?.note?.emotion === 'neutral';
    });
    const emotionScore = withNotes.length > 0 
      ? (emotionalTrades.length / withNotes.length) * 100 
      : 0;
    
    // Overall discipline score
    const overallScore = Math.round((slRespectScore + strategyScore + emotionScore) / 3);
    
    return {
      slRespectScore: Math.round(slRespectScore),
      strategyScore: Math.round(strategyScore),
      emotionScore: Math.round(emotionScore),
      overallScore,
      totalTrades: closedTrades.length,
      tradesWithNotes: withNotes.length,
    };
  }, [trades, journalEntries]);

  // Calculate daily stats
  const dailyStats = useMemo(() => {
    const today = startOfDay(selectedDate);
    const todayTrades = trades.filter(t => 
      isSameDay(new Date(t.entryTime), today)
    );
    
    const wins = todayTrades.filter(t => (t.pnl || 0) > 0);
    const losses = todayTrades.filter(t => (t.pnl || 0) < 0);
    const pnl = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    return {
      trades: todayTrades.length,
      wins: wins.length,
      losses: losses.length,
      pnl,
      winRate: todayTrades.length > 0 ? (wins.length / todayTrades.length) * 100 : 0,
    };
  }, [trades, selectedDate]);

  // Calculate weekly stats
  const weeklyStats = useMemo(() => {
    const weekStart = startOfWeek(selectedDate, { locale: fr });
    const weekTrades = trades.filter(t => 
      isSameWeek(new Date(t.entryTime), weekStart, { locale: fr })
    );
    
    const wins = weekTrades.filter(t => (t.pnl || 0) > 0);
    const pnl = weekTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    return {
      trades: weekTrades.length,
      wins: wins.length,
      losses: weekTrades.length - wins.length,
      pnl,
      winRate: weekTrades.length > 0 ? (wins.length / weekTrades.length) * 100 : 0,
    };
  }, [trades, selectedDate]);

  // Filter trades
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      // Source filter
      if (filterSource !== 'all' && t.source !== filterSource) return false;
      
      // Emotion filter
      if (filterEmotion !== 'all') {
        const entry = journalEntries[t._id || ''];
        if (entry?.note?.emotion !== filterEmotion) return false;
      }
      
      // Has notes filter
      if (filterHasNotes !== null) {
        const hasNote = !!journalEntries[t._id || '']?.note?.why;
        if (filterHasNotes !== hasNote) return false;
      }
      
      return true;
    });
  }, [trades, journalEntries, filterSource, filterEmotion, filterHasNotes]);

  // Overall stats
  const stats = useMemo(() => {
    const closed = trades.filter(t => t.status === 'closed');
    const withNotes = closed.filter(t => journalEntries[t._id || '']);
    const wins = closed.filter(t => (t.pnl || 0) > 0);
    const losses = closed.filter(t => (t.pnl || 0) < 0);
    
    return {
      totalTrades: trades.length,
      closedTrades: closed.length,
      tradesWithNotes: withNotes.length,
      winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
      totalPnL: closed.reduce((sum, t) => sum + (t.pnl || 0), 0),
      wins: wins.length,
      losses: losses.length,
      profitFactor: losses.length > 0 
        ? (wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0)))
        : wins.length > 0 ? Infinity : 0,
    };
  }, [trades, journalEntries]);

  // Toggle trade expansion
  const toggleExpand = useCallback((tradeId: string) => {
    setExpandedTrades(prev => {
      const next = new Set(prev);
      if (next.has(tradeId)) {
        next.delete(tradeId);
      } else {
        next.add(tradeId);
      }
      return next;
    });
  }, []);

  // Format helpers
  const formatPrice = (price: number) => `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (date: Date) => format(date, 'dd/MM/yyyy HH:mm', { locale: fr });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-crypto-blue" />
          Journal de Trading Intelligent
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runAIAnalysis}
            disabled={analyzing || trades.length < 3}
            className="px-4 py-2 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Brain className="w-4 h-4" />
            {analyzing ? 'Analyse...' : 'Analyse IA'}
          </button>
          <button
            onClick={() => { setShowNotification(true); loadAllTrades(); }}
            disabled={loading}
            className="px-4 py-2 bg-crypto-accent rounded-lg hover:bg-crypto-accent/80 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Synchroniser
          </button>
        </div>
      </div>

      {/* Discipline Score Card */}
      <div className="crypto-card border-crypto-blue/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-crypto-blue" />
            Score de Discipline
          </h3>
          <div className="text-right">
            <div className={`text-3xl font-bold ${
              disciplineMetrics.overallScore >= 80 ? 'text-green-400' :
              disciplineMetrics.overallScore >= 60 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {disciplineMetrics.overallScore}/100
            </div>
            <div className="text-xs text-gray-400">
              {disciplineMetrics.overallScore >= 80 ? 'Excellent' :
               disciplineMetrics.overallScore >= 60 ? 'À améliorer' :
               'Attention'}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
              <Target className="w-3 h-3" />
              Respect SL
            </div>
            <div className={`text-xl font-bold ${
              disciplineMetrics.slRespectScore >= 80 ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {disciplineMetrics.slRespectScore}%
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Respect Plan
            </div>
            <div className={`text-xl font-bold ${
              disciplineMetrics.strategyScore >= 80 ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {disciplineMetrics.strategyScore}%
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
              <Smile className="w-3 h-3" />
              Gestion Émotion
            </div>
            <div className={`text-xl font-bold ${
              disciplineMetrics.emotionScore >= 80 ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {disciplineMetrics.emotionScore}%
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="crypto-card p-3">
          <div className="text-xs text-gray-400">Trades Notés</div>
          <div className="text-xl font-bold">{stats.tradesWithNotes}/{stats.closedTrades}</div>
          <div className="text-xs text-gray-500">{stats.tradesWithNotes > 0 ? Math.round((stats.tradesWithNotes / stats.closedTrades) * 100) : 0}% documentés</div>
        </div>
        <div className="crypto-card p-3">
          <div className="text-xs text-gray-400">Win Rate</div>
          <div className={`text-xl font-bold ${stats.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.winRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">{stats.wins}W / {stats.losses}L</div>
        </div>
        <div className="crypto-card p-3">
          <div className="text-xs text-gray-400">P&L Total</div>
          <div className={`text-xl font-bold ${stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPrice(stats.totalPnL)}
          </div>
          <div className="text-xs text-gray-500">Net</div>
        </div>
        <div className="crypto-card p-3">
          <div className="text-xs text-gray-400">Profit Factor</div>
          <div className={`text-xl font-bold ${stats.profitFactor >= 1.5 ? 'text-green-400' : 'text-yellow-400'}`}>
            {typeof stats.profitFactor === 'number' ? stats.profitFactor.toFixed(2) : '∞'}
          </div>
          <div className="text-xs text-gray-500">Gains/Pertes</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-crypto-border">
        {[
          { id: 'trades', label: 'Trades & Notes', icon: BookOpen },
          { id: 'daily', label: 'Journal Quotidien', icon: Calendar },
          { id: 'behavior', label: 'Comportement', icon: Activity },
          { id: 'analytics', label: 'Analytiques', icon: BarChart3 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 flex items-center gap-2 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-crypto-blue text-crypto-blue'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TRADES TAB */}
      {activeTab === 'trades' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as any)}
              className="bg-slate-800 border border-crypto-border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">Toutes sources</option>
              <option value="binance">Binance</option>
              <option value="bot">Bot</option>
              <option value="ai">IA</option>
              <option value="manual">Manuel</option>
            </select>
            
            <select
              value={filterEmotion}
              onChange={(e) => setFilterEmotion(e.target.value)}
              className="bg-slate-800 border border-crypto-border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">Toutes émotions</option>
              {EMOTIONS.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
            
            <select
              value={filterHasNotes === null ? 'all' : filterHasNotes ? 'yes' : 'no'}
              onChange={(e) => setFilterHasNotes(e.target.value === 'all' ? null : e.target.value === 'yes')}
              className="bg-slate-800 border border-crypto-border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">Tous les trades</option>
              <option value="yes">Avec notes</option>
              <option value="no">Sans notes</option>
            </select>
          </div>

          {/* Trades List */}
          <div className="crypto-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Trades ({filteredTrades.length})</h2>
              <div className="text-sm text-gray-400">
                Cliquez sur un trade pour ajouter des notes
              </div>
            </div>

            {filteredTrades.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Aucun trade trouvé</p>
                <p className="text-sm mt-2">Synchronisez vos trades pour commencer</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredTrades.map((trade) => {
                  const entry = journalEntries[trade._id || ''];
                  const isExpanded = expandedTrades.has(trade._id || '');
                  const emotion = EMOTIONS.find(e => e.value === entry?.note?.emotion);
                  
                  return (
                    <div
                      key={trade._id}
                      className="p-4 rounded-lg border border-crypto-border bg-slate-800/30 hover:bg-slate-800/50 transition-all cursor-pointer"
                      onClick={() => toggleExpand(trade._id || '')}
                    >
                      <div className="flex items-center justify-between">
                        {/* Left: Symbol & Info */}
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            (trade.pnl || 0) > 0 ? 'bg-green-500/20' : (trade.pnl || 0) < 0 ? 'bg-red-500/20' : 'bg-gray-500/20'
                          }`}>
                            {(trade.pnl || 0) > 0 ? (
                              <TrendingUp className="w-5 h-5 text-green-400" />
                            ) : (trade.pnl || 0) < 0 ? (
                              <TrendingDown className="w-5 h-5 text-red-400" />
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{trade.symbol}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                trade.side === 'buy' || trade.side === 'LONG'
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}>
                                {trade.side?.toUpperCase()}
                              </span>
                              {trade.source && (
                                <span className="text-xs bg-slate-700 text-gray-300 px-2 py-0.5 rounded capitalize">
                                  {trade.source}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                              <span>{formatDate(new Date(trade.entryTime))}</span>
                              {emotion && (
                                <span className={`flex items-center gap-1 ${emotion.color}`}>
                                  <emotion.icon className="w-3 h-3" />
                                  {emotion.label}
                                </span>
                              )}
                              {entry?.note?.screenshotUrl && (
                                <ImageIcon className="w-3 h-3 text-crypto-blue" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: PnL & Actions */}
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            {trade.pnl !== undefined ? (
                              <>
                                <div className={`text-lg font-bold font-mono ${
                                  trade.pnl > 0 ? 'text-green-400' : trade.pnl < 0 ? 'text-red-400' : 'text-gray-400'
                                }`}>
                                  {trade.pnl > 0 ? '+' : ''}{formatPrice(trade.pnl)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {trade.pnlPercent?.toFixed(2)}%
                                </div>
                              </>
                            ) : (
                              <div className="text-gray-400">-</div>
                            )}
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openNoteModal(trade);
                            }}
                            className={`p-2 rounded-lg transition-all ${
                              entry?.note?.why 
                                ? 'bg-crypto-blue/20 text-crypto-blue' 
                                : 'bg-slate-700 text-gray-400 hover:text-white'
                            }`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-crypto-border">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <span className="text-gray-400 text-sm block">Prix d'entrée</span>
                              <span className="font-mono">{formatPrice(trade.entryPrice)}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-sm block">Prix de sortie</span>
                              <span className="font-mono">{trade.exitPrice ? formatPrice(trade.exitPrice) : '-'}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-sm block">Quantité</span>
                              <span className="font-mono">{trade.quantity?.toFixed(6)}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-sm block">Frais</span>
                              <span className="font-mono">{formatPrice(trade.fees || 0)}</span>
                            </div>
                          </div>
                          
                          {entry?.note && (
                            <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                              {entry.note.why && (
                                <div>
                                  <span className="text-crypto-blue text-sm font-medium">Pourquoi ce trade?</span>
                                  <p className="text-gray-300 text-sm mt-1">{entry.note.why}</p>
                                </div>
                              )}
                              
                              {entry.note.mistakes && entry.note.mistakes.length > 0 && (
                                <div>
                                  <span className="text-red-400 text-sm font-medium">Erreurs commises</span>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {entry.note.mistakes.map((mistake, i) => (
                                      <span key={i} className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                                        {mistake}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {entry.note.lessons && (
                                <div>
                                  <span className="text-green-400 text-sm font-medium">Leçons apprises</span>
                                  <p className="text-gray-300 text-sm mt-1">{entry.note.lessons}</p>
                                </div>
                              )}
                              
                              {entry.note.screenshotUrl && (
                                <div>
                                  <span className="text-gray-400 text-sm">Screenshot</span>
                                  <img 
                                    src={entry.note.screenshotUrl} 
                                    alt="Trade screenshot" 
                                    className="mt-2 max-w-xs rounded-lg border border-crypto-border"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* DAILY TAB */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Date Selector */}
          <div className="flex items-center gap-4">
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="bg-slate-800 border border-crypto-border rounded-lg px-3 py-2"
            />
            <div className="text-gray-400">
              {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
            </div>
          </div>

          {/* Daily Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="crypto-card p-3">
              <div className="text-xs text-gray-400">Trades Aujourd'hui</div>
              <div className="text-2xl font-bold">{dailyStats.trades}</div>
            </div>
            <div className="crypto-card p-3">
              <div className="text-xs text-gray-400">Win Rate Jour</div>
              <div className={`text-2xl font-bold ${dailyStats.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                {dailyStats.winRate.toFixed(0)}%
              </div>
            </div>
            <div className="crypto-card p-3">
              <div className="text-xs text-gray-400">P&L Jour</div>
              <div className={`text-2xl font-bold ${dailyStats.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPrice(dailyStats.pnl)}
              </div>
            </div>
            <div className="crypto-card p-3">
              <div className="text-xs text-gray-400">Semaine</div>
              <div className={`text-2xl font-bold ${weeklyStats.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPrice(weeklyStats.pnl)}
              </div>
              <div className="text-xs text-gray-500">{weeklyStats.trades} trades</div>
            </div>
          </div>

          {/* Daily Journal Entry */}
          <div className="crypto-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-crypto-blue" />
              Journal du Jour
            </h3>
            
            {dailyStats.trades === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Aucun trade ce jour</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary */}
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Résumé</h4>
                  <p className="text-gray-400 text-sm">
                    {dailyStats.wins} trade{dailyStats.wins > 1 ? 's' : ''} gagnant{dailyStats.wins > 1 ? 's' : ''} et {dailyStats.losses} perdant{dailyStats.losses > 1 ? 's' : ''}. 
                    P&L net de {formatPrice(dailyStats.pnl)}.
                  </p>
                </div>
                
                {/* Trades of the day */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Trades de la journée</h4>
                  <div className="space-y-2">
                    {trades
                      .filter(t => isSameDay(new Date(t.entryTime), selectedDate))
                      .map(t => (
                        <div key={t._id} className="flex items-center justify-between p-2 bg-slate-800/30 rounded">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{t.symbol}</span>
                            <span className={`text-xs ${t.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                              {t.side?.toUpperCase()}
                            </span>
                          </div>
                          <span className={`font-mono ${(t.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatPrice(t.pnl || 0)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BEHAVIOR TAB */}
      {activeTab === 'behavior' && (
        <div className="space-y-6">
          {/* Behavioral Patterns */}
          <div className="crypto-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-crypto-blue" />
              Patterns Comportementaux Détectés
            </h3>
            
            {behavioralPatterns.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-400 opacity-50" />
                <p>Aucun pattern négatif détecté</p>
                <p className="text-sm mt-1">Continuez à documenter vos trades pour une analyse plus précise</p>
              </div>
            ) : (
              <div className="space-y-4">
                {behavioralPatterns.map((pattern, i) => (
                  <div 
                    key={i} 
                    className={`p-4 rounded-lg border ${
                      pattern.severity === 'high' 
                        ? 'border-red-500/30 bg-red-500/10' 
                        : 'border-yellow-500/30 bg-yellow-500/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={`w-5 h-5 ${
                          pattern.severity === 'high' ? 'text-red-400' : 'text-yellow-400'
                        }`} />
                        <div>
                          <h4 className="font-medium text-white capitalize">
                            {pattern.type.replace('_', ' ')}
                          </h4>
                          <p className="text-sm text-gray-400">{pattern.description}</p>
                        </div>
                      </div>
                      <div className={`text-right ${pattern.impact >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        <div className="font-bold">{formatPrice(pattern.impact)}</div>
                        <div className="text-xs">impact P&L</div>
                      </div>
                    </div>
                    <div className="mt-3 p-3 bg-slate-800/50 rounded">
                      <span className="text-crypto-blue text-sm">💡 Recommandation:</span>
                      <p className="text-gray-300 text-sm mt-1">{pattern.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Emotion Distribution */}
          <div className="crypto-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Smile className="w-5 h-5 text-crypto-blue" />
              Distribution des Émotions
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {EMOTIONS.map(emotion => {
                const count = trades.filter(t => {
                  const entry = journalEntries[t._id || ''];
                  return entry?.note?.emotion === emotion.value;
                }).length;
                
                const total = Object.keys(journalEntries).length;
                const percentage = total > 0 ? (count / total) * 100 : 0;
                
                return (
                  <div key={emotion.value} className={`p-3 rounded-lg ${emotion.bg}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <emotion.icon className={`w-4 h-4 ${emotion.color}`} />
                      <span className={`text-sm font-medium ${emotion.color}`}>{emotion.label}</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{count}</div>
                    <div className="text-xs text-gray-400">{percentage.toFixed(0)}% des trades notés</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ANALYTICS TAB */}
      {activeTab === 'analytics' && (
        <div className="crypto-card">
          <h3 className="font-semibold mb-4">Corrélations Comportement-Performance</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Performance by Emotion */}
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-3">Performance par Émotion</h4>
              <div className="space-y-2">
                {EMOTIONS.map(emotion => {
                  const tradesWithEmotion = trades.filter(t => {
                    const entry = journalEntries[t._id || ''];
                    return entry?.note?.emotion === emotion.value && t.pnl !== undefined;
                  });
                  
                  if (tradesWithEmotion.length === 0) return null;
                  
                  const avgPnL = tradesWithEmotion.reduce((sum, t) => sum + (t.pnl || 0), 0) / tradesWithEmotion.length;
                  
                  return (
                    <div key={emotion.value} className="flex items-center justify-between p-2 bg-slate-800/30 rounded">
                      <div className="flex items-center gap-2">
                        <emotion.icon className={`w-4 h-4 ${emotion.color}`} />
                        <span className="text-sm">{emotion.label}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">{tradesWithEmotion.length} trades</span>
                        <span className={`font-mono ${avgPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {avgPnL >= 0 ? '+' : ''}{formatPrice(avgPnL)}/trade
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Performance by Mistake */}
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-3">Coût des Erreurs</h4>
              <div className="space-y-2">
                {COMMON_MISTAKES.map(mistake => {
                  const tradesWithMistake = trades.filter(t => {
                    const entry = journalEntries[t._id || ''];
                    return entry?.note?.mistakes?.includes(mistake) && t.pnl !== undefined;
                  });
                  
                  if (tradesWithMistake.length === 0) return null;
                  
                  const totalPnL = tradesWithMistake.reduce((sum, t) => sum + (t.pnl || 0), 0);
                  
                  return (
                    <div key={mistake} className="flex items-center justify-between p-2 bg-slate-800/30 rounded">
                      <span className="text-sm">{mistake}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">{tradesWithMistake.length}x</span>
                        <span className={`font-mono ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatPrice(totalPnL)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && selectedTrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-crypto-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Notes du Trade</h3>
                <p className="text-sm text-gray-400">{selectedTrade.symbol} - {formatDate(new Date(selectedTrade.entryTime))}</p>
              </div>
              <button
                onClick={() => setShowNoteModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Why */}
              <div>
                <label className="text-sm text-gray-400 block mb-2">Pourquoi avez-vous pris ce trade?</label>
                <textarea
                  value={noteForm.why}
                  onChange={(e) => setNoteForm(prev => ({ ...prev, why: e.target.value }))}
                  className="w-full bg-slate-800 border border-crypto-border rounded-lg px-3 py-2 h-20 resize-none"
                  placeholder="Décrivez votre raisonnement..."
                />
              </div>

              {/* Emotion */}
              <div>
                <label className="text-sm text-gray-400 block mb-2">Comment vous sentiez-vous?</label>
                <div className="flex flex-wrap gap-2">
                  {EMOTIONS.map(emotion => (
                    <button
                      key={emotion.value}
                      onClick={() => setNoteForm(prev => ({ ...prev, emotion: emotion.value as any }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                        noteForm.emotion === emotion.value
                          ? emotion.bg
                          : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                    >
                      <emotion.icon className={`w-4 h-4 ${emotion.color}`} />
                      <span className={`text-sm ${noteForm.emotion === emotion.value ? emotion.color : 'text-gray-400'}`}>
                        {emotion.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mistakes */}
              <div>
                <label className="text-sm text-gray-400 block mb-2">Erreurs commises (optionnel)</label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_MISTAKES.map(mistake => (
                    <button
                      key={mistake}
                      onClick={() => {
                        setNoteForm(prev => ({
                          ...prev,
                          mistakes: prev.mistakes?.includes(mistake)
                            ? prev.mistakes.filter(m => m !== mistake)
                            : [...(prev.mistakes || []), mistake]
                        }));
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                        noteForm.mistakes?.includes(mistake)
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                      }`}
                    >
                      {mistake}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lessons */}
              <div>
                <label className="text-sm text-gray-400 block mb-2">Leçons apprises</label>
                <textarea
                  value={noteForm.lessons}
                  onChange={(e) => setNoteForm(prev => ({ ...prev, lessons: e.target.value }))}
                  className="w-full bg-slate-800 border border-crypto-border rounded-lg px-3 py-2 h-20 resize-none"
                  placeholder="Que retiendrez-vous de ce trade?"
                />
              </div>

              {/* Screenshot */}
              <div>
                <label className="text-sm text-gray-400 block mb-2">Screenshot (optionnel)</label>
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 p-4 bg-slate-800 border border-dashed border-crypto-border rounded-lg cursor-pointer hover:bg-slate-700 transition-all">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-400">Cliquez pour uploader</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = await handleScreenshotUpload(file);
                          setNoteForm(prev => ({ ...prev, screenshotUrl: url }));
                        }
                      }}
                    />
                  </label>
                </div>
                {noteForm.screenshotUrl && (
                  <div className="mt-2 relative">
                    <img 
                      src={noteForm.screenshotUrl} 
                      alt="Screenshot" 
                      className="max-w-full h-32 object-cover rounded-lg border border-crypto-border"
                    />
                    <button
                      onClick={() => setNoteForm(prev => ({ ...prev, screenshotUrl: '' }))}
                      className="absolute top-2 right-2 p-1 bg-red-500/80 rounded-full text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <button
                onClick={saveNote}
                className="w-full py-3 bg-crypto-blue hover:bg-crypto-blue/80 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Sauvegarder les Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Modal */}
      {showAIAnalysis && aiAnalysis && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-purple-400">
                <Brain className="w-5 h-5" />
                Analyse IA de votre Journal
              </h3>
              <button
                onClick={() => setShowAIAnalysis(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {aiAnalysis.insights?.map((insight: any, i: number) => (
                <div key={i} className="p-4 bg-slate-800/50 rounded-lg">
                  <h4 className="font-medium text-crypto-blue mb-2">{insight.title}</h4>
                  <p className="text-gray-300 text-sm">{insight.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
