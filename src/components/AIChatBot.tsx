import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, Minimize2, Maximize2, Bot, User, TrendingUp, TrendingDown, AlertTriangle, Brain, Maximize, Minimize, Settings, Play, Pause, ChevronRight, GripVertical, Zap, LineChart, Wallet, BarChart3, Flame, Cpu, Activity, BookOpen, Move } from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';
import * as ethernalService from '../services/ethernalService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'analysis' | 'strategy' | 'alert' | 'general';
}

// Auto-trading configuration interface
interface AutoTradingConfig {
  enabled: boolean;
  strategy: 'conservative' | 'moderate' | 'aggressive';
  maxRiskPerTrade: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  autoBuy: boolean;
  autoSell: boolean;
  minConfidence: number;
}

// Global auto-trading state (persisted in localStorage)
const getAutoTradingConfig = (): AutoTradingConfig => {
  const saved = localStorage.getItem('ethernal_auto_trading');
  if (saved) {
    return JSON.parse(saved);
  }
  return {
    enabled: false,
    strategy: 'moderate',
    maxRiskPerTrade: 2,
    stopLossPercent: 3,
    takeProfitPercent: 6,
    autoBuy: false,
    autoSell: false,
    minConfidence: 70,
  };
};

const saveAutoTradingConfig = (config: AutoTradingConfig) => {
  localStorage.setItem('ethernal_auto_trading', JSON.stringify(config));
};

// Execute auto-trading action
const executeAutoTrade = async (action: 'buy' | 'sell', symbol: string, price: number, confidence: number) => {
  const config = getAutoTradingConfig();
  if (!config.enabled) return;
  
  if (confidence < config.minConfidence) {
    return;
  }
  
  if (action === 'buy' && !config.autoBuy) return;
  if (action === 'sell' && !config.autoSell) return;
  
  
  // Here you would integrate with Binance API for real execution
  // For now, we just log and create an alert
  const alerts = JSON.parse(localStorage.getItem('ethernal_alerts') || '[]');
  alerts.push({
    id: Date.now(),
    type: action,
    symbol,
    price,
    confidence,
    timestamp: new Date().toISOString(),
    executed: false,
  });
  localStorage.setItem('ethernal_alerts', JSON.stringify(alerts));
};

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Get API key from user settings (localStorage) or fallback to env
const getGroqApiKey = (): string => {
  try {
    const settings = localStorage.getItem('trading_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.groqApiKey && parsed.groqApiKey !== 'ta_cle_groq_ici') {
        return parsed.groqApiKey;
      }
    }
  } catch (e) {
    // Silent fail
  }
  return import.meta.env.VITE_GROQ_API_KEY || '';
};

// Rate limiting for AIChatBot
let lastChatRequestTime = 0;
let chatConsecutive429Errors = 0;
const CHAT_RATE_LIMIT_DELAY = 3000; // 3 seconds between chat requests
const CHAT_MAX_RETRIES = 2;
const CHAT_INITIAL_BACKOFF = 10000; // 10 secondes

