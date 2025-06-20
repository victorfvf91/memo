const express = require('express');
const { body, validationResult } = require('express-validator');
const clusterService = require('../services/clusterService');

const router = express.Router();

// Validation middleware
const validateCreateCluster = [
  body('name').trim().isLength({ min: 1 }).withMessage('Cluster name is required'),
  body('description').optional().isString(),
  body('contentIds').optional().isArray()
];

// Get user's clusters
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const clusters = await clusterService.getUserClusters(userId);
    
    res.json({ clusters });
  } catch (error) {
    next(error);
  }
});

// Create new cluster
router.post('/', validateCreateCluster, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { name, description, contentIds = [] } = req.body;
    const userId = req.user.id;

    const cluster = await clusterService.createCluster(userId, name, description, contentIds);
    
    res.status(201).json({
      message: 'Cluster created successfully',
      cluster
    });
  } catch (error) {
    next(error);
  }
});

// Get cluster details
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { viewMode = 'mixed' } = req.query;
    const userId = req.user.id;

    const clusterDetails = await clusterService.getClusterDetails(id, userId, viewMode);
    
    res.json(clusterDetails);
  } catch (error) {
    next(error);
  }
});

// Generate cluster summary
router.post('/:id/summary', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const summary = await clusterService.generateClusterSummary(id, userId);
    
    res.json({
      message: 'Summary generated successfully',
      summary
    });
  } catch (error) {
    next(error);
  }
});

// Add content to cluster
router.post('/:id/content', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { contentId, isPrimary = false } = req.body;
    const userId = req.user.id;

    const result = await clusterService.addContentToCluster(id, contentId, userId, isPrimary);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Remove content from cluster
router.delete('/:id/content/:contentId', async (req, res, next) => {
  try {
    const { id, contentId } = req.params;
    const userId = req.user.id;

    const result = await clusterService.removeContentFromCluster(id, contentId, userId);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Update cluster
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;

    // Verify ownership
    const cluster = await db('clusters')
      .where({ id, user_id: userId })
      .first();

    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    // Update cluster
    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length > 0) {
      await db('clusters')
        .where({ id, user_id: userId })
        .update({
          ...updates,
          updated_at: new Date()
        });
    }

    res.json({ message: 'Cluster updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete cluster
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await clusterService.deleteCluster(id, userId);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get cluster suggestions for content
router.get('/suggestions/:contentId', async (req, res, next) => {
  try {
    const { contentId } = req.params;
    const userId = req.user.id;

    // Get content details
    const content = await db('content')
      .where({ id: contentId, user_id: userId })
      .first();

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Get existing clusters
    const clusters = await clusterService.getUserClusters(userId);

    // Calculate similarity scores
    const suggestions = [];
    
    for (const cluster of clusters) {
      if (content.embeddings && cluster.embeddings) {
        const similarity = clusterService.calculateCosineSimilarity(
          content.embeddings,
          cluster.embeddings
        );
        
        if (similarity > 0.3) { // Threshold for relevance
          suggestions.push({
            id: cluster.id,
            name: cluster.name,
            confidence: similarity,
            itemCount: cluster.item_count
          });
        }
      }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    res.json({ suggestions: suggestions.slice(0, 3) });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 