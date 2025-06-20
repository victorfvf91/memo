require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const queueService = require('../services/queueService');
const contentProcessor = require('../services/contentProcessor');
const clusterService = require('../services/clusterService');
const { db } = require('../config/database');

class ContentProcessorWorker {
  constructor() {
    this.isRunning = false;
    this.pollInterval = 5000; // 5 seconds
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🚀 Content Processor Worker started');
    
    while (this.isRunning) {
      try {
        await this.processNextJob();
        await this.sleep(this.pollInterval);
      } catch (error) {
        console.error('Worker error:', error);
        await this.sleep(this.pollInterval * 2); // Wait longer on error
      }
    }
  }

  async stop() {
    this.isRunning = false;
    console.log('🛑 Content Processor Worker stopped');
  }

  async processNextJob() {
    const job = await queueService.getNextJob('content-processing');
    
    if (!job) {
      return; // No jobs to process
    }

    console.log(`Processing job ${job.id}:`, job.data.url);
    
    try {
      const { userId, contentId, url } = job.data;
      
      // Update content status to processing
      await db('content')
        .where({ id: contentId, user_id: userId })
        .update({ processing_status: 'processing' });

      // Process content
      const processedContent = await contentProcessor.processContent(userId, url);
      
      // Update content with processed data
      await db('content')
        .where({ id: contentId, user_id: userId })
        .update({
          full_text: processedContent.extractedContent.content,
          metadata: {
            author: processedContent.extractedContent.author,
            domain: processedContent.extractedContent.domain,
            published_date: processedContent.extractedContent.publishedDate,
            excerpt: processedContent.extractedContent.excerpt,
            analysis: processedContent.analysis
          },
          embeddings: processedContent.embeddings,
          processing_status: 'completed',
          content_type: processedContent.analysis.contentType,
          reading_time_estimate: Math.ceil(processedContent.extractedContent.content.length / 200),
          author: processedContent.extractedContent.author,
          domain: processedContent.extractedContent.domain,
          published_date: processedContent.extractedContent.publishedDate
        });

      // Add cluster suggestions to Redis for quick access
      const suggestionsKey = `content:${contentId}:suggestions`;
      await queueService.redis.setex(suggestionsKey, 3600, JSON.stringify(processedContent.clusterSuggestions));

      // Mark job as completed
      await queueService.completeJob('content-processing', job.id);
      
      console.log(`✅ Job ${job.id} completed successfully`);
      
      // Trigger cluster summary regeneration if needed
      await this.triggerClusterUpdates(userId, processedContent.clusterSuggestions);
      
    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);
      
      // Update content status to failed
      try {
        await db('content')
          .where({ id: job.data.contentId, user_id: job.data.userId })
          .update({ processing_status: 'failed' });
      } catch (dbError) {
        console.error('Failed to update content status:', dbError);
      }
      
      // Mark job as failed
      await queueService.failJob('content-processing', job.id, error);
    }
  }

  async triggerClusterUpdates(userId, clusterSuggestions) {
    try {
      // For each suggested cluster, trigger a summary regeneration job
      for (const suggestion of clusterSuggestions) {
        if (!suggestion.isNew && suggestion.id) {
          // Add summary regeneration job to queue
          await queueService.addJob('cluster-summary', {
            userId,
            clusterId: suggestion.id
          }, 'low'); // Low priority for summary updates
        }
      }
    } catch (error) {
      console.error('Failed to trigger cluster updates:', error);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start worker if this file is run directly
if (require.main === module) {
  const worker = new ContentProcessorWorker();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await worker.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await worker.stop();
    process.exit(0);
  });
  
  worker.start().catch(error => {
    console.error('Worker failed to start:', error);
    process.exit(1);
  });
}

module.exports = ContentProcessorWorker; 