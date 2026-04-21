import { useState, useEffect } from 'react';
import { Search, X, TrendingUp, Clock } from 'lucide-react';
import { giphyApi } from '../services/socialApi';

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'trending' | 'search'>('trending');

  // Load trending GIFs on mount
  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    setIsLoading(true);
    const trending = await giphyApi.trending(20);
    setGifs(trending);
    setIsLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setActiveTab('search');
    const results = await giphyApi.search(searchQuery, 20);
    setGifs(results);
    setIsLoading(false);
  };

  return (
    <div className="absolute bottom-full right-0 mb-2 w-80 bg-[#1e1f22] rounded-xl border border-[#2f3136] shadow-2xl z-50">
      {/* Header */}
      <div className="p-3 border-b border-[#2f3136]">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-white">GIFs</span>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Search */}
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher des GIFs..."
            className="w-full pl-10 pr-4 py-2 bg-[#40444b] rounded-lg text-sm text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#5865f2]"
          />
        </form>
        
        {/* Tabs */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => { setActiveTab('trending'); loadTrending(); }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'trending' 
                ? 'bg-[#5865f2] text-white' 
                : 'text-gray-400 hover:text-white hover:bg-[#40444b]'
            }`}
          >
            <TrendingUp className="w-3 h-3" />
            Tendances
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'search' 
                ? 'bg-[#5865f2] text-white' 
                : 'text-gray-400 hover:text-white hover:bg-[#40444b]'
            }`}
          >
            <Clock className="w-3 h-3" />
            Résultats
          </button>
        </div>
      </div>

      {/* GIF Grid */}
      <div className="p-2 h-72 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5865f2]"></div>
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-sm">Aucun GIF trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif, index) => (
              <button
                key={index}
                onClick={() => onSelect(gif)}
                className="relative aspect-video rounded-lg overflow-hidden hover:ring-2 hover:ring-[#5865f2] transition-all"
              >
                <img
                  src={gif}
                  alt={`GIF ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-[#2f3136] text-center">
        <span className="text-xs text-gray-500">Powered by GIPHY</span>
      </div>
    </div>
  );
}
