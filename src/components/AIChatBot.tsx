import { useState, useRef, useEffect } from 'react';
import { Send, X, Minimize2, Maximize2, Bot, User, TrendingUp, AlertTriangle, Brain, Maximize, Minimize, Settings, Play, Pause } from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';

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
      content: '👋 Salut ! Je suis **Ethernal**, ton **Assistant Trading IA** personnel.\n\nJe peux t\'aider à :\n\n• 📊 Analyser les cryptos en temps réel\n• 🎯 Créer des stratégies de trading gagnantes\n• ⚠️ Identifier les signaux d\'alerte précoces\n• 🤖 Configurer le trading automatique\n• 📈 Optimiser tes profits et réduire les risques\n\nPose-moi tes questions ou demande-moi d\'activer le mode auto-trading !',
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

    const systemPrompt = `Tu es un expert en trading de cryptomonnaies avec 10+ ans d'expérience. 
Tu analyses le marché en temps réel et donnes des conseils précis, techniques et actionnables.

CONTEXTE ACTUEL DU MARCHÉ:
${context}

RÈGLES IMPORTANTES:
- Réponds en français de façon concise et professionnelle
- Utilise des emojis pour rendre la réponse engageante
- Donne des chiffres précis et des niveaux de prix quand pertinent
- Mentionne les risques quand nécessaire
- Structure ta réponse avec des bullet points si pertinent
- **TRES IMPORTANT**: Quand tu mentions un prix en dollars ($), ajoute toujours la conversion en FCFA (Francs CFA d'Afrique de l'Ouest) entre parenthèses en petit. Taux approximatif: 1 USD ≈ 600 FCFA
- Exemple: "Le prix actuel est $70,000 (42,000,000 FCFA)"

TYPE DE RÉPONSE ATTENDU:
${detectQueryType(userMessage)}`;

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
          max_tokens: 1000,
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
    if (lower.includes('analyse') || lower.includes('analyser')) return 'ANALYSE_TECHNIQUE';
    if (lower.includes('stratégie') || lower.includes('strategy')) return 'STRATEGIE_TRADING';
    if (lower.includes('signal') || lower.includes('alerte')) return 'SIGNAL_ALERTE';
    if (lower.includes('acheter') || lower.includes('vendre') || lower.includes('buy') || lower.includes('sell')) return 'RECOMMANDATION';
    return 'GENERAL';
  };

  const getMarketContext = (): string => {
    const currentPrice = prices.get(selectedSymbol);
    const candles = candleData.slice(-20);
    
    let context = `Crypto: ${selectedSymbol}\n`;
    
    if (currentPrice) {
      context += `Prix actuel: $${currentPrice.price.toLocaleString()}\n`;
      context += `Variation 24h: ${currentPrice.change24h.toFixed(2)}%\n`;
      context += `Volume 24h: $${(currentPrice.volume24h / 1e6).toFixed(2)}M\n`;
      context += `High/Low 24h: $${currentPrice.high24h.toLocaleString()} / $${currentPrice.low24h.toLocaleString()}\n`;
    }
    
    if (candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const trend = lastCandle.close > candles[0].open ? 'HAUSSIÈRE' : 'BAISSIÈRE';
      const volatility = ((lastCandle.high - lastCandle.low) / lastCandle.close * 100).toFixed(2);
      context += `\nTendance récente: ${trend}\n`;
      context += `Volatilité: ${volatility}%\n`;
      context += `Dernière bougie: Open $${lastCandle.open}, Close $${lastCandle.close}, High $${lastCandle.high}, Low $${lastCandle.low}\n`;
    }
    
    return context;
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
    scrollToBottom(); // Scroll only when user sends message

    const context = getMarketContext();
    const response = await sendMessageToGroq(input, context);

    // Add empty message first for typing effect
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
      await new Promise(resolve => setTimeout(resolve, 30)); // 30ms per word
      currentContent += (i > 0 ? ' ' : '') + words[i];
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: currentContent }
          : msg
      ));
    }
    
    setIsLoading(false);
  };

  const quickActions = [
    { label: '📊 Analyser', query: `Analyse ${selectedSymbol} pour moi` },
    { label: '🎯 Stratégie', query: 'Quelle stratégie pour aujourd\'hui?' },
    { label: '⚠️ Signaux', query: 'Y a-t-il des signaux d\'alerte?' },
    { label: '🤖 Auto-Trading', query: 'Configure le trading automatique' },
  ];

  // Enhanced Markdown parser
  const parseMarkdown = (text: string): React.ReactNode => {
    if (!text) return null;
    
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let key = 0;
    let inList = false;
    let listItems: React.ReactNode[] = [];

    // Process inline markdown (bold, italic)
    const processInline = (text: string): React.ReactNode[] => {
      const result: React.ReactNode[] = [];
      let remaining = text;
      let idx = 0;

      while (remaining.length > 0) {
        // Find bold (**text**)
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        // Find italic (*text*) - single asterisks only
        const italicMatch = remaining.match(/\*(.+?)\*/);

        let nextMatch: { type: 'bold' | 'italic'; index: number; content: string; fullMatch: string } | null = null;

        if (boldMatch) {
          nextMatch = { type: 'bold', index: boldMatch.index || 0, content: boldMatch[1], fullMatch: boldMatch[0] };
        }
        if (italicMatch) {
          if (!nextMatch || italicMatch.index! < nextMatch.index) {
            nextMatch = { type: 'italic', index: italicMatch.index || 0, content: italicMatch[1], fullMatch: italicMatch[0] };
          }
        }

        if (nextMatch) {
          if (nextMatch.index > 0) {
            result.push(<span key={idx++}>{remaining.substring(0, nextMatch.index)}</span>);
          }
          if (nextMatch.type === 'bold') {
            result.push(<strong key={idx++} className="font-bold text-white">{nextMatch.content}</strong>);
          } else {
            result.push(<em key={idx++} className="italic text-gray-300">{nextMatch.content}</em>);
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

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-2xl z-50 transition-all hover:scale-105 flex items-center gap-2 sm:gap-3 border border-white/10"
      >
        <div className="relative">
          <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 rounded-full border-2 border-blue-600" />
        </div>
        <span className="font-semibold text-xs sm:text-sm">Ethernal AI</span>
      </button>
    );
  }

  return (
    <div className={`fixed inset-x-4 sm:inset-auto sm:bottom-6 sm:right-6 bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl sm:rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col transition-all ${isMinimized ? 'bottom-4 h-14 sm:h-16 sm:w-80 lg:w-96' : isMaximized ? 'inset-0 sm:inset-auto sm:w-[700px] sm:h-[85vh] sm:right-4 sm:bottom-4 rounded-none sm:rounded-3xl' : 'bottom-4 top-20 sm:top-auto h-[calc(100vh-6rem)] sm:h-[500px] lg:h-[600px] sm:w-[380px] lg:w-[450px]'}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-purple-600" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base">Ethernal AI</h3>
            <p className="text-blue-100 text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              En ligne • Trading Automatisé
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4 text-white" /> : <Minimize2 className="w-4 h-4 text-white" />}
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
          >
            {isMaximized ? <Minimize className="w-4 h-4 text-white" /> : <Maximize className="w-4 h-4 text-white" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Quick Actions */}
          <div className="p-2 sm:p-3 bg-gray-800/50 border-b border-gray-700/50 backdrop-blur-sm">
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(action.query);
                    setTimeout(handleSend, 100);
                  }}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 text-gray-200 text-[10px] sm:text-xs rounded-lg sm:rounded-xl whitespace-nowrap transition-all border border-blue-600/20 hover:border-blue-600/40"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gradient-to-b from-gray-900 to-gray-950">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 sm:gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/20' : 'bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/20'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  )}
                </div>
                <div className={`max-w-[88%] sm:max-w-[85%] p-2.5 sm:p-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md shadow-lg shadow-blue-500/20' 
                    : 'bg-gray-800/90 backdrop-blur-sm text-gray-100 rounded-bl-md border border-gray-700/50 shadow-lg'
                }`}>
                  {msg.type === 'analysis' && msg.role === 'assistant' && (
                    <div className="flex items-center gap-1 text-yellow-400 mb-2 text-xs">
                      <TrendingUp className="w-3 h-3" />
                      <span>Analyse Technique</span>
                    </div>
                  )}
                  {msg.type === 'alert' && msg.role === 'assistant' && (
                    <div className="flex items-center gap-1 text-red-400 mb-2 text-xs">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Alerte</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{parseMarkdown(msg.content)}</div>
                  <div className={`text-xs mt-2 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="bg-gray-800/90 backdrop-blur-sm text-gray-200 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl rounded-bl-md border border-gray-700/50 shadow-lg">
                  <div className="flex gap-1.5 sm:gap-2">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full animate-bounce delay-100" />
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 sm:p-4 bg-gray-800/50 backdrop-blur-sm border-t border-gray-700/50">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Pose ta question..."
                className="flex-1 bg-gray-900/80 text-white placeholder-gray-400 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-gray-600/50 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm backdrop-blur-sm transition-all"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
              >
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-2 text-center flex items-center justify-center gap-1.5 sm:gap-2">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
              <span className="truncate">💡 Essaye: "Analyse BTC", "Stratégie scalping", "Signaux"</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
