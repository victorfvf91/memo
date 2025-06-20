const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const contentProcessor = require('../services/contentProcessor');
const queueService = require('../services/queueService');

const router = express.Router();

// Validation middleware
const validateSaveContent = [
  body('url').isURL().withMessage('Valid URL is required'),
  body('title').optional().isString().trim()
];

// Save new content (now uses background processing)
router.post('/save', validateSaveContent, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { url, title } = req.body;
    const userId = req.user.id;

    // Check if content already exists for this user
    const existingContent = await db('content')
      .where({ user_id: userId, url })
      .first();

    if (existingContent) {
      return res.status(409).json({ error: 'Content already saved' });
    }

    // Create content record immediately with pending status
    const [content] = await db('content')
      .insert({
        user_id: userId,
        url,
        title: title || 'Processing...',
        processing_status: 'pending',
        content_type: 'article'
      })
      .returning(['id', 'url', 'title', 'processing_status']);

    // Add content processing job to queue
    const jobId = await queueService.addJob('content-processing', {
      userId,
      contentId: content.id,
      url
    }, 'high'); // High priority for user-initiated saves

    res.status(201).json({
      message: 'Content queued for processing',
      content: {
        id: content.id,
        url: content.url,
        title: content.title,
        processing_status: content.processing_status
      },
      jobId
    });
  } catch (error) {
    next(error);
  }
});

// Check job status
router.get('/job/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const status = await queueService.getJobStatus('content-processing', jobId);
    
    if (status.status === 'completed') {
      // Get cluster suggestions from Redis
      const suggestionsKey = `content:${status.data.contentId}:suggestions`;
      const suggestions = await queueService.redis.get(suggestionsKey);
      
      res.json({
        status: 'completed',
        clusterSuggestions: suggestions ? JSON.parse(suggestions) : []
      });
    } else {
      res.json({ status: status.status });
    }
  } catch (error) {
    next(error);
  }
});

// Get user's saved content
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, cluster_id, search } = req.query;
    const offset = (page - 1) * limit;

    let query = db('content')
      .where('user_id', userId)
      .orderBy('created_at', 'desc');

    // Filter by cluster if specified
    if (cluster_id) {
      query = query
        .join('content_clusters', 'content.id', 'content_clusters.content_id')
        .where('content_clusters.cluster_id', cluster_id);
    }

    // Search functionality
    if (search) {
      query = query.where(function() {
        this.where('title', 'ilike', `%${search}%`)
          .orWhere('full_text', 'ilike', `%${search}%`)
          .orWhere('author', 'ilike', `%${search}%`);
      });
    }

    const content = await query
      .select('*')
      .limit(limit)
      .offset(offset);

    const total = await query.clone().count('* as count').first();

    res.json({
      content,
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

// Get specific content item
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const content = await db('content')
      .where({ id, user_id: userId })
      .first();

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Get associated clusters
    const clusters = await db('content_clusters')
      .join('clusters', 'content_clusters.cluster_id', 'clusters.id')
      .where('content_clusters.content_id', id)
      .select('clusters.*', 'content_clusters.similarity_score', 'content_clusters.is_primary');

    res.json({
      content,
      clusters
    });
  } catch (error) {
    next(error);
  }
});

// Update content
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, cluster_id } = req.body;

    const content = await db('content')
      .where({ id, user_id: userId })
      .first();

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Update content
    const updates = {};
    if (title) updates.title = title;

    if (Object.keys(updates).length > 0) {
      await db('content')
        .where({ id, user_id: userId })
        .update(updates);
    }

    // Update cluster assignment if specified
    if (cluster_id) {
      // Remove existing primary assignments
      await db('content_clusters')
        .where({ content_id: id, is_primary: true })
        .update({ is_primary: false });

      // Add new cluster assignment
      await db('content_clusters')
        .insert({
          content_id: id,
          cluster_id,
          is_primary: true,
          similarity_score: 1.0
        })
        .onConflict(['content_id', 'cluster_id'])
        .merge();

      // Trigger cluster summary regeneration
      await queueService.addJob('cluster-summary', {
        userId,
        clusterId
      }, 'low');
    }

    res.json({ message: 'Content updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete content
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const deleted = await db('content')
      .where({ id, user_id: userId })
      .del();

    if (!deleted) {
      return res.status(404).json({ error: 'Content not found' });
    }

    res.json({ message: 'Content deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Process content (for manual reprocessing)
router.post('/:id/process', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const content = await db('content')
      .where({ id, user_id: userId })
      .first();

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Update status to processing
    await db('content')
      .where({ id, user_id: userId })
      .update({ processing_status: 'processing' });

    // Add reprocessing job to queue
    const jobId = await queueService.addJob('content-processing', {
      userId,
      contentId: id,
      url: content.url
    }, 'normal');

    res.json({ 
      message: 'Content reprocessing started',
      jobId
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 