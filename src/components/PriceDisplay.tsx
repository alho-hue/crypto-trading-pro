import { formatUSD, formatXOF } from '../utils/currency';

interface PriceDisplayProps {
  usdAmount: number;
  showXOF?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function PriceDisplay({ 
  usdAmount, 
  showXOF = true, 
  size = 'md',
  className = '' 
}: PriceDisplayProps) {
  const sizeClasses = {
    sm: { usd: 'text-sm', xof: 'text-xs' },
    md: { usd: 'text-base', xof: 'text-sm' },
    lg: { usd: 'text-2xl font-bold', xof: 'text-base' },
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <span className={sizeClasses[size].usd}>
        {formatUSD(usdAmount)}
      </span>
      {showXOF && (
        <span className={`${sizeClasses[size].xof} text-gray-400`}>
          ≈ {formatXOF(usdAmount)}
        </span>
      )}
    </div>
  );
}
