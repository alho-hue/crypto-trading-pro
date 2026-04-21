import { useState, useEffect } from 'react';
import { Bell, Heart, UserPlus, Copy, X, TrendingUp } from 'lucide-react';

interface Notification {
  id: string;
  type: 'like' | 'follow' | 'copy_trade' | 'mention';
  userId: string;
  username: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export default function SocialNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // TODO: Fetch real notifications from backend API
    // Les notifications doivent venir d'une vraie base de données
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-crypto-red" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-crypto-blue" />;
      case 'copy_trade':
        return <Copy className="w-4 h-4 text-crypto-accent" />;
      case 'mention':
        return <TrendingUp className="w-4 h-4 text-crypto-green" />;
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white rounded-full hover:bg-crypto-dark/50"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-crypto-red rounded-full text-xs flex items-center justify-center font-bold">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-crypto-card border border-crypto-border rounded-lg shadow-xl z-50">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-crypto-border">
              <h3 className="font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-crypto-blue hover:underline"
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucune notification</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => markAsRead(notif.id)}
                    className={`flex items-start gap-3 p-3 hover:bg-crypto-dark/50 cursor-pointer border-b border-crypto-border/50 ${
                      !notif.read ? 'bg-crypto-blue/5' : ''
                    }`}
                  >
                    <div className="mt-1">{getIcon(notif.type)}</div>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">{notif.username}</span>{' '}
                        {notif.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notif.timestamp).toLocaleTimeString('fr-FR')}
                      </p>
                    </div>
                    {!notif.read && (
                      <div className="w-2 h-2 bg-crypto-blue rounded-full mt-1" />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-crypto-border text-center">
              <button className="text-sm text-crypto-blue hover:underline">
                Voir toutes les notifications
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
