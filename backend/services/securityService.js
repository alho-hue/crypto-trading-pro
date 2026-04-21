// Service de Sécurité pour NEUROVEST
// Gestion du chiffrement, 2FA, et sécurité des clés API

const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const NodeRSA = require('node-rsa');

// Configuration du chiffrement
// Utiliser une clé déterministe basée sur JWT_SECRET pour éviter la perte de données
// Si ENCRYPTION_KEY n'est pas définie, on dérive une clé de JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 
  crypto.createHash('sha256').update(JWT_SECRET + '-encryption-key').digest('hex');
const ALGORITHM = 'aes-256-gcm';

console.log('[Security] Encryption key configured (derived from JWT_SECRET)');

class SecurityService {
  constructor() {
    this.rsaKey = null;
    this.initializeKeys();
  }

  // === INITIALISATION ===
  
  initializeKeys() {
    try {
      // Charger ou générer une paire de clés RSA pour le chiffrement asymétrique
      const privateKeyEnv = process.env.RSA_PRIVATE_KEY;
      const publicKeyEnv = process.env.RSA_PUBLIC_KEY;
      
      if (privateKeyEnv && publicKeyEnv) {
        this.rsaKey = new NodeRSA();
        this.rsaKey.importKey(privateKeyEnv, 'private');
        this.rsaKey.importKey(publicKeyEnv, 'public');
      } else {
        // Générer une nouvelle paire de clés (uniquement en développement)
        this.rsaKey = new NodeRSA({ b: 2048 });
        console.log('⚠️  Nouvelle paire de clés RSA générée - Stockez les variables d\'environnement pour la production');
        console.log('RSA_PUBLIC_KEY=' + this.rsaKey.exportKey('public'));
        console.log('RSA_PRIVATE_KEY=' + this.rsaKey.exportKey('private'));
      }
    } catch (error) {
      console.error('❌ Erreur initialisation clés RSA:', error);
    }
  }

  // === CHIFFREMENT SYMÉTRIQUE (AES-256-GCM) ===

  encrypt(text) {
    try {
      if (!text) return null;
      
      const iv = crypto.randomBytes(16);
      const salt = crypto.randomBytes(64);
      const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
      
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Retourner IV + salt + authTag + encrypted
      return iv.toString('hex') + ':' + salt.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('❌ Erreur chiffrement:', error);
      return null;
    }
  }

  decrypt(encryptedData) {
    try {
      if (!encryptedData) return null;
      
      const parts = encryptedData.split(':');
      if (parts.length !== 4) return null;
      
      const iv = Buffer.from(parts[0], 'hex');
      const salt = Buffer.from(parts[1], 'hex');
      const authTag = Buffer.from(parts[2], 'hex');
      const encrypted = parts[3];
      
      const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('❌ Erreur déchiffrement:', error);
      return null;
    }
  }

  // === CHIFFREMENT ASYMÉTRIQUE (RSA) ===

  encryptAsymmetric(text) {
    try {
      if (!text || !this.rsaKey) return null;
      return this.rsaKey.encrypt(text, 'base64');
    } catch (error) {
      console.error('❌ Erreur chiffrement asymétrique:', error);
      return null;
    }
  }

  decryptAsymmetric(encryptedData) {
    try {
      if (!encryptedData || !this.rsaKey) return null;
      return this.rsaKey.decrypt(encryptedData, 'utf8');
    } catch (error) {
      console.error('❌ Erreur déchiffrement asymétrique:', error);
      return null;
    }
  }

  // === GESTION DES CLÉS API ===

  encryptApiKey(apiKey) {
    return this.encrypt(apiKey);
  }

  decryptApiKey(encryptedApiKey) {
    return this.decrypt(encryptedApiKey);
  }

  // Chiffrement spécifique pour stockage sécurisé
  secureStoreApiCredentials(apiKey, secretKey) {
    return {
      apiKey: this.encrypt(apiKey),
      secretKey: this.encrypt(secretKey),
      encryptedAt: new Date()
    };
  }

  retrieveApiCredentials(encryptedCredentials) {
    return {
      apiKey: this.decrypt(encryptedCredentials.apiKey),
      secretKey: this.decrypt(encryptedCredentials.secretKey)
    };
  }

