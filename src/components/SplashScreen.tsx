import { useEffect, useState } from 'react';
import { Activity, TrendingUp, Zap, Brain, Globe } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Initialisation...');
  const [fadeOut, setFadeOut] = useState(false);

  const loadingSteps = [
    'Initialisation du système...',
    'Connexion aux marchés...',
    'Chargement des données...',
    'Synchronisation IA...',
    'Prêt à trader !'
  ];

  useEffect(() => {
    let currentStep = 0;
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => {
            setFadeOut(true);
            setTimeout(onComplete, 500);
          }, 300);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    const textInterval = setInterval(() => {
      currentStep = Math.min(Math.floor((progress / 100) * loadingSteps.length), loadingSteps.length - 1);
      setLoadingText(loadingSteps[currentStep]);
    }, 200);

    return () => {
      clearInterval(progressInterval);
      clearInterval(textInterval);
    };
  }, [onComplete, progress]);

  return (
    <div 
      className={`fixed inset-0 z-[9999] bg-gradient-to-br from-[#0a0e1a] via-[#1a1f2e] to-[#0a0e1a] flex items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >
      {/* 🔥 Animated Background Effects Premium */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Grid Pattern avec animation */}
        <div 
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139, 92, 246, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            animation: 'grid-move 20s linear infinite',
          }}
        />
        
        {/* Gradient Radial Orbs */}
        <div 
          className="absolute top-10 left-10 w-72 h-72 rounded-full blur-3xl animate-pulse"
          style={{ 
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
            animationDuration: '4s'
          }} 
        />
        <div 
          className="absolute bottom-10 right-10 w-96 h-96 rounded-full blur-3xl animate-pulse"
          style={{ 
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, transparent 70%)',
            animationDuration: '5s',
            animationDelay: '1s'
          }} 
        />
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl"
          style={{ 
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 60%)',
            animation: 'pulse-slow 8s ease-in-out infinite'
          }} 
        />
        
        {/* Particules flottantes */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-crypto-blue/30"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              animation: `float-particle ${3 + i * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
        
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-crypto-blue/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center">
        {/* 🔥 Logo Animation Premium */}
        <div className="relative mb-8">
          {/* Anneaux multiples avec glow */}
          <div 
            className="absolute inset-0 w-32 h-32 -m-4 rounded-full border-2 border-crypto-blue/30 animate-[spin_4s_linear_infinite]"
            style={{ filter: 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))' }}
          />
          <div 
            className="absolute inset-0 w-40 h-40 -m-8 rounded-full border border-dashed border-purple-500/30 animate-[spin_6s_linear_infinite_reverse]"
            style={{ filter: 'drop-shadow(0 0 10px rgba(139, 92, 246, 0.3))' }}
          />
          <div 
            className="absolute inset-0 w-48 h-48 -m-12 rounded-full border border-crypto-blue/10 animate-[spin_8s_linear_infinite]"
          />
          
          {/* Logo avec effet glassmorphism */}
          <div className="relative w-28 h-28 mx-auto">
            {/* Glow background */}
            <div 
              className="absolute inset-0 rounded-2xl blur-xl animate-pulse"
              style={{ 
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.4) 0%, rgba(139, 92, 246, 0.4) 100%)',
                animationDuration: '2s'
              }}
            />
            {/* Main container */}
            <div 
              className="relative w-full h-full rounded-2xl p-[3px]"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
                boxShadow: '0 0 40px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              }}
            >
              <div className="w-full h-full rounded-2xl bg-[#0a0e1a] flex items-center justify-center overflow-hidden">
                {/* Animated background inside logo */}
                <div 
                  className="absolute inset-0 opacity-30"
                  style={{
                    background: 'linear-gradient(45deg, transparent 30%, rgba(59, 130, 246, 0.2) 50%, transparent 70%)',
                    animation: 'logo-shine 3s ease-in-out infinite',
                  }}
                />
                <div className="relative">
                  <Activity 
                    className="w-14 h-14 text-crypto-blue drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" 
                  />
                  <Zap 
                    className="w-6 h-6 text-yellow-400 absolute -top-1 -right-2 animate-bounce drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ✨ Brand Name Premium */}
        <h1 className="text-6xl sm:text-7xl font-black tracking-tight mb-2">
          <span 
            className="bg-clip-text text-transparent animate-gradient"
            style={{
              background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 25%, #ec4899 50%, #8b5cf6 75%, #3b82f6 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.5))',
            }}
          >
            NEUROVEST
          </span>
        </h1>

        {/* 🔥 Collaborateurs - By */}
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">by</span>
          {[
            { name: 'WOLF-ALPHA', color: '#3b82f6' },
            { name: "FFOMIX.AX", color: '#8b5cf6' },
            { name: "BAB's BOOMY", color: '#ec4899' }
          ].map((collab, i) => (
            <span 
              key={i}
              className="text-[11px] sm:text-xs font-bold tracking-wider px-2 py-1 rounded-md"
              style={{
                background: `linear-gradient(135deg, ${collab.color}20 0%, ${collab.color}10 100%)`,
                border: `1px solid ${collab.color}40`,
                color: collab.color,
                boxShadow: `0 0 10px ${collab.color}30`,
              }}
            >
              {collab.name}
            </span>
          ))}
        </div>
        
        <p 
          className="text-sm mb-12 tracking-[0.3em] uppercase font-medium"
          style={{
            background: 'linear-gradient(90deg, rgba(255,255,255,0.5) 0%, rgba(139, 92, 246, 0.6) 50%, rgba(255,255,255,0.5) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Trading Intelligence
        </p>

        {/* 🔥 Progress Bar Premium */}
        <div className="w-80 mx-auto mb-4">
          <div 
            className="h-2 bg-white/5 rounded-full overflow-hidden p-[1px]"
            style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.5) 0%, rgba(30, 41, 59, 0.3) 100%)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <div 
              className="h-full rounded-full transition-all duration-100 ease-out relative overflow-hidden"
              style={{ 
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(139, 92, 246, 0.3)',
              }}
            >
              {/* Shine effect on progress */}
              <div 
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                  animation: 'progress-shine 2s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        </div>

        {/* ✨ Loading Text Premium */}
        <p 
          className="text-sm font-medium mb-2"
          style={{
            color: 'rgba(148, 163, 184, 0.8)',
            textShadow: '0 0 10px rgba(59, 130, 246, 0.3)',
          }}
        >
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-crypto-blue animate-ping" />
            {loadingText}
          </span>
        </p>

        {/* Progress Percentage */}
        <p 
          className="text-xs mt-1 font-mono"
          style={{
            color: 'rgba(99, 102, 241, 0.8)',
            textShadow: '0 0 10px rgba(99, 102, 241, 0.3)',
          }}
        >
          {Math.round(progress)}%
        </p>

        {/* 🔥 Features Icons Premium */}
        <div className="flex items-center justify-center gap-8 mt-14">
          {[
            { icon: Brain, label: 'IA', color: '#3b82f6' },
            { icon: TrendingUp, label: 'Trading', color: '#8b5cf6' },
            { icon: Globe, label: 'Global', color: '#ec4899' },
            { icon: Zap, label: 'Real-Time', color: '#10b981' }
          ].map((feature, i) => (
            <div 
              key={i}
              className="flex flex-col items-center gap-2"
              style={{ 
                animationDelay: `${i * 0.15}s`,
                opacity: progress > (i + 1) * 20 ? 1 : 0.3,
                transition: 'all 0.5s ease',
                transform: progress > (i + 1) * 20 ? 'translateY(0)' : 'translateY(10px)',
              }}
            >
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${feature.color}20 0%, ${feature.color}10 100%)`,
                  border: `1px solid ${feature.color}30`,
                  boxShadow: progress > (i + 1) * 20 ? `0 0 20px ${feature.color}40` : 'none',
                }}
              >
                <feature.icon 
                  className="w-5 h-5" 
                  style={{ color: feature.color }}
                />
              </div>
              <span 
                className="text-[9px] uppercase tracking-wider font-medium"
                style={{ color: `${feature.color}99` }}
              >
                {feature.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ✨ Corner decorations Premium */}
      <div 
        className="absolute bottom-4 left-4 text-xs font-mono"
        style={{
          background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.6), rgba(139, 92, 246, 0.6))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        v2.0.0
      </div>
      <div 
        className="absolute bottom-4 right-4 text-xs font-mono"
        style={{
          background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.6), rgba(236, 72, 153, 0.6))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Powered by Groq AI
      </div>

      {/* Animations CSS */}
      <style>{`
        @keyframes grid-move {
          0% { transform: translate(0, 0); }
          100% { transform: translate(40px, 40px); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          50% { transform: translateY(-20px) translateX(10px); opacity: 0.8; }
        }
        @keyframes logo-shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes progress-shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-gradient {
          animation: gradient-shift 3s ease infinite;
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
