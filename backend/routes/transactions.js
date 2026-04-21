/**
 * 💳 Routes Transactions - Gestion des transactions financières
 */

const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { authenticate } = require('../middleware/auth');

/**
 * 🔐 Middleware auth pour toutes les routes
 */
router.use(authenticate);

/**
 * 📊 GET /api/transactions - Liste des transactions de l'utilisateur
 */
router.get('/', async (req, res) => {
  try {
    const { type, status, limit = 50, skip = 0 } = req.query;
    
    const query = { userId: req.user._id };
    if (type) query.type = type;
    if (status) query.status = status;
    
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();
    
    const total = await Transaction.countDocuments(query);
    
    res.json({
      success: true,
      data: transactions,
      pagination: {
        total,
        skip: parseInt(skip),
        limit: parseInt(limit),
        hasMore: total > parseInt(skip) + transactions.length
      }
    });
  } catch (error) {
    console.error('[Transactions] Get error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 📈 GET /api/transactions/stats - Statistiques des transactions
 */
router.get('/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const stats = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: since }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' }
        }
      }
    ]);
    
    // Statuts
    const statusStats = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: since }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        byType: stats,
        byStatus: statusStats,
        period: `${days} days`
      }
    });
  } catch (error) {
    console.error('[Transactions] Stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 🔍 GET /api/transactions/:id - Détail d'une transaction
 */
router.get('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).lean();
    
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    
    res.json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ➕ POST /api/transactions - Créer une transaction (admin seulement)
 */
router.post('/', async (req, res) => {
  try {
    // Vérifier si admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    
    const transaction = new Transaction({
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await transaction.save();
    
    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('[Transactions] Create error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 🔄 PUT /api/transactions/:id - Mettre à jour une transaction (admin)
 */
router.put('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    
    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { 
        ...req.body, 
        updatedAt: new Date() 
      },
      { new: true }
    );
    
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    
    res.json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ❌ DELETE /api/transactions/:id - Supprimer une transaction (admin)
 */
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Super admin required' });
    }
    
    const transaction = await Transaction.findByIdAndDelete(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
