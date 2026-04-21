// Configuration Admin - NEUROVEST
// Ce fichier contient les codes d'accès admin - À PROTÉGER

// Les 3 fondateurs/admin principaux
const MAIN_ADMINS = [
  {
    username: 'fondateur1', // Change ça par ton pseudo
    code: 'ETERNAL666', // Code pour le premier fondateur
    role: 'founder',
    permissions: ['all']
  },
  {
    username: 'fondateur2', // Pseudo du deuxième pote
    code: 'ETERNAL667', // Code unique pour le deuxième
    role: 'founder', 
    permissions: ['all']
  },
  {
    username: 'fondateur3', // Pseudo du troisième pote
    code: 'ETERNAL668', // Code unique pour le troisième
    role: 'founder',
    permissions: ['all']
  }
];

// Admin secondaires (que les fondateurs peuvent créer)
let secondaryAdmins = [];

// Vérifier le code admin
function verifyAdminCode(code, username) {
  // Check main admins
  const mainAdmin = MAIN_ADMINS.find(
    a => a.code === code && (a.username === username || username === undefined)
  );
  
  if (mainAdmin) {
    return {
      success: true,
      admin: mainAdmin,
      isMainAdmin: true
    };
  }
  
  // Check secondary admins
  const secondaryAdmin = secondaryAdmins.find(
    a => a.code === code && a.active
  );
  
  if (secondaryAdmin) {
    return {
      success: true,
      admin: secondaryAdmin,
      isMainAdmin: false
    };
  }
  
  return { success: false };
}

// Ajouter un admin secondaire (seulement les fondateurs peuvent le faire)
function addSecondaryAdmin(username, createdBy) {
  // Vérifier que le créateur est un fondateur
  const creator = MAIN_ADMINS.find(a => a.username === createdBy);
  if (!creator) {
    return { success: false, error: 'Seuls les fondateurs peuvent créer des admins' };
  }
  
  const code = generateAdminCode();
  const newAdmin = {
    username,
    code,
    role: 'admin',
    createdBy,
    createdAt: new Date(),
    active: true,
    permissions: ['manage_channels', 'ban_users', 'delete_messages']
  };
  
  secondaryAdmins.push(newAdmin);
  return { success: true, admin: newAdmin };
}

// Générer un code admin unique
function generateAdminCode() {
  const prefix = 'NV';
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${random}`;
}

// Révoquer un admin secondaire
function revokeSecondaryAdmin(username, revokedBy) {
  const revoker = MAIN_ADMINS.find(a => a.username === revokedBy);
  if (!revoker) {
    return { success: false, error: 'Seuls les fondateurs peuvent révoquer des admins' };
  }
  
  const admin = secondaryAdmins.find(a => a.username === username);
  if (!admin) {
    return { success: false, error: 'Admin non trouvé' };
  }
  
  admin.active = false;
  return { success: true };
}

module.exports = {
  MAIN_ADMINS,
  verifyAdminCode,
  addSecondaryAdmin,
  revokeSecondaryAdmin,
  generateAdminCode
};
