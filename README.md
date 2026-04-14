# Crypto Trading Pro

[![React](https://img.shields.io/badge/React-19.2.5-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0.2-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0.8-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.19-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> Application de trading crypto professionnelle avec analyses techniques, backtesting et signaux IA en temps réel.

<!-- Screenshot à ajouter plus tard : ![Crypto Trading Pro](./public/screenshot.png) -->

## Table des matières

- [Fonctionnalités](#fonctionnalités)
- [Technologies](#technologies)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Scripts disponibles](#scripts-disponibles)
- [Structure du projet](#structure-du-projet)
- [Configuration](#configuration)
- [Déploiement](#déploiement)
- [API Documentation](#api-documentation)
- [Contributions](#contributions)
- [License](#license)

## Fonctionnalités

### Dashboard en Temps Réel
- **Prix temps réel** des principales cryptos (BTC, ETH, BNB, etc.)
- **Variation 24h** avec code couleur (vert/rouge)
- **Volume des dernières 24h**
- **Top gagnants/perdants**
- Système de **favoris** avec étoiles
- **Alertes de prix** personnalisables

### Analyse Technique
- **Graphiques interactifs** (Candlestick, Line, Area, Histogram)
- **Indicateurs techniques** :
  - Moyennes mobiles (SMA, EMA)
  - RSI (Relative Strength Index)
  - MACD
  - Bollinger Bands
  - Volume Profile

### Intelligence Artificielle
- **Signaux de trading IA** basés sur le machine learning
- **Analyse de sentiment** du marché
- **Prédictions de prix** à court terme
- **Détection de patterns** automatique

### Gestion de Portefeuille
- **Suivi des positions** ouvertes
- **Historique des trades**
- **Calcul du P&L** en temps réel
- **Simulation de trading** (paper trading)

### Mode Pro
- **Backtesting avancé** avec stratégies personnalisables
- **Export de données** CSV/Excel
- **WebSocket temps réel** pour les mises à jour instantanées
- **Notifications push** pour les alertes de prix

## Technologies

- **Frontend** : React 19 + TypeScript 6
- **Build Tool** : Vite 8
- **Styling** : Tailwind CSS 3.4 + PostCSS
- **State Management** : Zustand 5
- **Charts** : Lightweight Charts 4
- **Icons** : Lucide React
- **HTTP Client** : Axios
- **Crypto** : crypto-js
- **Dates** : date-fns
- **PWA** : Service Workers, Manifest

## Prérequis

- Node.js 18+ (recommandé : 20 LTS)
- npm 10+ ou yarn 1.22+
- Git

## Installation

### 1. Cloner le repository

```bash
git clone https://github.com/TON_USERNAME/crypto-trading-pro.git
cd crypto-trading-pro
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configuration des variables d'environnement

Créer un fichier `.env.local` à la racine :

```env
# API Configuration
VITE_API_BASE_URL=https://api.binance.com
VITE_API_KEY=votre_cle_api
VITE_WS_URL=wss://stream.binance.com:9443/ws

# Feature Flags
VITE_ENABLE_AI_SIGNALS=true
VITE_ENABLE_BACKTESTING=true
VITE_ENABLE_PAPER_TRADING=true

# App Configuration
VITE_APP_NAME=Crypto Trading Pro
VITE_APP_VERSION=1.0.0
```

### 4. Lancer l'application

```bash
npm run dev
```

L'application sera disponible sur `http://localhost:5173`

## Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur de développement avec HMR |
| `npm run build` | Compile le projet pour la production |
| `npm run preview` | Prévisualise la build de production |
| `npm run type-check` | Vérifie les types TypeScript |

## Structure du projet

```
crypto-trading-pro/
├── public/                 # Assets statiques
│   ├── vite.svg           # Logo
│   ├── manifest.json      # PWA manifest
│   └── sw.js              # Service Worker
├── src/
│   ├── components/        # Composants React réutilisables
│   │   ├── Dashboard/     # Composants du dashboard
│   │   ├── Charts/        # Composants de graphiques
│   │   ├── Trading/       # Composants de trading
│   │   └── UI/            # Composants UI génériques
│   ├── hooks/             # Custom React hooks
│   ├── stores/            # Zustand stores
│   ├── services/          # Services API
│   ├── utils/             # Fonctions utilitaires
│   ├── types/             # Types TypeScript
│   ├── styles/            # Fichiers CSS/Tailwind
│   ├── App.tsx            # Composant racine
│   └── main.tsx           # Point d'entrée
├── docs/                  # Documentation
├── .env                   # Variables d'environnement
├── .gitignore             # Fichiers ignorés par Git
├── index.html             # HTML template
├── netlify.toml           # Config Netlify
├── package.json           # Dépendances et scripts
├── tsconfig.json          # Config TypeScript
├── tailwind.config.js     # Config Tailwind
├── postcss.config.js      # Config PostCSS
└── vite.config.ts         # Config Vite
```

## Configuration

### Tailwind CSS

Les couleurs personnalisées sont définies dans `tailwind.config.js` :

```javascript
colors: {
  crypto: {
    dark: '#0a0e1a',
    darker: '#070a12',
    card: '#111827',
    accent: '#3b82f6',
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
  }
}
```

### PWA Configuration

Le fichier `public/manifest.json` configure l'application comme PWA :

- **Nom** : Crypto Trading Pro
- **Icônes** : Multi-résolution (72x72 à 512x512)
- **Theme Color** : #0a0e1a
- **Display Mode** : Standalone
- **Orientation** : Portrait

## Déploiement

### Sur Netlify (Recommandé)

#### Étape 1 : Créer le repository GitHub

```bash
# Initialiser Git (si pas déjà fait)
git init

# Ajouter tous les fichiers
git add .

# Créer le premier commit
git commit -m "Initial commit - Crypto Trading Pro v1.0"

# Renommer la branche principale
git branch -M main

# Connecter au repository GitHub (remplace TON_USERNAME)
git remote add origin https://github.com/TON_USERNAME/crypto-trading-pro.git

# Pousser le code
git push -u origin main
```

#### Étape 2 : Déployer sur Netlify

1. **Créer un compte** sur [netlify.com](https://netlify.com) (gratuit)
2. **Connecter GitHub** : Cliquer sur "Add new site" → "Import an existing project"
3. **Sélectionner le repository** `crypto-trading-pro`
4. **Configuration du build** :
   - Build command : `npm run build`
   - Publish directory : `dist`
5. **Variables d'environnement** : Ajouter dans Netlify → Site settings → Environment variables
6. **Déployer** : Cliquer sur "Deploy site"

#### Étape 3 : Configuration avancée Netlify

Le fichier `netlify.toml` est déjà configuré :

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Cette configuration permet le routing côté client (SPA).

### Sur Vercel (Alternative)

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel --prod
```

### Sur GitHub Pages (Alternative)

```bash
# Installer gh-pages
npm install --save-dev gh-pages

# Dans package.json, ajouter :
"homepage": "https://TON_USERNAME.github.io/crypto-trading-pro",
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}

# Déployer
npm run deploy
```

## API Documentation

### Binance API (par défaut)

L'application utilise l'API Binance pour les données de marché :

| Endpoint | Description |
|----------|-------------|
| `GET /api/v3/ticker/24hr` | Prix et variations 24h |
| `GET /api/v3/klines` | Données historiques (candlesticks) |
| `GET /api/v3/ticker/price` | Prix actuel |
| `GET /api/v3/depth` | Carnet d'ordres |
| `wss://stream.binance.com:9443/ws` | WebSocket temps réel |

### Limites de rate

- **REST API** : 1200 requêtes/minute
- **WebSocket** : 5 connexions simultanées max

## Contributions

Les contributions sont les bienvenues !

1. **Fork** le repository
2. **Créer une branche** : `git checkout -b feature/ma-fonctionnalite`
3. **Commiter** : `git commit -m "Ajout de ma fonctionnalité"`
4. **Pusher** : `git push origin feature/ma-fonctionnalite`
5. **Créer une Pull Request**

### Guidelines

- Suivre le style de code TypeScript/ESLint
- Ajouter des tests pour les nouvelles fonctionnalités
- Mettre à jour la documentation si nécessaire
- Respecter la structure du projet existante

## License

Ce projet est sous license MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

<p align="center">
  Développé avec ❤️ par <strong>alho-hue</strong>
  <br>
  <a href="https://github.com/alho-hue">GitHub</a> •
  <a href="mailto:alhousseynid504@gmail.com">Email</a>
</p>
