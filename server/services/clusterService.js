const OpenAI = require('openai');
const { db } = require('../config/database');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class ClusterService {
  constructor() {
    this.openai = openai;
  }

  // Create or update cluster
  async createCluster(userId, name, description = null, contentIds = []) {
    try {
      const [cluster] = await db('clusters')
        .insert({
          user_id: userId,
          name,
          description,
          is_auto_generated: false
        })
        .returning('*');

      // Add content to cluster if provided
      if (contentIds.length > 0) {
        const clusterAssignments = contentIds.map(contentId => ({
          content_id: contentId,
          cluster_id: cluster.id,
          is_primary: true,
          similarity_score: 1.0
        }));

        await db('content_clusters').insert(clusterAssignments);
      }

      // Update cluster metadata
      await this.updateClusterMetadata(cluster.id);

      return cluster;
    } catch (error) {
      console.error('Cluster creation failed:', error.message);
      throw error;
    }
  }

  // Get user's clusters with content counts
  async getUserClusters(userId) {
    try {
      const clusters = await db('clusters')
        .where('user_id', userId)
        .select('*')
        .orderBy('last_updated', 'desc');

      // Get content counts for each cluster
      const clustersWithCounts = await Promise.all(
        clusters.map(async (cluster) => {
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

      return clustersWithCounts;
    } catch (error) {
      console.error('Get clusters failed:', error.message);
      throw error;
    }
  }

  // Get cluster details with content
  async getClusterDetails(clusterId, userId, viewMode = 'mixed') {
    try {
      const cluster = await db('clusters')
        .where({ id: clusterId, user_id: userId })
        .first();

      if (!cluster) {
        throw new Error('Cluster not found');
      }

      // Get cluster content
      const content = await db('content_clusters')
        .join('content', 'content_clusters.content_id', 'content.id')
        .where('content_clusters.cluster_id', clusterId)
        .select('content.*', 'content_clusters.similarity_score', 'content_clusters.is_primary')
        .orderBy('content.created_at', 'desc');

      return {
        cluster,
        content,
        viewMode
      };
    } catch (error) {
      console.error('Get cluster details failed:', error.message);
      throw error;
    }
  }

  // Generate synthesized summary for cluster
  async generateClusterSummary(clusterId, userId) {
    try {
      // Get cluster content
      const content = await db('content_clusters')
        .join('content', 'content_clusters.content_id', 'content.id')
        .where('content_clusters.cluster_id', clusterId)
        .select('content.*')
        .orderBy('content.created_at', 'desc');

      if (content.length === 0) {
        return {
          summary: 'No content in this cluster yet.',
          citations: [],
          conflicts: []
        };
      }

      // Prepare content for analysis
      const contentTexts = content.map((item, index) => 
        `Source ${index + 1}: ${item.title}\n${item.full_text?.substring(0, 1000) || ''}`
      ).join('\n\n');

      const prompt = `
Analyze the following cluster of content and create a comprehensive summary. 

Requirements:
1. Create a 3-4 paragraph synthesized summary that identifies key themes, insights, and trends
2. For every claim or insight, include a citation in the format "[→ Source Title, saved X days ago]"
3. Identify any conflicting viewpoints or contradictory information
4. Highlight emerging trends or patterns

Content:
${contentTexts}

Respond in JSON format:
{
  "summary": "comprehensive summary with citations",
  "citations": [
    {
      "claim": "specific claim from summary",
      "sourceTitle": "Source Title",
      "sourceId": "content_id",
      "daysAgo": 5
    }
  ],
  "conflicts": [
    {
      "description": "description of conflict",
      "sources": ["source1", "source2"]
    }
  ]
}
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1000
      });

      const analysis = JSON.parse(response.choices[0].message.content);

      // Update cluster with new summary
      await db('clusters')
        .where({ id: clusterId, user_id: userId })
        .update({
          synthesized_summary: analysis.summary,
          summary_citations: analysis.citations,
          conflicts: analysis.conflicts,
          last_updated: new Date()
        });

      return analysis;
    } catch (error) {
      console.error('Summary generation failed:', error.message);
      return {
        summary: 'Unable to generate summary at this time.',
        citations: [],
        conflicts: []
      };
    }
  }

  // Update cluster metadata (coherence score, item count)
  async updateClusterMetadata(clusterId) {
    try {
      // Get cluster content
      const content = await db('content_clusters')
        .join('content', 'content_clusters.content_id', 'content.id')
        .where('content_clusters.cluster_id', clusterId)
        .select('content.embeddings');

      if (content.length === 0) {
        await db('clusters')
          .where('id', clusterId)
          .update({
            item_count: 0,
            coherence_score: 0
          });
        return;
      }

      // Calculate coherence score based on embedding similarity
      let totalSimilarity = 0;
      let comparisonCount = 0;

      for (let i = 0; i < content.length; i++) {
        for (let j = i + 1; j < content.length; j++) {
          if (content[i].embeddings && content[j].embeddings) {
            const similarity = this.calculateCosineSimilarity(
              content[i].embeddings,
              content[j].embeddings
            );
            totalSimilarity += similarity;
            comparisonCount++;
          }
        }
      }

      const coherenceScore = comparisonCount > 0 ? totalSimilarity / comparisonCount : 0;

      // Update cluster
      await db('clusters')
        .where('id', clusterId)
        .update({
          item_count: content.length,
          coherence_score: coherenceScore,
          last_updated: new Date()
        });
    } catch (error) {
      console.error('Cluster metadata update failed:', error.message);
    }
  }

  // Add content to cluster
  async addContentToCluster(clusterId, contentId, userId, isPrimary = false) {
    try {
      // Verify ownership
      const cluster = await db('clusters')
        .where({ id: clusterId, user_id: userId })
        .first();

      if (!cluster) {
        throw new Error('Cluster not found');
      }

      // Add content to cluster
      await db('content_clusters')
        .insert({
          content_id: contentId,
          cluster_id: clusterId,
          is_primary: isPrimary,
          similarity_score: isPrimary ? 1.0 : 0.8
        })
        .onConflict(['content_id', 'cluster_id'])
        .merge();

      // Update cluster metadata
      await this.updateClusterMetadata(clusterId);

      // Regenerate summary if cluster has enough content
      const contentCount = await db('content_clusters')
        .where('cluster_id', clusterId)
        .count('* as count')
        .first();

      if (parseInt(contentCount.count) >= 3) {
        // Regenerate summary asynchronously
        this.generateClusterSummary(clusterId, userId)
          .catch(error => console.error('Background summary generation failed:', error));
      }

      return { message: 'Content added to cluster successfully' };
    } catch (error) {
      console.error('Add content to cluster failed:', error.message);
      throw error;
    }
  }

  // Remove content from cluster
  async removeContentFromCluster(clusterId, contentId, userId) {
    try {
      // Verify ownership
      const cluster = await db('clusters')
        .where({ id: clusterId, user_id: userId })
        .first();

      if (!cluster) {
        throw new Error('Cluster not found');
      }

      // Remove content from cluster
      await db('content_clusters')
        .where({ cluster_id: clusterId, content_id: contentId })
        .del();

      // Update cluster metadata
      await this.updateClusterMetadata(clusterId);

      return { message: 'Content removed from cluster successfully' };
    } catch (error) {
      console.error('Remove content from cluster failed:', error.message);
      throw error;
    }
  }

  // Delete cluster
  async deleteCluster(clusterId, userId) {
    try {
      // Verify ownership
      const cluster = await db('clusters')
        .where({ id: clusterId, user_id: userId })
        .first();

      if (!cluster) {
        throw new Error('Cluster not found');
      }

      // Delete cluster (content_clusters will be deleted via CASCADE)
      await db('clusters')
        .where({ id: clusterId, user_id: userId })
        .del();

      return { message: 'Cluster deleted successfully' };
    } catch (error) {
      console.error('Delete cluster failed:', error.message);
      throw error;
    }
  }

  // Calculate cosine similarity between two vectors
  calculateCosineSimilarity(vec1, vec2) {
    if (!Array.isArray(vec1) || !Array.isArray(vec2) || vec1.length !== vec2.length) {
      return 0;
    }

    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    return dotProduct / (magnitude1 * magnitude2);
  }
}

module.exports = new ClusterService(); 