import { useCryptoStore } from '../stores/cryptoStore';
import { FCFAConverter } from './FCFAConverter';
import { TrendingUp, TrendingDown } from 'lucide-react';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];

const SYMBOL_NAMES: Record<string, string> = {
  BTCUSDT: 'Bitcoin',
  ETHUSDT: 'Ethereum',
  ADAUSDT: 'Cardano',
  BNBUSDT: 'BNB',
  SOLUSDT: 'Solana',
  XRPUSDT: 'XRP',
};

export default function Watchlist() {
  const prices = useCryptoStore((state) => state.prices);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);
  const setSelectedSymbol = useCryptoStore((state) => state.setSelectedSymbol);

  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toFixed(4);
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  return (
    <div className="crypto-card h-full flex flex-col">
      <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2 flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-crypto-green animate-pulse flex-shrink-0"></span>
        <span className="truncate">Watchlist</span>
      </h2>
      
      <div className="space-y-1.5 sm:space-y-2 overflow-y-auto flex-1 -mx-2 px-2 sm:mx-0 sm:px-0">
        {SYMBOLS.map((symbol) => {
          const price = prices.get(symbol);
          const isSelected = selectedSymbol === symbol;
          
          return (
            <button
              key={symbol}
              onClick={() => setSelectedSymbol(symbol)}
              className={`w-full p-2.5 sm:p-3 rounded-lg transition-all ${
                isSelected
                  ? 'bg-crypto-blue/20 border border-crypto-blue/50'
                  : 'bg-crypto-dark border border-crypto-border hover:border-gray-600'
              }`}
            >
              <div className="grid grid-cols-[auto_1fr_auto] gap-2 sm:gap-3 items-center">
                {/* Icon */}
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-crypto-border flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0">
                  {symbol.slice(0, 3)}
                </div>
                
                {/* Name & Symbol */}
                <div className="text-left min-w-0 overflow-hidden">
                  <div className="font-medium text-xs sm:text-sm truncate">{SYMBOL_NAMES[symbol]}</div>
                  <div className="text-[10px] sm:text-xs text-gray-500 truncate">{symbol}</div>
                </div>
                
                {/* Price */}
                <div className="text-right min-w-0">
                  {price ? (
                    <div className="flex flex-col items-end">
                      <div className="font-mono font-medium text-xs sm:text-sm truncate">
                        ${formatPrice(price.price)}
                      </div>
                      <FCFAConverter usdAmount={price.price} className="text-[9px] sm:text-[10px] hidden sm:block" />
                      <div className={`flex items-center gap-1 text-[10px] sm:text-xs ${
                        price.change24h >= 0 ? 'price-up' : 'price-down'
                      }`}>
                        {price.change24h >= 0 ? (
                          <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                        ) : (
                          <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                        )}
                        <span className="whitespace-nowrap tabular-nums">{formatChange(price.change24h)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end">
                      <div className="font-mono text-gray-500 text-xs sm:text-sm">--</div>
                      <div className="text-[10px] sm:text-xs text-gray-500">--</div>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