  // === 2FA TOTP ===

  generateTOTPSecret() {
    return speakeasy.generateSecret({
      name: 'NEUROVEST',
      length: 32
    });
  }

  generateTOTPQRCode(secret, email) {
    return new Promise((resolve, reject) => {
      const otpauthUrl = speakeasy.otpauthURL({
        secret: secret.base32,
        label: email,
        issuer: 'NEUROVEST',
        encoding: 'base32'
      });

      QRCode.toDataURL(otpauthUrl, (err, dataUrl) => {
        if (err) {
          reject(err);
        } else {
          resolve(dataUrl);
        }
      });
    });
  }

  verifyTOTP(token, secret) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Permet 2 pas de temps de décalage (±1 minute)
    });
  }

  // === HACHAGE SÉCURISÉ ===

  hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // === GÉNÉRATION DE TOKENS SÉCURISÉS ===

  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  generateApiKey() {
    return 'nk_' + crypto.randomBytes(24).toString('base64url');
  }

  // === VALIDATION IP ===

  validateIP(ip, allowedIPs) {
    if (!allowedIPs || allowedIPs.length === 0) return true;
    return allowedIPs.includes(ip);
  }

  // === SANITIZATION ===

  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    // Échapper les caractères spéciaux HTML
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // === PROTECTION XSS ===

  stripXSS(input) {
    if (typeof input !== 'string') return input;
    
    // Supprimer les balises script et les événements onclick, etc.
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/javascript:/gi, '');
  }

  // === VÉRIFICATION DE SÉCURITÉ DES CLÉS ===

  validateApiKeySecurity(apiKey) {
    const issues = [];
    
    if (!apiKey || apiKey.length < 20) {
      issues.push('API key trop courte');
    }
    
    if (apiKey.includes('test') || apiKey.includes('demo')) {
      issues.push('Possible clé de test/démo détectée');
    }
    
    // Vérifier si c'est une clé connue de test
    const testPatterns = ['test', 'demo', 'example', 'sample', '123456', 'abcdef'];
    for (const pattern of testPatterns) {
      if (apiKey.toLowerCase().includes(pattern)) {
        issues.push(`Mot-clé de test détecté: ${pattern}`);
        break;
      }
    }
    
    return {
      isSecure: issues.length === 0,
      issues
    };
  }

  // === AUDIT DE SÉCURITÉ ===

  async auditSecuritySettings(user) {
    const audit = {
      score: 0,
      maxScore: 100,
      recommendations: [],
      critical: [],
      warnings: []
    };

    // Vérifier 2FA
    if (user.twoFactorEnabled) {
      audit.score += 25;
    } else {
      audit.critical.push('Activer l\'authentification à deux facteurs (2FA)');
    }

    // Vérifier les clés API chiffrées
    if (user.encryptedApiKeys) {
      audit.score += 25;
    } else {
      audit.warnings.push('Chiffrer les clés API dans la base de données');
    }

    // Vérifier IP whitelist
    if (user.allowedIPs && user.allowedIPs.length > 0) {
      audit.score += 20;
    } else {
      audit.warnings.push('Configurer une liste blanche d\'IP pour les API');
    }

    // Vérifier le mot de passe
    if (user.passwordChangedAt) {
      const daysSinceChange = (Date.now() - new Date(user.passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceChange < 90) {
        audit.score += 15;
      } else {
        audit.warnings.push('Changer le mot de passe (dernier changement il y a plus de 90 jours)');
      }
    }

    // Vérifier les notifications
    if (user.securityNotifications) {
      audit.score += 15;
    } else {
      audit.warnings.push('Activer les notifications de sécurité');
    }

    return audit;
  }

  // === RATE LIMITING ADAPTATIF ===

  calculateRateLimit(userTier = 'basic') {
    const tiers = {
      basic: { requests: 100, window: 60 },
      pro: { requests: 1000, window: 60 },
      enterprise: { requests: 10000, window: 60 }
    };
    
    return tiers[userTier] || tiers.basic;
  }
}

module.exports = new SecurityService();
