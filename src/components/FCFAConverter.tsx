import { useState, useEffect } from 'react';
import { getUSDToFCFARate } from '../services/exchangeRates';

interface FCFAConverterProps {
  usdAmount: number;
  className?: string;
  inline?: boolean;
}

export function FCFAConverter({ usdAmount, className = '', inline = false }: FCFAConverterProps) {
  const [fcfaAmount, setFcfaAmount] = useState<string>('');
  const [rate, setRate] = useState<number>(615);

  useEffect(() => {
    const updateConversion = async () => {
      try {
        const currentRate = await getUSDToFCFARate();
        setRate(currentRate);
        const fcfa = usdAmount * currentRate;
        setFcfaAmount(new Intl.NumberFormat('fr-FR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(fcfa));
      } catch (error) {
        // Silent fail - use fallback
        const fcfa = usdAmount * 615;
        setFcfaAmount(new Intl.NumberFormat('fr-FR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(fcfa));
      }
    };

    updateConversion();
    
    // Update every 5 minutes
    const interval = setInterval(updateConversion, 300000);
    
    return () => clearInterval(interval);
  }, [usdAmount]);

  if (usdAmount === 0 || !fcfaAmount) return null;

  if (inline) {
    return (
      <span className={`text-xs text-gray-500 ml-1 ${className}`}>
        ≈ {fcfaAmount} XOF
      </span>
    );
  }

  return (
    <div className={`text-xs text-gray-400 mt-1 ${className}`}>
      ≈ {fcfaAmount} XOF
    </div>
  );
}
