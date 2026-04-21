import { useEffect, useState, useCallback, useMemo } from 'react';
import { Activity } from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';

// =============================================================================
// NEUROVEST WATERMARK SYSTEM
// Système de watermark professionnel anti-leak pour plateforme trading
// =============================================================================

interface WatermarkConfig {
  text?: string;
  username?: string;
  userId?: string;
  opacity?: number;
  rotation?: number;
  position?: 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  dynamic?: boolean;
  chartMode?: boolean;
  exportMode?: boolean;
  className?: string;
}

// Positions dynamiques pour éviter la suppression facile
const DYNAMIC_POSITIONS = [
  { x: 50, y: 50 },    // Center
  { x: 45, y: 48 },    // Slightly left-up
  { x: 55, y: 52 },    // Slightly right-down
  { x: 48, y: 55 },    // Center-down
  { x: 52, y: 45 },    // Center-up
  { x: 40, y: 50 },    // Left-center
  { x: 60, y: 50 },    // Right-center
] as const;

// Hook pour récupérer les infos utilisateur
function useUserInfo() {
  const [userInfo, setUserInfo] = useState<{ username: string; userId: string } | null>(null);

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        setUserInfo({
          username: parsed.username || parsed.name || 'guest',
          userId: parsed.id || parsed._id || 'unknown'
        });
      }
    } catch {
      setUserInfo({ username: 'guest', userId: 'unknown' });
    }
  }, []);

  return userInfo;
}

// Hook pour la position dynamique
function useDynamicPosition(enabled: boolean) {
  const [positionIndex, setPositionIndex] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setPositionIndex(prev => (prev + 1) % DYNAMIC_POSITIONS.length);
    }, 30000); // Change every 30 seconds

    return () => clearInterval(interval);
  }, [enabled]);

  return DYNAMIC_POSITIONS[positionIndex];
}

// =============================================================================
// 1. WATERMARK GLOBALE (BACKGROUND)
// =============================================================================

