// Système de conversion de devises - FCFA (XOF)

// Taux de conversion (à mettre à jour régulièrement)
// 1 USD = environ 604.5 XOF (taux approximatif, à actualiser)
const USD_TO_XOF = 604.5;

// Convertir USD en XOF
export function usdToXof(usdAmount: number): number {
  return usdAmount * USD_TO_XOF;
}

// Convertir XOF en USD
export function xofToUsd(xofAmount: number): number {
  return xofAmount / USD_TO_XOF;
}

// Formater en XOF avec séparateurs
export function formatXOF(amount: number): string {
  const xof = usdToXof(amount);
  return xof.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }) + ' XOF';
}

// Formater en USD
export function formatUSD(amount: number): string {
  return '$' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Affichage double: USD + XOF
export function formatDualPrice(usdAmount: number): string {
  const usd = formatUSD(usdAmount);
  const xof = formatXOF(usdAmount);
  return `${usd} ≈ ${xof}`;
}

// Retourner un objet avec les deux formats pour affichage flexible
export function getDualPrice(usdAmount: number): { usd: string; xof: string; full: string } {
  return {
    usd: formatUSD(usdAmount),
    xof: formatXOF(usdAmount),
    full: formatDualPrice(usdAmount),
  };
}

// Hook personnalisé pour les conversions
export function useCurrencyConverter() {
  return {
    usdToXof,
    xofToUsd,
    formatXOF,
    formatUSD,
    formatDualPrice,
  };
}
