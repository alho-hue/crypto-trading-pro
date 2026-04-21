// Gestion des notifications push pour le PWA

// Demander la permission pour les notifications
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

// Vérifier si les notifications sont autorisées
export function hasNotificationPermission(): boolean {
  if (!('Notification' in window)) return false;
  return Notification.permission === 'granted';
}

// Envoyer une notification locale
export function sendNotification(title: string, options?: NotificationOptions): void {
  if (!hasNotificationPermission()) {
    console.log('Notification permission not granted');
    return;
  }

  // Service worker désactivé - utiliser notification directe
  new Notification(title, {
    ...options,
    icon: '/wolf-ffomix.png',
    badge: '/wolf-ffomix.png',
  });
}

// Notification spéciale pour alerte de prix
export function sendPriceAlert(symbol: string, price: number, condition: 'above' | 'below', target: number): void {
  const conditionText = condition === 'above' ? 'dépassé' : 'descendu sous';
  const formattedPrice = price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  const formattedTarget = target.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 8 });

  sendNotification(
    `🚨 Alerte Prix: ${symbol}`,
    {
      body: `${symbol} a ${conditionText} ${formattedTarget} USDT\nPrix actuel: ${formattedPrice} USDT`,
      tag: `price-alert-${symbol}`,
      data: {
        symbol,
        price,
        target,
        condition,
        url: '/',
      },
    }
  );
}

// Notification de signal de trading
export function sendTradingSignal(symbol: string, direction: 'buy' | 'sell', confidence: number): void {
  const directionEmoji = direction === 'buy' ? '🟢' : '🔴';
  const directionText = direction === 'buy' ? 'ACHAT' : 'VENTE';

  sendNotification(
    `${directionEmoji} Signal ${directionText}: ${symbol}`,
    {
      body: `Signal ${direction} détecté avec ${confidence}% de confiance\nCliquez pour voir les détails`,
      tag: `signal-${symbol}`,
      data: {
        symbol,
        direction,
        confidence,
        url: '/',
      },
    }
  );
}

// Notification de variation importante
export function sendPriceChangeAlert(symbol: string, changePercent: number): void {
  const emoji = changePercent > 0 ? '📈' : '📉';
  const direction = changePercent > 0 ? 'augmenté' : 'baissé';

  sendNotification(
    `${emoji} ${symbol} ${direction} de ${Math.abs(changePercent).toFixed(2)}%`,
    {
      body: `Variation significative détectée sur ${symbol}`,
      tag: `change-${symbol}`,
      data: {
        symbol,
        changePercent,
        url: '/',
      },
    }
  );
}

// Tester les notifications
export function testNotification(): void {
  sendNotification(
    '✅ Test de notification',
    {
      body: 'Vos notifications fonctionnent correctement !',
      tag: 'test',
    }
  );
}

// Envoyer une notification quotidienne de résumé
export function sendDailySummary(totalPnl: number, bestPerformer: { symbol: string; change: number }): void {
  const pnlEmoji = totalPnl >= 0 ? '🟢' : '🔴';
  const pnlText = totalPnl >= 0 ? '+' : '';

  sendNotification(
    `${pnlEmoji} Résumé Journalier`,
    {
      body: `P&L: ${pnlText}${totalPnl.toFixed(2)} USDT\n🏆 ${bestPerformer.symbol}: ${bestPerformer.change > 0 ? '+' : ''}${bestPerformer.change.toFixed(2)}%`,
      tag: 'daily-summary',
    }
  );
}
