import React from 'react';
import { usdToXof, formatXOF } from '../utils/currency';

interface PriceWithXOFProps {
  usdAmount: number;
  showXOF?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PriceWithXOF({ usdAmount, showXOF = true, size = 'md', className = '' }: PriceWithXOFProps) {
  const sizeClasses = {
    sm: { usd: 'text-xs', xof: 'text-[10px]' },
    md: { usd: 'text-sm', xof: 'text-xs' },
    lg: { usd: 'text-base font-bold', xof: 'text-xs' }
  };

  const safeAmount = usdAmount ?? 0;

  return (
    <div className={`flex flex-col ${className}`}>
      <span className={`${sizeClasses[size].usd} text-white`}>
        ${safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      {showXOF && (
        <span className={`${sizeClasses[size].xof} text-gray-400`}>
          ≈ {formatXOF(safeAmount)}
        </span>
      )}
    </div>
  );
}

// Version compacte sur une ligne
export function PriceCompact({ usdAmount, className = '' }: { usdAmount: number; className?: string }) {
  const safeAmount = usdAmount ?? 0;
  
  return (
    <div className={`text-right ${className}`}>
      <span className="text-white font-medium">
        ${safeAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </span>
      <span className="text-[10px] text-gray-500 ml-1">
        ({formatXOF(safeAmount)})
      </span>
    </div>
  );
}
