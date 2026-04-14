import CryptoJS from 'crypto-js';

// Clé de chiffrement dérivée d'une valeur unique par utilisateur (session + userAgent)
const getEncryptionKey = (): string => {
  const baseKey = navigator.userAgent + window.location.hostname;
  return CryptoJS.SHA256(baseKey).toString().slice(0, 32);
};

// Chiffrer une valeur
export const encryptValue = (value: string): string => {
  if (!value) return '';
  const key = getEncryptionKey();
  return CryptoJS.AES.encrypt(value, key).toString();
};

// Déchiffrer une valeur
export const decryptValue = (encrypted: string): string => {
  if (!encrypted) return '';
  try {
    const key = getEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return '';
  }
};

// Sauvegarder une clé API chiffrée
export const saveEncryptedKey = (keyName: string, value: string): void => {
  const encrypted = encryptValue(value);
  localStorage.setItem(`encrypted_${keyName}`, encrypted);
};

// Récupérer une clé API déchiffrée
export const getDecryptedKey = (keyName: string): string => {
  const encrypted = localStorage.getItem(`encrypted_${keyName}`);
  if (!encrypted) return '';
  return decryptValue(encrypted);
};

// Effacer une clé
export const clearEncryptedKey = (keyName: string): void => {
  localStorage.removeItem(`encrypted_${keyName}`);
};

// Vérifier si une clé existe
export const hasEncryptedKey = (keyName: string): boolean => {
  return !!localStorage.getItem(`encrypted_${keyName}`);
};
