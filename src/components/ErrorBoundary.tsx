import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: Array<string | number>;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  errorCount: number;
}

/**
 * 🛡️ Error Boundary avancé - Gestion globale des erreurs React
 * - Capture les erreurs de render
 * - Affiche UI de fallback
 * - Permet récupération sans reload
 * - Reporting d'erreurs
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Error caught:', error, errorInfo);
    
    this.setState({ error, errorInfo });
    
    // Callback optionnel pour reporting externe
    this.props.onError?.(error, errorInfo);
    
    // Si trop d'erreurs consécutives, forcer reload
    if (this.state.errorCount > 3) {
      console.error('[ErrorBoundary] Too many errors, forcing reload');
      window.location.reload();
    }
  }

  componentDidUpdate(prevProps: Props) {
    // Auto-reset si resetKeys changent
    if (this.state.hasError && this.props.resetKeys) {
      const keysChanged = this.props.resetKeys.some(
        (key, i) => key !== prevProps.resetKeys?.[i]
      );
      if (keysChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  resetErrorBoundary = () => {
    this.setState(prevState => ({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorCount: prevState.errorCount + 1
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Fallback personnalisé
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Fallback par défaut
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gray-900 rounded-2xl border border-red-500/20 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Oups ! Une erreur est survenue
                </h2>
                <p className="text-sm text-gray-400">
                  Erreur #{this.state.errorCount + 1}
                </p>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm mb-2">
                {this.state.error?.message || 'Erreur inconnue'}
              </p>
              {import.meta.env.DEV && this.state.errorInfo && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer">
                    Détails techniques
                  </summary>
                  <pre className="mt-2 text-xs text-gray-400 overflow-auto max-h-40">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={this.resetErrorBoundary}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Réessayer
              </button>

              <div className="flex gap-2">
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors text-sm"
                >
                  <Home className="w-4 h-4" />
                  Accueil
                </button>
                <button
                  onClick={this.handleReload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors text-sm"
                >
                  <Bug className="w-4 h-4" />
                  Recharger
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 🎯 Error Boundary spécialisé pour composants critiques
 * Avec retry automatique et fallback minimal
 */
export class CriticalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[CriticalErrorBoundary]', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-medium text-sm">
              Composant indisponible
            </span>
          </div>
          <button
            onClick={this.resetErrorBoundary}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Réessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