export function AIChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `🧠 **Ethernal** - IA Trading Intelligente de NEUROVEST\n\n⚡ **Commandes Rapides:**\n• \\"setup BTC\\" → Setup complet avec Entry/SL/TP\n• \\"analyse mes trades\\" → Détecte tes erreurs\n• \\"résume mon portfolio\\" → Vue d'ensemble\n• \\"meilleur trade maintenant\\" → Top opportunité\n• \\"lance bot safe\\" → Démarre le bot\n• \\"fear greed\\" → Sentiment marché\n• \\"apprentissage\\" → Ta mémoire IA\n\n📊 **Je connais:**\n✓ Ton portfolio et trades\n✓ Tes patterns gagnants/perdants\n✓ Les données marché en temps réel\n✓ Ton style de trading\n\n💡 *Pose-moi une question ou utilise les boutons rapides ci-dessous*`,
      timestamp: new Date(),
      type: 'general'
    }
  ]);

  // Clear any cached messages to ensure welcome message shows correctly
  useEffect(() => {
    localStorage.removeItem('ethernal_chat_messages');
  }, []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 🎯 Draggable chat window position
  const [chatPosition, setChatPosition] = useState(() => {
    const saved = localStorage.getItem('ethernal_chat_position');
    return saved ? JSON.parse(saved) : { x: window.innerWidth - 400, y: window.innerHeight - 650 };
  });
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const chatDragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  
  const prices = useCryptoStore((state) => state.prices);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);
  const candleData = useCryptoStore((state) => state.candleData);

  // Scroll only when user sends a message, not during AI response
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessageToGroq = async (userMessage: string, context: string, retryCount = 0): Promise<string> => {
    // Rate limiting check with exponential backoff
    const now = Date.now();
    const timeSinceLastRequest = now - lastChatRequestTime;
    
    const backoffDelay = chatConsecutive429Errors > 0
      ? Math.min(CHAT_INITIAL_BACKOFF * Math.pow(2, chatConsecutive429Errors - 1), 60000)
      : CHAT_RATE_LIMIT_DELAY;
    
    if (timeSinceLastRequest < backoffDelay) {
      const waitTime = backoffDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    lastChatRequestTime = Date.now();
    
    const GROQ_API_KEY = getGroqApiKey();
    if (!GROQ_API_KEY) {
      return '⚠️ **Clé API Groq manquante**\n\nVeuillez configurer votre clé API Groq dans les Paramètres du site pour activer l\'IA.';
    }

    const systemPrompt = `Tu es **Ethernal**, IA de trading professionnelle. Tu analyses le marché et tu DÉCIDES.

⚠️ RÈGLE ABSOLUE: Réponse COURTE + STRUCTURÉE + DÉCISIONNELLE. Pas de blabla.

🎯 FORMAT OBLIGATOIRE (respecte exactement):
📊 PAIRE: [SYMBOL]/USDT
📈 DIRECTION: ACHAT / VENTE / ATTENTE

🎯 ENTRÉE: [prix exact]
🛑 STOP LOSS: [prix exact]
💰 TAKE PROFIT: [prix exact]

📊 RISQUE/GAIN: 1:[ratio]
🔥 CONFIANCE: [X]%
🧠 SCORE DU SETUP: [X]/100

🧠 ANALYSE (3 points max):
- [point clé 1]
- [point clé 2]
- [point clé 3]

⚠️ CONDITIONS: [condition d'invalidation ou ATTENTE]

🚫 INTERDIT:
- Pas de longues explications
- Pas de "peut-être", "environ", "ça dépend"
- Pas de découverte

✅ OBLIGATOIRE:
- Toujours donner ACHAT/VENTE/ATTENTE (jamais LONG/SHORT/WAIT)
- Prix exacts (pas de fourchettes)
- SL et TP toujours présents
- Si setup mauvais → répond ATTENTE

CONTEXTE MARCHÉ:
${context}

TYPE: ${detectQueryType(userMessage)}`;

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getGroqApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          chatConsecutive429Errors++;
          if (retryCount < CHAT_MAX_RETRIES) {
            return sendMessageToGroq(userMessage, context, retryCount + 1);
          }
          return '⏳ **API Groq saturée**\n\nTrop de requêtes. Veuillez attendre 30-60 secondes avant de réessayer.';
        }
        throw new Error(`HTTP ${response.status}`);
      }

      // Reset consecutive errors on success
      chatConsecutive429Errors = 0;

      const data = await response.json();
      return data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer de réponse.';
    } catch (error) {
      // Silent fail
      return '❌ **Erreur de connexion**\n\nL\'API Groq est temporairement indisponible. Vérifie ta connexion ou réessaie plus tard.';
    }
  };

  const detectQueryType = (message: string): string => {
    const lower = message.toLowerCase();
    
    // Analyses techniques détaillées
    if (lower.includes('setup') || lower.includes('opportunité')) return 'SETUP_TRADING: Fournir un setup complet avec entrée/SL/TP/R:G';
    if (lower.includes('analyse technique') || lower.includes('analyser') || lower.includes('technique')) return 'ANALYSE_TECHNIQUE: RSI, MACD, BB, volume, structure';
    if (lower.includes('tendance') || lower.includes('trend')) return 'ANALYSE_TENDANCE: Multi-timeframe 15m/1h/4h/1D';
    if (lower.includes('support') || lower.includes('resistance') || lower.includes('niveau')) return 'ZONES_CLES: Support, resistance, supply/demand';
    if (lower.includes('pattern') || lower.includes('bougie') || lower.includes('figure')) return 'PATTERN_ANALYSE: Price action, figures chartistes';
    if (lower.includes('volume') || lower.includes('volatilité')) return 'VOLUME_VOLATILITE: Analyse volume et ATR';
    
    // Signaux et recommandations (FRANÇAIS)
    if (lower.includes('signal') || lower.includes('signaux')) return 'SIGNAL_PRO: Direction + Entrée + SL + TP + Confiance';
    if (lower.includes('acheter') || lower.includes('achat') || lower.includes('long')) return 'TRADE_ACHAT: Setup ACHAT avec risque/gain';
    if (lower.includes('vendre') || lower.includes('vente') || lower.includes('short')) return 'TRADE_VENTE: Setup VENTE avec risque/gain';
    if (lower.includes('alerte')) return 'ALERTE_PRIX: Configuration alerte';
    
    // Gestion
    if (lower.includes('stratégie') || lower.includes('strategy')) return 'STRATEGIE_TRADING: Plan d\'action global';
    if (lower.includes('risque') || lower.includes('risk') || lower.includes('calcul')) return 'GESTION_RISQUE: Position sizing, SL';
    if (lower.includes('portefeuille') || lower.includes('wallet')) return 'ANALYSE_PORTEFEUILLE: Performance, diversification';
    
    return 'GENERAL: Réponse d\'expert trading concis';
  };

  const getMarketContext = (): string => {
    const currentPrice = prices.get(selectedSymbol);
    const candles = candleData.slice(-30);
    
    let context = `SYMBOL: ${selectedSymbol}\n`;
    
    if (currentPrice) {
      context += `PRICE: $${currentPrice.price.toFixed(2)}\n`;
      context += `24H CHANGE: ${currentPrice.change24h.toFixed(2)}%\n`;
      context += `RANGE: $${currentPrice.low24h.toFixed(0)} - $${currentPrice.high24h.toFixed(0)}\n`;
    }
    
    if (candles.length > 20) {
      const closes = candles.map(c => c.close);
      const lastClose = closes[closes.length - 1];
      
      // Calculs rapides
      const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const rsi = calculateRSI(closes.slice(-14));
      const trend = lastClose > closes[0] ? 'UP' : 'DOWN';
      
      // Support/Resistance
      const support = Math.min(...candles.slice(-20).map(c => c.low));
      const resistance = Math.max(...candles.slice(-20).map(c => c.high));
      
      context += `\nRSI: ${rsi.toFixed(1)}\n`;
      context += `TREND: ${trend}\n`;
      context += `SMA20: $${sma20.toFixed(2)} (${lastClose > sma20 ? 'ABOVE' : 'BELOW'})\n`;
      context += `SUPPORT: $${support.toFixed(2)}\n`;
      context += `RESISTANCE: $${resistance.toFixed(2)}\n`;
      
      // Dernière bougie
      const last = candles[candles.length - 1];
      context += `\nLAST CANDLE: ${last.close > last.open ? 'BULLISH' : 'BEARISH'} (O:$${last.open.toFixed(0)} C:$${last.close.toFixed(0)})`;
    }
    
    return context;
  };
  
  // Calcul RSI simplifié
  const calculateRSI = (closes: number[]): number => {
    if (closes.length < 2) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    const avgGain = gains / closes.length;
    const avgLoss = losses / closes.length;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    scrollToBottom();

    try {
      // Utiliser le backend Ethernal (intelligent) au lieu de Groq direct
      const result = await ethernalService.sendMessage(input);
      const response = result.response;

      // Add message with typing effect
      const messageId = (Date.now() + 1).toString();
      const msgType = detectQueryType(input).toLowerCase() as any;
      
      const emptyMessage: Message = {
        id: messageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        type: msgType,
      };
      
      setMessages(prev => [...prev, emptyMessage]);
      
      // Type words one by one
      const words = response.split(' ');
      let currentContent = '';
      
      for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 30));
        currentContent += (i > 0 ? ' ' : '') + words[i];
        
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: currentContent }
            : msg
        ));
      }
    } catch (error: any) {
      // Fallback sur Groq direct si le backend échoue
      console.warn('[AIChatBot] Backend Ethernal indisponible, fallback sur Groq:', error);
      const context = getMarketContext();
      const response = await sendMessageToGroq(input, context);
      
      const messageId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: messageId,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        type: 'general'
      }]);
    }
    
    setIsLoading(false);
  };

  // Quick actions intelligents et contextuels avec icônes React
  const quickActions = [
    { label: `Setup ${selectedSymbol.replace('USDT', '')}`, icon: Zap, query: `setup ${selectedSymbol}` },
    { label: 'Analyse', icon: LineChart, query: `analyse ${selectedSymbol}` },
    { label: 'Portfolio', icon: Wallet, query: 'résume mon portfolio' },
    { label: 'Mes Trades', icon: BarChart3, query: 'analyse mes trades' },
    { label: 'Meilleur Setup', icon: Flame, query: 'meilleur trade maintenant' },
    { label: 'Lancer Bot', icon: Cpu, query: 'lance bot safe' },
    { label: 'Fear & Greed', icon: Activity, query: 'fear greed' },
    { label: 'Mémoire IA', icon: BookOpen, query: 'apprentissage' },
  ];

  // Format Ethernal trading response with professional styling
  const formatEthernalResponse = (text: string): React.ReactNode => {
    if (!text) return null;
    
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let key = 0;
    
    // Style mappings for different line types (FRANÇAIS)
    const getLineStyle = (line: string): { className: string; icon?: React.ReactNode } => {
      if (line.includes('📊 PAIRE:') || line.includes('📊 PAIR:')) return { className: 'text-blue-400 font-bold text-sm', icon: '📊' };
      if (line.includes('📈 DIRECTION:')) {
        if (line.includes('ACHAT') || line.includes('LONG')) return { className: 'text-green-400 font-bold text-lg', icon: '📈' };
        if (line.includes('VENTE') || line.includes('SHORT')) return { className: 'text-red-400 font-bold text-lg', icon: '📉' };
        if (line.includes('ATTENTE') || line.includes('WAIT')) return { className: 'text-yellow-400 font-bold text-lg', icon: '⏸️' };
        return { className: 'text-yellow-400 font-bold text-lg', icon: '⏸️' };
      }
      if (line.includes('🎯 ENTRÉE:') || line.includes('🎯 ENTRY:')) return { className: 'text-white font-bold', icon: '🎯' };
      if (line.includes('🛑 STOP LOSS:')) return { className: 'text-red-400 font-bold', icon: '🛑' };
      if (line.includes('💰 TAKE PROFIT:')) return { className: 'text-green-400 font-bold', icon: '💰' };
      if (line.includes('📊 RISQUE/GAIN:') || line.includes('📊 RISK/REWARD:')) return { className: 'text-blue-400 font-bold', icon: '📊' };
      if (line.includes('🔥 CONFIANCE:') || line.includes('🔥 CONFIDENCE:')) return { className: 'text-orange-400 font-bold', icon: '🔥' };
      if (line.includes('🧠 SCORE DU SETUP:') || line.includes('🧠 SETUP SCORE:')) return { className: 'text-purple-400 font-bold', icon: '🧠' };
      if (line.includes('🧠 ANALYSE:')) return { className: 'text-gray-300 font-semibold mt-2 border-t border-gray-700 pt-2', icon: '🧠' };
      if (line.includes('⚠️ CONDITIONS:')) return { className: 'text-yellow-500 font-semibold mt-2', icon: '⚠️' };
      if (line.trim().startsWith('-')) return { className: 'text-gray-400 pl-4 text-xs' };
      return { className: 'text-gray-300' };
    };
    
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        elements.push(<div key={key++} className="h-1" />);
        return;
      }
      
      const style = getLineStyle(line);
      
      // Process inline markdown (bold, italic, code) + highlight numbers
      const processInlineWithMarkdown = (text: string) => {
        const result: React.ReactNode[] = [];
        let remaining = text;
        let idx = 0;
        
        while (remaining.length > 0) {
          // Find patterns: bold, italic, code, numbers
          const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
          const italicMatch = remaining.match(/\*(.+?)\*/);
          const codeMatch = remaining.match(/`(.+?)`/);
          const numberMatch = remaining.match(/\$?[\d,]+\.?\d*/);
          
          let nextMatch: { type: 'bold' | 'italic' | 'code' | 'number'; index: number; content: string; fullMatch: string } | null = null;
          
          if (boldMatch) nextMatch = { type: 'bold', index: boldMatch.index || 0, content: boldMatch[1], fullMatch: boldMatch[0] };
          if (italicMatch) {
            if (!nextMatch || italicMatch.index! < nextMatch.index) {
              nextMatch = { type: 'italic', index: italicMatch.index || 0, content: italicMatch[1], fullMatch: italicMatch[0] };
            }
          }
          if (codeMatch) {
            if (!nextMatch || codeMatch.index! < nextMatch.index) {
              nextMatch = { type: 'code', index: codeMatch.index || 0, content: codeMatch[1], fullMatch: codeMatch[0] };
            }
          }
          if (numberMatch) {
            if (!nextMatch || numberMatch.index! < nextMatch.index) {
              nextMatch = { type: 'number', index: numberMatch.index || 0, content: numberMatch[0], fullMatch: numberMatch[0] };
            }
          }
          
          if (nextMatch) {
            if (nextMatch.index > 0) {
              result.push(<span key={idx++}>{remaining.substring(0, nextMatch.index)}</span>);
            }
            
            switch (nextMatch.type) {
              case 'bold':
                result.push(<strong key={idx++} className="font-bold text-white">{nextMatch.content}</strong>);
                break;
              case 'italic':
                result.push(<em key={idx++} className="italic text-gray-300">{nextMatch.content}</em>);
                break;
              case 'code':
                result.push(<code key={idx++} className="px-1 py-0.5 bg-gray-700 rounded text-xs font-mono text-yellow-300 border border-gray-600">{nextMatch.content}</code>);
                break;
              case 'number':
                result.push(<span key={idx++} className="text-white font-mono font-bold">{nextMatch.content}</span>);
                break;
            }
            
            remaining = remaining.substring(nextMatch.index + nextMatch.fullMatch.length);
          } else {
            result.push(<span key={idx++}>{remaining}</span>);
            break;
          }
        }
        
        return result;
      };
      
      elements.push(
        <div key={key++} className={`${style.className} py-0.5`}>
          {processInlineWithMarkdown(line)}
        </div>
      );
    });
    
    return <div className="font-mono leading-relaxed">{elements}</div>;
  };

  // Enhanced Markdown parser
  const parseMarkdown = (text: string): React.ReactNode => {
    if (!text) return null;
    
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let key = 0;
    let inList = false;
    let listItems: React.ReactNode[] = [];

    // Process inline markdown (bold, italic, code)
    const processInline = (text: string): React.ReactNode[] => {
      const result: React.ReactNode[] = [];
      let remaining = text;
      let idx = 0;

      while (remaining.length > 0) {
        // Find bold (**text**)
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        // Find italic (*text*) - single asterisks only
        const italicMatch = remaining.match(/\*(.+?)\*/);
        // Find code (`text`)
        const codeMatch = remaining.match(/`(.+?)`/);

        let nextMatch: { type: 'bold' | 'italic' | 'code'; index: number; content: string; fullMatch: string } | null = null;

        if (boldMatch) {
          nextMatch = { type: 'bold', index: boldMatch.index || 0, content: boldMatch[1], fullMatch: boldMatch[0] };
        }
        if (italicMatch) {
          if (!nextMatch || italicMatch.index! < nextMatch.index) {
            nextMatch = { type: 'italic', index: italicMatch.index || 0, content: italicMatch[1], fullMatch: italicMatch[0] };
          }
        }
        if (codeMatch) {
          if (!nextMatch || codeMatch.index! < nextMatch.index) {
            nextMatch = { type: 'code', index: codeMatch.index || 0, content: codeMatch[1], fullMatch: codeMatch[0] };
          }
        }

        if (nextMatch) {
          if (nextMatch.index > 0) {
            result.push(<span key={idx++}>{remaining.substring(0, nextMatch.index)}</span>);
          }
          if (nextMatch.type === 'bold') {
            result.push(<strong key={idx++} className="font-bold text-white">{nextMatch.content}</strong>);
          } else if (nextMatch.type === 'italic') {
            result.push(<em key={idx++} className="italic text-gray-300">{nextMatch.content}</em>);
          } else if (nextMatch.type === 'code') {
            result.push(<code key={idx++} className="px-1.5 py-0.5 bg-gray-700 rounded text-xs font-mono text-yellow-300 border border-gray-600">{nextMatch.content}</code>);
          }
          remaining = remaining.substring(nextMatch.index + nextMatch.fullMatch.length);
        } else {
          result.push(<span key={idx++}>{remaining}</span>);
          break;
        }
      }

      return result;
    };

    lines.forEach((line) => {
      const trimmed = line.trim();
      
      // Empty line - close any open list
      if (!trimmed) {
        if (inList) {
          elements.push(<ul key={key++} className="list-none mb-3">{listItems}</ul>);
          inList = false;
          listItems = [];
        }
        return;
      }
      
      // Headers (###, ##, #)
      const headerMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (headerMatch) {
        if (inList) {
          elements.push(<ul key={key++} className="list-none mb-3">{listItems}</ul>);
          inList = false;
          listItems = [];
        }
        const level = headerMatch[1].length;
        const content = headerMatch[2];
        const sizeClass = level === 1 ? 'text-xl' : level === 2 ? 'text-lg' : 'text-base';
        elements.push(
          <h3 key={key++} className={`${sizeClass} font-bold text-white mt-4 mb-2`}>
            {processInline(content)}
          </h3>
        );
        return;
      }
      
      // Separator (---, ===)
      if (trimmed.match(/^[-=]{3,}$/)) {
        if (inList) {
          elements.push(<ul key={key++} className="list-none mb-3">{listItems}</ul>);
          inList = false;
          listItems = [];
        }
        elements.push(<hr key={key++} className="border-gray-700 my-3" />);
        return;
      }
      
      // Bullet point (-, *, •)
      const bulletMatch = trimmed.match(/^([\*\-\•])\s+(.+)$/);
      if (bulletMatch) {
        if (!inList) {
          inList = true;
          listItems = [];
        }
        listItems.push(
          <li key={key++} className="ml-4 mb-1 text-gray-200 flex items-start gap-2">
            <span className="text-blue-400 mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
            <span className="flex-1">{processInline(bulletMatch[2])}</span>
          </li>
        );
        return;
      }
      
      // Numbered list (1., 2., etc.)
      const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        if (!inList) {
          inList = true;
          listItems = [];
        }
        listItems.push(
          <li key={key++} className="ml-4 mb-1 text-gray-200 flex items-start gap-2">
            <span className="text-blue-400 font-medium min-w-[1.5rem]">{numberedMatch[1]}.</span>
            <span className="flex-1">{processInline(numberedMatch[2])}</span>
          </li>
        );
        return;
      }
      
      // Regular paragraph
      if (inList) {
        elements.push(<ul key={key++} className="list-none mb-3">{listItems}</ul>);
        inList = false;
        listItems = [];
      }
      elements.push(<p key={key++} className="mb-2 text-gray-200 leading-relaxed">{processInline(trimmed)}</p>);
    });

    // Close any open list at end
    if (inList && listItems.length > 0) {
      elements.push(<ul key={key++} className="list-none mb-3">{listItems}</ul>);
    }

    return <div className="space-y-1">{elements}</div>;
  };

  // Draggable button position
  const [buttonPosition, setButtonPosition] = useState(() => {
    const saved = localStorage.getItem('ethernal_button_position');
    return saved ? JSON.parse(saved) : { y: window.innerHeight / 2 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startY: 0, initialY: 0, hasMoved: false });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = {
      startY: e.clientY,
      initialY: buttonPosition.y,
      hasMoved: false
    };
    setIsDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [buttonPosition.y]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    
    const deltaY = e.clientY - dragRef.current.startY;
    
    // Si on a déplacé de plus de 3px, c'est un drag
    if (Math.abs(deltaY) > 3) {
      dragRef.current.hasMoved = true;
    }
    
    const newY = Math.max(60, Math.min(window.innerHeight - 60, dragRef.current.initialY + deltaY));
    setButtonPosition({ y: newY });
  }, [isDragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
    
    // Sauvegarder la position
    localStorage.setItem('ethernal_button_position', JSON.stringify(buttonPosition));
    
    // Si on n'a pas bougé, c'est un clic → ouvrir le chat
    if (!dragRef.current.hasMoved) {
      setIsOpen(true);
    }
  }, [buttonPosition]);

  // 🎯 Chat window drag handlers
  const handleChatPointerDown = useCallback((e: React.PointerEvent) => {
    if (isMaximized) return; // Pas de drag en mode maximisé
    e.preventDefault();
    chatDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: chatPosition.x,
      initialY: chatPosition.y,
    };
    setIsDraggingChat(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [chatPosition, isMaximized]);

  const handleChatPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingChat) return;
    
    const deltaX = e.clientX - chatDragRef.current.startX;
    const deltaY = e.clientY - chatDragRef.current.startY;
    
    const newX = Math.max(10, Math.min(window.innerWidth - 420, chatDragRef.current.initialX + deltaX));
    const newY = Math.max(10, Math.min(window.innerHeight - 620, chatDragRef.current.initialY + deltaY));
    
    setChatPosition({ x: newX, y: newY });
  }, [isDraggingChat]);

  const handleChatPointerUp = useCallback((e: React.PointerEvent) => {
    setIsDraggingChat(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
    localStorage.setItem('ethernal_chat_position', JSON.stringify(chatPosition));
  }, [chatPosition]);

  if (!isOpen) {
    return (
      <div
        className={`fixed right-0 z-50 select-none group ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ top: `${buttonPosition.y}px`, transform: 'translateY(-50%)' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Tooltip Premium */}
        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-4 px-4 py-2.5 bg-gray-900/95 backdrop-blur-xl text-white text-xs rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none shadow-2xl border border-gray-700/50 z-50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-sm shadow-green-400/50" />
            <span className="font-bold">Ethernal AI</span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">Glisse ce bouton OU la fenêtre</span>
          </div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-gray-900 border-r border-t border-gray-700/50 rotate-45" />
        </div>

        {/* 🚀 Floating Tab Button Premium */}
        <div className="relative">
          {/* Outer glow ring */}
          <div 
            className="absolute -inset-1 rounded-l-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: 'linear-gradient(180deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
              filter: 'blur(8px)',
            }}
          />
          
          {/* Animated border */}
          <div 
            className="absolute -inset-[1px] rounded-l-2xl opacity-50"
            style={{
              background: 'linear-gradient(180deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6)',
              backgroundSize: '100% 300%',
              animation: 'gradient-shift 3s ease infinite',
            }}
          />
          
          {/* Main button */}
          <div 
            className={`relative w-9 h-24 rounded-l-2xl flex flex-col items-center justify-center gap-2 overflow-hidden transition-all duration-300 ${isDragging ? 'scale-95' : 'group-hover:scale-105'}`}
            style={{
              background: 'linear-gradient(180deg, #3b82f6 0%, #6366f1 30%, #8b5cf6 70%, #ec4899 100%)',
              boxShadow: '0 4px 25px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            {/* Shine overlay */}
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                animation: 'shine 2s ease-in-out infinite',
              }}
            />
            
            {/* Glass overlay */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
              }}
            />
            
            {/* Content */}
            <div className="relative flex flex-col items-center gap-2">
              {/* Drag indicator */}
              <div className="flex flex-col gap-[3px]">
                <div className="w-1 h-1 bg-white/50 rounded-full" />
                <div className="w-1 h-1 bg-white/50 rounded-full" />
                <div className="w-1 h-1 bg-white/50 rounded-full" />
              </div>
              
              {/* AI Icon with pulse */}
              <div className="relative">
                <Brain className="w-6 h-6 text-white drop-shadow-lg" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-md shadow-green-400/50 border-2 border-purple-600" />
                
                {/* Orbiting ring */}
                <div 
                  className="absolute inset-0 -m-1 rounded-full border border-white/20 animate-spin"
                  style={{ animationDuration: '3s' }}
                />
              </div>
              
              {/* Ethernal text */}
              <span 
                className="text-[8px] font-bold tracking-widest text-white/90 drop-shadow-md"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              >
                AI
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`fixed bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl sm:rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col transition-shadow ${isDraggingChat ? 'shadow-purple-500/30' : ''} ${isMinimized ? 'h-14 sm:h-16 w-80 lg:w-96' : isMaximized ? 'inset-4 sm:inset-auto sm:w-[700px] sm:h-[85vh] rounded-3xl' : 'h-[500px] lg:h-[600px] w-[380px] lg:w-[450px]'}`}
      style={
        isMaximized 
          ? { bottom: '20px', right: '20px' } 
          : { 
              left: `${chatPosition.x}px`, 
              top: `${chatPosition.y}px`,
              transform: isDraggingChat ? 'scale(1.01)' : 'scale(1)',
              transition: isDraggingChat ? 'none' : 'transform 0.2s ease',
            }
      }
    >
      {/* 🔥 Header Premium - Draggable */}
      <div 
        className={`relative overflow-hidden ${isMaximized ? '' : 'cursor-grab active:cursor-grabbing'}`}
        onPointerDown={handleChatPointerDown}
        onPointerMove={handleChatPointerMove}
        onPointerUp={handleChatPointerUp}
      >
        {/* Animated gradient background */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
            backgroundSize: '200% 200%',
            animation: 'gradient-shift 8s ease infinite',
          }}
        />
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-black/10 backdrop-blur-sm" />
        {/* Shine effect */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
            animation: 'shine 3s ease-in-out infinite',
          }}
        />
        
        <div className="relative p-4 flex items-center justify-between border-b border-white/20">
          <div className="flex items-center gap-3">
            {/* Drag indicator */}
            {!isMaximized && (
              <Move className="w-4 h-4 text-white/40" />
            )}
            <div className="relative">
              <div 
                className="p-2.5 rounded-xl backdrop-blur-md border border-white/30"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.1) 100%)',
                  boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
                }}
              >
                <Bot className="w-5 h-5 text-white drop-shadow-lg" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-purple-600 animate-pulse shadow-lg shadow-green-400/50" />
            </div>
            <div>
              <h3 
                className="font-bold text-base text-white drop-shadow-md"
                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
              >
                Ethernal AI
              </h3>
              <p className="text-blue-50 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-sm" />
                <span className="font-medium">En ligne</span>
                <span className="text-white/50">•</span>
                <span className="text-white/70">Trading Automatisé</span>
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }}
              className="p-2 hover:bg-white/20 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              {isMinimized ? <Maximize2 className="w-4 h-4 text-white drop-shadow" /> : <Minimize2 className="w-4 h-4 text-white drop-shadow" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMaximized(!isMaximized);
              }}
              className="p-2 hover:bg-white/20 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              {isMaximized ? <Minimize className="w-4 h-4 text-white drop-shadow" /> : <Maximize className="w-4 h-4 text-white drop-shadow" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="p-2 hover:bg-white/20 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <X className="w-4 h-4 text-white drop-shadow" />
            </button>
          </div>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* ✨ Quick Actions Premium */}
          <div 
            className="p-2 sm:p-3 border-b backdrop-blur-md"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.6) 100%)',
              borderColor: 'rgba(59, 130, 246, 0.2)',
            }}
          >
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {quickActions.map((action, idx) => {
                const IconComponent = action.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(action.query);
                      setTimeout(handleSend, 100);
                    }}
                    className="group flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-gray-200 text-[10px] sm:text-xs rounded-lg sm:rounded-xl whitespace-nowrap transition-all duration-300 hover:scale-105 active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(139, 92, 246, 0.25) 100%)';
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                      e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)';
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)';
                    }}
                  >
                    <IconComponent className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400 group-hover:text-blue-300 transition-colors" />
                    <span className="font-medium">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 💬 Messages Premium */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 sm:gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar avec glow */}
                <div className={`relative w-8 h-8 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700' 
                    : 'bg-gradient-to-br from-purple-500 via-purple-600 to-pink-600'
                }`}
                style={{
                  boxShadow: msg.role === 'user' 
                    ? '0 4px 15px rgba(59, 130, 246, 0.4), 0 0 30px rgba(59, 130, 246, 0.2)' 
                    : '0 4px 15px rgba(139, 92, 246, 0.4), 0 0 30px rgba(139, 92, 246, 0.2)',
                }}
                >
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-white drop-shadow" />
                  ) : (
                    <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white drop-shadow" />
                  )}
                  {/* Status indicator */}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${
                    msg.role === 'user' ? 'bg-blue-400' : 'bg-green-400 animate-pulse'
                  }`} />
                </div>
                
                {/* Message bubble */}
                <div className={`max-w-[88%] sm:max-w-[85%] p-3 sm:p-4 rounded-2xl text-xs sm:text-sm relative ${
                  msg.role === 'user' 
                    ? 'rounded-br-md' 
                    : 'rounded-bl-md'
                }`}
                style={{
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)'
                    : 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(59, 130, 246, 0.3)',
                  boxShadow: msg.role === 'user'
                    ? '0 4px 20px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                    : '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
                >
                  {/* Badge type */}
                  {msg.type === 'analysis' && msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 text-yellow-400 mb-2 text-xs font-bold">
                      <div className="w-5 h-5 rounded-md bg-yellow-400/20 flex items-center justify-center">
                        <TrendingUp className="w-3 h-3" />
                      </div>
                      <span>SIGNAL DE TRADING</span>
                    </div>
                  )}
                  {msg.type === 'alert' && msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 text-red-400 mb-2 text-xs font-bold">
                      <div className="w-5 h-5 rounded-md bg-red-400/20 flex items-center justify-center">
                        <AlertTriangle className="w-3 h-3" />
                      </div>
                      <span>ALERTE</span>
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.role === 'assistant' && (
                      (msg.content.includes('📊 PAIR:') || 
                       msg.content.includes('📊 PAIRE:') ||
                       msg.content.includes('📈 DIRECTION:')) &&
                      (msg.content.includes('ENTRÉE:') || msg.content.includes('ENTRY:'))
                    )
                      ? formatEthernalResponse(msg.content)
                      : parseMarkdown(msg.content)
                    }
                  </div>
                  
                  {/* Timestamp */}
                  <div className={`text-[10px] mt-2 flex items-center gap-1 ${
                    msg.role === 'user' ? 'text-blue-200/80' : 'text-gray-500'
                  }`}>
                    <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.role === 'user' && <span className="text-blue-300">✓</span>}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-purple-500 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white drop-shadow" />
                </div>
                <div 
                  className="p-3 sm:p-4 rounded-2xl rounded-bl-md"
                  style={{
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.6) 100%)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                  }}
                >
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400">Ethernal réflechit</span>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 🎯 Input Premium */}
          <div 
            className="p-3 sm:p-4 backdrop-blur-xl border-t"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
              borderColor: 'rgba(59, 130, 246, 0.2)',
            }}
          >
            <div className="flex gap-2">
              <div className="flex-1 relative group">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Pose ta question à Ethernal..."
                  className="w-full bg-gray-900/60 text-white placeholder-gray-500 px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl border text-sm transition-all duration-300 focus:outline-none"
                  style={{
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.05)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)';
                    e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3), 0 0 20px rgba(59, 130, 246, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                    e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.05)';
                  }}
                />
                {/* Input glow effect */}
                <div 
                  className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                  }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="relative overflow-hidden text-white p-3 sm:p-3.5 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
                  backgroundSize: '200% 200%',
                  boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundPosition = '100% 100%';
                  e.currentTarget.style.boxShadow = '0 6px 25px rgba(59, 130, 246, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundPosition = '0% 0%';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.4)';
                }}
              >
                <Send className="w-4 h-4 sm:w-5 sm:h-5 drop-shadow" />
              </button>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-2.5 text-center flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-sm shadow-green-400/50" />
              <span className="truncate">💡 Essaye: "Setup BTC", "Analyse ETH", "Meilleur trade"</span>
            </p>
          </div>
        </>
      )}
      
      {/* Animations CSS */}
      <style>{`
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
