/**
 * 🔐 Service de Chiffrement - NEUROVEST
 * Chiffrement AES-256-GCM pour les clés API sensibles
 * 
 * ⚠️ AVERTISSEMENT: Ce chiffrement est pour le stockage local uniquement
 * Les clés sont déchiffrées en mémoire et peuvent être accédées
 * si l'attaquant a accès au navigateur. Pour une sécurité maximale,
 * utilisez un backend pour stocker les clés.
 */

// Constantes
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits pour GCM
const SALT_LENGTH = 16;
const ITERATIONS = 100000;

interface EncryptedData {
  iv: string;
  salt: string;
  ciphertext: string;
  tag: string;
}

/**
 * Dérive une clé de chiffrement à partir d'un mot de passe
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordData,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Cast salt to ArrayBuffer to avoid TypeScript issues
  const saltBuffer = new Uint8Array(salt).buffer;

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: ALGORITHM,
      length: KEY_LENGTH
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Chiffre une chaîne de texte
 */
export async function encrypt(text: string, password: string): Promise<string> {
  try {
    // Générer sel aléatoire
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    
    // Générer IV aléatoire
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Dériver la clé
    const key = await deriveKey(password, salt);

    // Chiffrer
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(text);

    const encrypted = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv
      },
      key,
      plaintext
    );

    // Extraire ciphertext et tag
    const encryptedArray = new Uint8Array(encrypted);
    const ciphertext = encryptedArray.slice(0, -IV_LENGTH);
    const tag = encryptedArray.slice(-IV_LENGTH);

    // Encoder en base64
    const result: EncryptedData = {
      iv: arrayBufferToBase64(iv),
      salt: arrayBufferToBase64(salt),
      ciphertext: arrayBufferToBase64(ciphertext),
      tag: arrayBufferToBase64(tag)
    };

    return btoa(JSON.stringify(result));
  } catch (error) {
    console.error('[Encryption] Encryption failed:', error);
    throw new Error('Échec du chiffrement');
  }
}

/**
 * Déchiffre une chaîne de texte
 */
export async function decrypt(encryptedData: string, password: string): Promise<string> {
  try {
 // Décoder le JSON
    const decoded = JSON.parse(atob(encryptedData));
    const { iv, salt, ciphertext, tag }: EncryptedData = decoded;

    // Convertir depuis base64
    const saltArray = base64ToArrayBuffer(salt);
    const ivArray = base64ToArrayBuffer(iv);
    const ciphertextArray = base64ToArrayBuffer(ciphertext);
    const tagArray = base64ToArrayBuffer(tag);

    // Dériver la clé
    const key = await deriveKey(password, new Uint8Array(saltArray));

    // Recombiner ciphertext + tag
    const encrypted = new Uint8Array(ciphertextArray.byteLength + tagArray.byteLength);
    encrypted.set(new Uint8Array(ciphertextArray), 0);
    encrypted.set(new Uint8Array(tagArray), ciphertextArray.byteLength);

    // Déchiffrer
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: new Uint8Array(ivArray)
      },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('[Encryption] Decryption failed:', error);
    throw new Error('Échec du déchiffrement - mot de passe incorrect ou données corrompues');
  }
}

/**
 * Utilitaires de conversion
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Gestionnaire sécurisé des clés API
 */
export class SecureKeyManager {
  private static readonly STORAGE_KEY_API = 'encrypted_binance_api_key';
  private static readonly STORAGE_KEY_SECRET = 'encrypted_binance_secret_key';
  private static readonly STORAGE_KEY_PASSWORD_HASH = 'key_password_hash';

  /**
   * Stocke les clés API de manière sécurisée
   */
  static async storeKeys(apiKey: string, secretKey: string, password: string): Promise<void> {
    if (!apiKey || !secretKey || !password) {
      throw new Error('Tous les champs sont requis');
    }

    try {
      // Chiffrer les clés
      const encryptedApiKey = await encrypt(apiKey, password);
      const encryptedSecretKey = await encrypt(secretKey, password);

      // Stocker
      localStorage.setItem(this.STORAGE_KEY_API, encryptedApiKey);
      localStorage.setItem(this.STORAGE_KEY_SECRET, encryptedSecretKey);

      // Stocker hash du mot de passe pour vérification (pas le mot de passe lui-même)
      const passwordHash = await this.hashPassword(password);
      localStorage.setItem(this.STORAGE_KEY_PASSWORD_HASH, passwordHash);

      console.log('[SecureKeyManager] Keys stored securely');
    } catch (error) {
      console.error('[SecureKeyManager] Failed to store keys:', error);
      throw error;
    }
  }

  /**
   * Récupère les clés API
   */
  static async retrieveKeys(password: string): Promise<{ apiKey: string; secretKey: string } | null> {
    try {
      const encryptedApiKey = localStorage.getItem(this.STORAGE_KEY_API);
      const encryptedSecretKey = localStorage.getItem(this.STORAGE_KEY_SECRET);

      if (!encryptedApiKey || !encryptedSecretKey) {
        return null;
      }

      // Vérifier le mot de passe
      const storedHash = localStorage.getItem(this.STORAGE_KEY_PASSWORD_HASH);
      const providedHash = await this.hashPassword(password);

      if (storedHash !== providedHash) {
        throw new Error('Mot de passe incorrect');
      }

      // Déchiffrer
      const apiKey = await decrypt(encryptedApiKey, password);
      const secretKey = await decrypt(encryptedSecretKey, password);

      return { apiKey, secretKey };
    } catch (error) {
      console.error('[SecureKeyManager] Failed to retrieve keys:', error);
      return null;
    }
  }

  /**
   * Vérifie si des clés sont stockées
   */
  static hasStoredKeys(): boolean {
    return !!(
      localStorage.getItem(this.STORAGE_KEY_API) &&
      localStorage.getItem(this.STORAGE_KEY_SECRET)
    );
  }

  /**
   * Supprime les clés stockées
   */
  static clearKeys(): void {
    localStorage.removeItem(this.STORAGE_KEY_API);
    localStorage.removeItem(this.STORAGE_KEY_SECRET);
    localStorage.removeItem(this.STORAGE_KEY_PASSWORD_HASH);
    console.log('[SecureKeyManager] Keys cleared');
  }

  /**
   * Hash simple pour vérification mot de passe (pas pour stockage sécurisé de mots de passe)
   */
  private static async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return arrayBufferToBase64(hashBuffer);
  }

  /**
   * Rotation des clés - supprime les anciennes et demande nouvelles
   */
  static async rotateKeys(newApiKey: string, newSecretKey: string, password: string): Promise<void> {
    this.clearKeys();
    await this.storeKeys(newApiKey, newSecretKey, password);
    console.log('[SecureKeyManager] Keys rotated successfully');
  }
}

/**
 * Fonction de validation des clés API
 */
export function validateApiKey(apiKey: string): boolean {
  // Binance API keys sont généralement 64 caractères hex
  const apiKeyRegex = /^[A-Za-z0-9]{64}$/;
  return apiKeyRegex.test(apiKey);
}

export function validateSecretKey(secretKey: string): boolean {
  // Binance secret keys sont généralement 64 caractères
  return secretKey.length >= 32 && secretKey.length <= 128;
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return '***';
  return apiKey.slice(0, 4) + '****' + apiKey.slice(-4);
}
