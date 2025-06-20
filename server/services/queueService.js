require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const Redis = require('redis');
const { v4: uuidv4 } = require('uuid');

class QueueService {
  constructor() {
    this.redis = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    this.redis.on('error', (err) => {
      console.error('Redis Queue Error:', err);
    });
    
    this.redis.on('connect', () => {
      console.log('✅ Redis Queue connected');
    });
    
    // Connect to Redis
    (async () => {
      await this.redis.connect();
    })();
  }

  // Add job to queue
  async addJob(queueName, jobData, priority = 'normal') {
    try {
      const job = {
        id: uuidv4(),
        data: jobData,
        priority,
        createdAt: new Date().toISOString(),
        attempts: 0,
        maxAttempts: 3
      };

      const queueKey = `queue:${queueName}`;
      const priorityKey = `queue:${queueName}:${priority}`;
      
      // Add to main queue
      await this.redis.lpush(queueKey, JSON.stringify(job));
      
      // Add to priority queue if high priority
      if (priority === 'high') {
        await this.redis.lpush(priorityKey, JSON.stringify(job));
      }

      console.log(`Job ${job.id} added to queue ${queueName}`);
      return job.id;
    } catch (error) {
      console.error('Failed to add job to queue:', error);
      throw error;
    }
  }

  // Get next job from queue
  async getNextJob(queueName, priority = 'normal') {
    try {
      const priorityKey = `queue:${queueName}:${priority}`;
      const queueKey = `queue:${queueName}`;
      
      // Try high priority queue first
      let jobData = await this.redis.rpop(priorityKey);
      
      if (!jobData) {
        // Fall back to normal queue
        jobData = await this.redis.rpop(queueKey);
      }
      
      if (jobData) {
        const job = JSON.parse(jobData);
        return job;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get job from queue:', error);
      throw error;
    }
  }

  // Mark job as completed
  async completeJob(queueName, jobId) {
    try {
      const completedKey = `completed:${queueName}:${jobId}`;
      await this.redis.setex(completedKey, 3600, JSON.stringify({ status: 'completed', completedAt: new Date().toISOString() }));
      console.log(`Job ${jobId} marked as completed`);
    } catch (error) {
      console.error('Failed to mark job as completed:', error);
    }
  }

  // Mark job as failed
  async failJob(queueName, jobId, error) {
    try {
      const failedKey = `failed:${queueName}:${jobId}`;
      await this.redis.setex(failedKey, 3600, JSON.stringify({ 
        status: 'failed', 
        error: error.message, 
        failedAt: new Date().toISOString() 
      }));
      console.log(`Job ${jobId} marked as failed:`, error.message);
    } catch (err) {
      console.error('Failed to mark job as failed:', err);
    }
  }

  // Get job status
  async getJobStatus(queueName, jobId) {
    try {
      const completedKey = `completed:${queueName}:${jobId}`;
      const failedKey = `failed:${queueName}:${jobId}`;
      
      const completed = await this.redis.get(completedKey);
      const failed = await this.redis.get(failedKey);
      
      if (completed) {
        return { status: 'completed', data: JSON.parse(completed) };
      } else if (failed) {
        return { status: 'failed', data: JSON.parse(failed) };
      } else {
        return { status: 'pending' };
      }
    } catch (error) {
      console.error('Failed to get job status:', error);
      return { status: 'unknown' };
    }
  }

  // Get queue statistics
  async getQueueStats(queueName) {
    try {
      const queueKey = `queue:${queueName}`;
      const highPriorityKey = `queue:${queueName}:high`;
      
      const pending = await this.redis.llen(queueKey);
      const highPriority = await this.redis.llen(highPriorityKey);
      
      return {
        pending,
        highPriority,
        total: pending + highPriority
      };
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return { pending: 0, highPriority: 0, total: 0 };
    }
  }

  // Clean up old completed/failed jobs
  async cleanupOldJobs(queueName, maxAge = 24 * 60 * 60) { // 24 hours default
    try {
      const pattern = `*:${queueName}:*`;
      const keys = await this.redis.keys(pattern);
      
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1 || ttl > maxAge) {
          await this.redis.del(key);
        }
      }
      
      console.log(`Cleaned up old jobs for queue ${queueName}`);
    } catch (error) {
      console.error('Failed to cleanup old jobs:', error);
    }
  }
}

module.exports = new QueueService(); 