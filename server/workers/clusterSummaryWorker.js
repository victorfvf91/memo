require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const queueService = require('../services/queueService');
const clusterService = require('../services/clusterService');
const { db } = require('../config/database');

class ClusterSummaryWorker {
  constructor() {
    this.isRunning = false;
    this.pollInterval = 10000; // 10 seconds (lower priority than content processing)
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🚀 Cluster Summary Worker started');
    
    while (this.isRunning) {
      try {
        await this.processNextJob();
        await this.sleep(this.pollInterval);
      } catch (error) {
        console.error('Cluster Summary Worker error:', error);
        await this.sleep(this.pollInterval * 2);
      }
    }
  }

  async stop() {
    this.isRunning = false;
    console.log('🛑 Cluster Summary Worker stopped');
  }

  async processNextJob() {
    const job = await queueService.getNextJob('cluster-summary');
    
    if (!job) {
      return; // No jobs to process
    }

    console.log(`Processing cluster summary job ${job.id}:`, job.data.clusterId);
    
    try {
      const { userId, clusterId } = job.data;
      
      // Check if cluster has enough content for summary generation
      const contentCount = await db('content_clusters')
        .where('cluster_id', clusterId)
        .count('* as count')
        .first();

      if (parseInt(contentCount.count) < 3) {
        console.log(`Cluster ${clusterId} has insufficient content (${contentCount.count}), skipping summary generation`);
        await queueService.completeJob('cluster-summary', job.id);
        return;
      }

      // Generate cluster summary
      const summary = await clusterService.generateClusterSummary(clusterId, userId);
      
      // Update cluster with new summary
      await db('clusters')
        .where({ id: clusterId, user_id: userId })
        .update({
          synthesized_summary: summary.summary,
          summary_citations: summary.citations,
          conflicts: summary.conflicts,
          last_updated: new Date()
        });

      // Mark job as completed
      await queueService.completeJob('cluster-summary', job.id);
      
      console.log(`✅ Cluster summary job ${job.id} completed successfully`);
      
    } catch (error) {
      console.error(`❌ Cluster summary job ${job.id} failed:`, error);
      
      // Mark job as failed
      await queueService.failJob('cluster-summary', job.id, error);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start worker if this file is run directly
if (require.main === module) {
  const worker = new ClusterSummaryWorker();
  
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
    console.error('Cluster Summary Worker failed to start:', error);
    process.exit(1);
  });
}

module.exports = ClusterSummaryWorker; 