export function GlobalWatermark() {
  const currentView = useCryptoStore((state) => state.currentView);
  
  // Générer un pattern unique basé sur la vue actuelle
  const patternSeed = useMemo(() => {
    return `${currentView}-${Date.now()}`;
  }, [currentView]);

  return (
    <>
      {/* Watermark principale - pattern répété */}
      <div 
        className="fixed inset-0 pointer-events-none overflow-hidden z-[1]"
        style={{ 
          backgroundImage: `
            repeating-linear-gradient(
              -20deg,
              transparent,
              transparent 200px,
              rgba(148, 163, 184, 0.015) 200px,
              rgba(148, 163, 184, 0.015) 400px
            )
          `,
        }}
      />
      
      {/* 🔥 NEUROVEST Central - Style Premium */}
      <div 
        className="fixed inset-0 pointer-events-none flex items-center justify-center z-[1] select-none"
        style={{
          background: 'transparent',
        }}
      >
        <span 
          className="text-[18vw] sm:text-[12vw] font-black tracking-[0.3em] whitespace-nowrap watermark-text-premium"
          style={{
            transform: 'rotate(-15deg)',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          NEUROVEST
        </span>
      </div>

      {/* ✨ Pattern décoratif premium */}
      <div 
        className="fixed inset-0 pointer-events-none z-[1] select-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 80% at 50% 50%, rgba(59, 130, 246, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 25% 25%, rgba(139, 92, 246, 0.04) 0%, transparent 40%),
            radial-gradient(circle at 75% 75%, rgba(59, 130, 246, 0.04) 0%, transparent 40%),
            radial-gradient(circle at 25% 75%, rgba(236, 72, 153, 0.02) 0%, transparent 30%),
            radial-gradient(circle at 75% 25%, rgba(16, 185, 129, 0.02) 0%, transparent 30%)
          `,
          opacity: 0.6,
        }}
      />
      
      {/* 🌊 Lignes subtils en arrière-plan */}
      <svg 
        className="fixed inset-0 w-full h-full pointer-events-none z-[1] opacity-[0.03]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="lineGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.5)" />
            <stop offset="50%" stopColor="rgba(139, 92, 246, 0.3)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0.5)" />
          </linearGradient>
        </defs>
        <line x1="0" y1="100%" x2="100%" y2="0" stroke="url(#lineGrad1)" strokeWidth="0.5" />
        <line x1="20%" y1="100%" x2="80%" y2="0" stroke="url(#lineGrad1)" strokeWidth="0.3" />
        <line x1="0" y1="80%" x2="100%" y2="20%" stroke="url(#lineGrad1)" strokeWidth="0.3" />
      </svg>

      <style>{`
        @keyframes watermark-shimmer {
          0%, 100% {
            filter: drop-shadow(0 0 60px rgba(59, 130, 246, 0.08)) drop-shadow(0 0 120px rgba(139, 92, 246, 0.05));
            transform: rotate(-15deg) scale(1);
          }
          50% {
            filter: drop-shadow(0 0 80px rgba(59, 130, 246, 0.12)) drop-shadow(0 0 150px rgba(139, 92, 246, 0.08));
            transform: rotate(-15deg) scale(1.02);
          }
        }
        
        .watermark-text-premium {
          background: linear-gradient(135deg, 
            rgba(148, 163, 184, 0.15) 0%, 
            rgba(59, 130, 246, 0.12) 25%,
            rgba(139, 92, 246, 0.15) 50%,
            rgba(59, 130, 246, 0.12) 75%,
            rgba(148, 163, 184, 0.15) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 80px rgba(59, 130, 246, 0.15)) 
                  drop-shadow(0 0 160px rgba(139, 92, 246, 0.1))
                  drop-shadow(0 4px 30px rgba(0, 0, 0, 0.3));
          animation: watermark-glow 6s ease-in-out infinite;
        }
        
        @keyframes watermark-glow {
          0%, 100% {
            opacity: 0.4;
            filter: drop-shadow(0 0 60px rgba(59, 130, 246, 0.1)) 
                    drop-shadow(0 0 120px rgba(139, 92, 246, 0.05));
          }
          33% {
            opacity: 0.6;
            filter: drop-shadow(0 0 100px rgba(139, 92, 246, 0.15)) 
                    drop-shadow(0 0 200px rgba(59, 130, 246, 0.1));
          }
          66% {
            opacity: 0.5;
            filter: drop-shadow(0 0 80px rgba(236, 72, 153, 0.1)) 
                    drop-shadow(0 0 160px rgba(139, 92, 246, 0.08));
          }
        }
        
        @keyframes watermark-float {
          0%, 100% {
            transform: translateY(0) rotate(-15deg);
          }
          50% {
            transform: translateY(-10px) rotate(-15deg);
          }
        }
        
        .watermark-text-premium {
          animation: watermark-glow 6s ease-in-out infinite, watermark-float 10s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}

// =============================================================================
// 2. WATERMARK SUR CHARTS
// =============================================================================

interface ChartWatermarkProps {
  symbol?: string;
  position?: 'center' | 'bottom-right';
}

export function ChartWatermark({ symbol, position = 'center' }: ChartWatermarkProps) {
  const positionStyles = {
    'center': 'inset-0 items-center justify-center',
    'bottom-right': 'bottom-4 right-4 items-end justify-end',
  };

  return (
    <div className={`absolute ${positionStyles[position]} flex pointer-events-none select-none z-[1]`}>
      <div className="flex flex-col items-center gap-2">
        {/* 🔥 Logo Icon avec Glow */}
        <div className="relative">
          <Activity 
            className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300/20" 
            style={{
              filter: 'drop-shadow(0 0 20px rgba(59, 130, 246, 0.4)) drop-shadow(0 0 40px rgba(139, 92, 246, 0.2))',
            }}
          />
          <div 
            className="absolute inset-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full animate-ping"
            style={{
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
              animationDuration: '3s',
            }}
          />
        </div>
        
        {/* ✨ Texte NEUROVEST Premium */}
        <div className="relative">
          {/* Glow layer */}
          <span 
            className="absolute inset-0 text-4xl sm:text-5xl lg:text-6xl font-black tracking-[0.2em] whitespace-nowrap blur-sm"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(139, 92, 246, 0.3) 50%, rgba(236, 72, 153, 0.2) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            NEUROVEST
          </span>
          {/* Main text */}
          <span 
            className="relative text-4xl sm:text-5xl lg:text-6xl font-black tracking-[0.2em] whitespace-nowrap chart-watermark-main"
            style={{
              background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.15) 0%, rgba(59, 130, 246, 0.12) 30%, rgba(139, 92, 246, 0.15) 60%, rgba(148, 163, 184, 0.12) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 20px rgba(59, 130, 246, 0.2)) drop-shadow(0 0 40px rgba(139, 92, 246, 0.15))',
            }}
          >
            NEUROVEST
          </span>
        </div>
        
        {/* Symbol avec style */}
        {symbol && (
          <div 
            className="px-3 py-1 rounded-full mt-2"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
            }}
          >
            <span 
              className="text-[10px] sm:text-xs font-mono tracking-[0.2em] uppercase"
              style={{
                background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.6), rgba(168, 85, 247, 0.6))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {symbol}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// 3. WATERMARK UTILISATEUR (ANTI-LEAK)
// =============================================================================

export function UserWatermark() {
  const userInfo = useUserInfo();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  if (!userInfo) return null;

  const year = currentTime.getFullYear();
  const watermarkText = `NEUROVEST • ${userInfo.username} • ${year}`;

  return (
    <>
      {/* 🔥 Watermark utilisateur - Style Glassmorphism */}
      <div 
        className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 pointer-events-none select-none z-[100]"
      >
        <div 
          className="px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/5"
          style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(30, 41, 59, 0.4) 100%)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          }}
        >
          <span 
            className="text-[9px] sm:text-[11px] font-mono tracking-widest uppercase"
            style={{
              background: 'linear-gradient(90deg, rgba(148, 163, 184, 0.6) 0%, rgba(99, 102, 241, 0.5) 50%, rgba(168, 85, 247, 0.6) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {watermarkText}
          </span>
        </div>
      </div>

      {/* Watermark utilisateur - coin opposé discret */}
      <div 
        className="fixed top-3 left-3 sm:top-5 sm:left-5 pointer-events-none select-none z-[100]"
      >
        <div 
          className="px-2 py-1 rounded-md backdrop-blur-sm border border-white/5"
          style={{
            background: 'rgba(15, 23, 42, 0.3)',
          }}
        >
          <span 
            className="text-[7px] sm:text-[9px] font-mono tracking-wider"
            style={{
              color: 'rgba(100, 116, 139, 0.5)',
            }}
          >
            ID:{userInfo.userId.slice(-8)}
          </span>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// 4. WATERMARK DYNAMIQUE (OPTION PRO)
// =============================================================================

export function DynamicWatermark({ enabled = false }: { enabled?: boolean }) {
  const position = useDynamicPosition(enabled);
  const userInfo = useUserInfo();
  const [opacity, setOpacity] = useState(0.03);

  // Subtle opacity animation
  useEffect(() => {
    if (!enabled) return;
    
    const interval = setInterval(() => {
      setOpacity(prev => {
        const variation = (Math.random() - 0.5) * 0.02;
        return Math.max(0.02, Math.min(0.05, prev + variation));
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [enabled]);

  if (!enabled || !userInfo) return null;

  return (
    <div 
      className="fixed pointer-events-none select-none z-[2] transition-all duration-[30000ms] ease-in-out"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%) rotate(-15deg)',
        opacity,
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <span 
          className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-[0.25em] whitespace-nowrap"
          style={{
            background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.15) 0%, rgba(59, 130, 246, 0.12) 50%, rgba(139, 92, 246, 0.15) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 60px rgba(59, 130, 246, 0.15)) drop-shadow(0 0 120px rgba(139, 92, 246, 0.1))',
          }}
        >
          NEUROVEST
        </span>
        <span className="text-xs font-mono text-slate-400 tracking-wider">
          {userInfo.username} • {new Date().getFullYear()}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// 5. WATERMARK EXPORTS (PDF, Screenshots)
// =============================================================================

interface ExportWatermarkProps {
  type: 'pdf' | 'screenshot' | 'export';
  customText?: string;
}

export function ExportWatermark({ type, customText }: ExportWatermarkProps) {
  const userInfo = useUserInfo();
  const timestamp = useMemo(() => new Date().toISOString(), []);

  const getWatermarkText = () => {
    if (customText) return customText;
    switch (type) {
      case 'pdf':
        return `Generated by NEUROVEST • ${userInfo?.username || 'User'} • ${new Date().toLocaleDateString()}`;
      case 'screenshot':
        return `NEUROVEST • ${userInfo?.username || 'guest'} • ${timestamp}`;
      case 'export':
        return `NEUROVEST Export • Confidential • ${new Date().getFullYear()}`;
      default:
        return 'Generated by NEUROVEST';
    }
  };

  return (
    <div 
      className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-[9999]"
      style={{
        background: 'rgba(11, 17, 32, 0.03)',
      }}
    >
      <div className="transform -rotate-12">
        <span 
          className="text-4xl sm:text-6xl font-black text-slate-400/20 tracking-widest whitespace-nowrap"
          style={{
            textShadow: '0 0 40px rgba(148, 163, 184, 0.1)',
          }}
        >
          NEUROVEST
        </span>
      </div>
      <div className="mt-4 px-4 py-2 bg-slate-900/80 rounded border border-slate-700/50">
        <span className="text-xs font-mono text-slate-400 tracking-wider">
          {getWatermarkText()}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// 6. WATERMARK MOBILE (Responsive)
// =============================================================================

export function MobileWatermark() {
  const userInfo = useUserInfo();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isMobile) return null;

  return (
    <>
      {/* Watermark mobile discrète */}
      <div 
        className="fixed inset-0 pointer-events-none select-none z-[1]"
        style={{
          opacity: 0.015,
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 100px,
              rgba(148, 163, 184, 0.1) 100px,
              rgba(148, 163, 184, 0.1) 101px
            )
          `,
        }}
      />
      
      {/* Brand mobile */}
      <div 
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-[1]"
        style={{
          opacity: 0.025,
          transform: 'translate(-50%, -50%) rotate(-20deg)',
        }}
      >
        <span className="text-5xl font-black text-slate-300 tracking-[0.2em]">
          NEUROVEST
        </span>
      </div>

      {/* User info mobile */}
      {userInfo && (
        <div className="fixed bottom-1 right-1 pointer-events-none select-none z-[100]">
          <span className="text-[8px] font-mono text-slate-500/50">
            {userInfo.username.slice(0, 8)}
          </span>
        </div>
      )}
    </>
  );
}

// =============================================================================
// 7. WATERMARK AVANCÉE (Canvas - Anti-screenshot)
// =============================================================================

export function CanvasWatermark() {
  const userInfo = useUserInfo();
  const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Configuration du texte
      ctx.font = 'bold 120px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.02)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Sauvegarder le contexte
      ctx.save();
      
      // Rotation et position
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-20 * Math.PI / 180);
      
      // Dessiner le texte principal
      ctx.fillText('NEUROVEST', 0, 0);
      
      // Restaurer pour le texte secondaire
      ctx.restore();
      
      // Texte utilisateur en petit
      if (userInfo) {
        ctx.font = '10px monospace';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.05)';
        ctx.fillText(
          `${userInfo.username} • ${new Date().getFullYear()}`,
          canvas.width - 100,
          canvas.height - 20
        );
      }
    };

    resize();
    window.addEventListener('resize', resize);
    
    return () => {
      window.removeEventListener('resize', resize);
    };
  }, [userInfo]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[1]"
      style={{ 
        opacity: 1,
        mixBlendMode: 'overlay',
      }}
    />
  );
}

// =============================================================================
// COMPOSANT PRINCIPAL - Combine toutes les watermarks
// =============================================================================

interface WatermarkSystemProps {
  mode?: 'full' | 'minimal' | 'charts-only' | 'export';
  dynamic?: boolean;
  useCanvas?: boolean;
}

export function WatermarkSystem({ 
  mode = 'full', 
  dynamic = false,
  useCanvas = false 
}: WatermarkSystemProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mode export - uniquement pour PDF/screenshots
  if (mode === 'export') {
    return <ExportWatermark type="pdf" />;
  }

  // Mode charts-only - pour les composants chart individuels
  if (mode === 'charts-only') {
    return <ChartWatermark />;
  }

  // Mode minimal - seulement l'essentiel
  if (mode === 'minimal') {
    return (
      <>
        <GlobalWatermark />
        <UserWatermark />
      </>
    );
  }

  // Mode full - toutes les watermarks
  return (
    <>
      {useCanvas ? (
        <CanvasWatermark />
      ) : (
        <GlobalWatermark />
      )}
      
      {!isMobile && <UserWatermark />}
      {isMobile && <MobileWatermark />}
      {dynamic && <DynamicWatermark enabled={true} />}
    </>
  );
}

// Export individuel pour cas spécifiques
export { useUserInfo, useDynamicPosition, DYNAMIC_POSITIONS };
export default WatermarkSystem;
