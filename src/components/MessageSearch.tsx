import { useState } from 'react';
import { Search, X, ChevronUp, ChevronDown, MessageSquare } from 'lucide-react';

// Local Message interface definition
interface Message {
  id: string;
  userId: string | null;
  username: string;
  displayName: string;
  avatar: string;
  content: string;
  channelId: string;
  likes: number;
  timestamp: Date | number;
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
  mentions?: string[];
}

interface MessageSearchProps {
  messages: Message[];
  onJumpToMessage: (messageId: string) => void;
  onClose: () => void;
}

export default function MessageSearch({ messages, onJumpToMessage, onClose }: MessageSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const filtered = messages.filter(msg => 
      msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setResults(filtered);
    setCurrentIndex(0);
  };

  const navigateResult = (direction: 'prev' | 'next') => {
    if (results.length === 0) return;
    
    if (direction === 'prev') {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else {
      setCurrentIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    }
    
    if (results[currentIndex]) {
      onJumpToMessage(results[currentIndex].id);
    }
  };

  return (
    <div className="absolute top-16 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-[#1e1f22] rounded-xl border border-[#2f3136] shadow-2xl z-50">
      <div className="p-3">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher dans les messages..."
            className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none"
            autoFocus
          />
          {results.length > 0 && (
            <div className="flex items-center gap-1 text-sm text-gray-400">
              <span>{currentIndex + 1}</span>
              <span>/</span>
              <span>{results.length}</span>
            </div>
          )}
          {results.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateResult('prev')}
                className="p-1 hover:bg-[#40444b] rounded text-gray-400 hover:text-white transition-colors"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigateResult('next')}
                className="p-1 hover:bg-[#40444b] rounded text-gray-400 hover:text-white transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#40444b] rounded text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Results Preview */}
      {results.length > 0 && (
        <div className="border-t border-[#2f3136] max-h-48 overflow-y-auto">
          {results.slice(0, 5).map((msg, index) => (
            <button
              key={msg.id}
              onClick={() => {
                setCurrentIndex(index);
                onJumpToMessage(msg.id);
              }}
              className={`w-full p-3 text-left hover:bg-[#40444b]/50 transition-colors ${
                index === currentIndex ? 'bg-[#5865f2]/10' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-sm text-white">{msg.username}</span>
                <span className="text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                {msg.content}
              </p>
            </button>
          ))}
        </div>
      )}

      {query && results.length === 0 && (
        <div className="p-4 text-center text-gray-400 text-sm border-t border-[#2f3136]">
          Aucun message trouvé
        </div>
      )}
    </div>
  );
}
