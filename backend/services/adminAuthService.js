const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * 🔐 Service d'authentification Admin
 * Gère les credentials admin depuis .env et la synchronisation avec la DB
 */
class AdminAuthService {
  constructor() {
    this.adminCredentials = this.loadAdminCredentials();
  }

  /**
   * Charger les credentials admin depuis les variables d'environnement
   */
  loadAdminCredentials() {
    const admins = [];
    
    for (let i = 1; i <= 5; i++) { // Support jusqu'à 5 admins
      const email = process.env[`ADMIN_EMAIL_${i}`];
      const password = process.env[`ADMIN_PASSWORD_${i}`];
      const role = process.env[`ADMIN_ROLE_${i}`] || 'admin';

      if (email && password) {
        admins.push({
          email: email.toLowerCase().trim(),
          password, // Le hash se fait plus tard
          role,
          envIndex: i
        });
      }
    }

    if (admins.length === 0) {
      console.warn('⚠️  [AdminAuthService] Aucun admin configuré dans .env !');
    } else {
      console.log(`✅ [AdminAuthService] ${admins.length} admin(s) chargé(s) depuis .env`);
    }

    return admins;
  }

  /**
   * Vérifier les credentials admin
   * @param {string} email
   * @param {string} password
   * @returns {Object|null} - Admin info si valide, null sinon
   */
  async verifyCredentials(email, password) {
    const normalizedEmail = email.toLowerCase().trim();
    
    const admin = this.adminCredentials.find(a => a.email === normalizedEmail);
    
    if (!admin) {
      return null;
    }

    // Vérifier le mot de passe (comparaison directe - les mots de passe
    // dans .env sont considérés comme déjà sécurisés par l'OS/environment)
    // En production, on pourrait hasher les passwords dans .env
    const isValid = await bcrypt.compare(password, await bcrypt.hash(admin.password, 10)) ||
                    password === admin.password; // Fallback pour non-hashé

    if (!isValid) {
      return null;
    }

    return {
      email: admin.email,
      role: admin.role,
      isSuperAdmin: admin.role === 'super_admin'
    };
  }

  /**
   * Synchroniser l'admin avec la base de données User
   * Crée ou met à jour l'utilisateur admin dans MongoDB
   */
  async syncAdminWithDB(email, role) {
    try {
      let user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        // Créer l'utilisateur admin s'il n'existe pas
        const username = email.split('@')[0] + '_admin';
        user = new User({
          email: email.toLowerCase(),
          password: await bcrypt.hash(Math.random().toString(36).slice(-16), 10), // Password aléatoire
          username: username,
          displayName: `Admin ${role}`,
          role: role,
          isAdmin: true,
          isVerified: true,
          settings: {
            theme: 'dark',
            language: 'fr',
            notifications: {
              trades: false,
              alerts: true,
              signals: false,
              marketing: false,
              security: true
            }
          }
        });
        await user.save();
        console.log(`✅ [AdminAuthService] Admin créé dans DB: ${email}`);
      } else {
        // Mettre à jour le rôle si nécessaire
        if (user.role !== role) {
          user.role = role;
          user.isAdmin = true;
          await user.save();
          console.log(`✅ [AdminAuthService] Rôle admin mis à jour: ${email} -> ${role}`);
        }
      }

      return user;
    } catch (error) {
      console.error('[AdminAuthService] Erreur sync DB:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les admins configurés
   */
  getAllAdmins() {
    return this.adminCredentials.map(a => ({
      email: a.email,
      role: a.role,
      isSuperAdmin: a.role === 'super_admin'
    }));
  }

  /**
   * Vérifier si un email est un admin valide
   */
  isAdminEmail(email) {
    return this.adminCredentials.some(a => a.email === email.toLowerCase().trim());
  }

  /**
   * Récupérer le rôle d'un admin par email
   */
  getAdminRole(email) {
    const admin = this.adminCredentials.find(a => a.email === email.toLowerCase().trim());
    return admin ? admin.role : null;
  }

  /**
   * Recharger les credentials (utile après modification .env)
   */
  reload() {
    this.adminCredentials = this.loadAdminCredentials();
    return this.getAllAdmins();
  }
}

// Singleton
module.exports = new AdminAuthService();
