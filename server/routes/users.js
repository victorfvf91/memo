const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');

const router = express.Router();

// Validation middleware
const validateUpdateProfile = [
  body('name').optional().trim().isLength({ min: 1 }),
  body('email').optional().isEmail().normalizeEmail()
];

// Get user profile
router.get('/profile', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await db('users')
      .where('id', userId)
      .select('id', 'email', 'name', 'created_at')
      .first();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user stats
    const contentCount = await db('content')
      .where('user_id', userId)
      .count('* as count')
      .first();

    const clusterCount = await db('clusters')
      .where('user_id', userId)
      .count('* as count')
      .first();

    const recentContent = await db('content')
      .where('user_id', userId)
      .select('id', 'title', 'url', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(5);

    res.json({
      user,
      stats: {
        contentCount: parseInt(contentCount.count),
        clusterCount: parseInt(clusterCount.count)
      },
      recentContent
    });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/profile', validateUpdateProfile, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const userId = req.user.id;
    const { name, email } = req.body;

    // Check if email is already taken (if updating email)
    if (email) {
      const existingUser = await db('users')
        .where('email', email)
        .whereNot('id', userId)
        .first();

      if (existingUser) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

    // Update user
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date();
      
      await db('users')
        .where('id', userId)
        .update(updates);
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Get user dashboard data
router.get('/dashboard', async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get recent clusters
    const recentClusters = await db('clusters')
      .where('user_id', userId)
      .select('*')
      .orderBy('last_updated', 'desc')
      .limit(6);

    // Get clusters with content counts
    const clustersWithCounts = await Promise.all(
      recentClusters.map(async (cluster) => {
        const count = await db('content_clusters')
          .where('cluster_id', cluster.id)
          .count('* as count')
          .first();

        return {
          ...cluster,
          item_count: parseInt(count.count)
        };
      })
    );

    // Get recent content
    const recentContent = await db('content')
      .where('user_id', userId)
      .select('id', 'title', 'url', 'domain', 'created_at', 'content_type')
      .orderBy('created_at', 'desc')
      .limit(10);

    // Get content by type stats
    const contentByType = await db('content')
      .where('user_id', userId)
      .select('content_type')
      .count('* as count')
      .groupBy('content_type');

    res.json({
      recentClusters: clustersWithCounts,
      recentContent,
      contentByType
    });
  } catch (error) {
    next(error);
  }
});

// Get user activity
router.get('/activity', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get recent content saves
    const recentSaves = await db('content')
      .where('user_id', userId)
      .select('id', 'title', 'url', 'created_at', 'content_type')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Get cluster updates
    const clusterUpdates = await db('clusters')
      .where('user_id', userId)
      .where('updated_at', '>', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
      .select('id', 'name', 'updated_at')
      .orderBy('updated_at', 'desc');

    const total = await db('content')
      .where('user_id', userId)
      .count('* as count')
      .first();

    res.json({
      recentSaves,
      clusterUpdates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.count),
        pages: Math.ceil(total.count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 