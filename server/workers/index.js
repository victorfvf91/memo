require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const ContentProcessorWorker = require('./contentProcessor');
const ClusterSummaryWorker = require('./clusterSummaryWorker');

class WorkerManager {
  constructor() {
    this.workers = [];
    this.isShuttingDown = false;
  }

  async start() {
    console.log('🚀 Starting background workers...');
    
    // Start content processing worker
    const contentWorker = new ContentProcessorWorker();
    this.workers.push(contentWorker);
    
    // Start cluster summary worker
    const summaryWorker = new ClusterSummaryWorker();
    this.workers.push(summaryWorker);
    
    // Start all workers
    const startPromises = this.workers.map(worker => worker.start());
    
    try {
      await Promise.all(startPromises);
    } catch (error) {
      console.error('Failed to start workers:', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  async shutdown() {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    console.log('🛑 Shutting down workers...');
    
    const stopPromises = this.workers.map(worker => worker.stop());
    
    try {
      await Promise.all(stopPromises);
      console.log('✅ All workers stopped');
    } catch (error) {
      console.error('Error stopping workers:', error);
    }
  }
}

// Start worker manager if this file is run directly
if (require.main === module) {
  const manager = new WorkerManager();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await manager.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await manager.shutdown();
    process.exit(0);
  });
  
  manager.start().catch(error => {
    console.error('Worker manager failed to start:', error);
    process.exit(1);
  });
}

module.exports = WorkerManager; 