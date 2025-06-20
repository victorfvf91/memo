require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const axios = require('axios');
const cheerio = require('cheerio');
const OpenAI = require('openai');
const { db } = require('../config/database');

class ContentProcessor {
  constructor() {
    this.openai = null;
  }

  // Initialize OpenAI client lazily
  getOpenAI() {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.openai;
  }

  // Extract content from URL
  async extractContent(url) {
    try {
      // Try Mercury API first for better article extraction
      if (process.env.MERCURY_API_KEY) {
        const mercuryResponse = await axios.get(`https://mercury.postlight.com/parser?url=${encodeURIComponent(url)}`, {
          headers: {
            'x-api-key': process.env.MERCURY_API_KEY
          }
        });
        
        if (mercuryResponse.data && mercuryResponse.data.content) {
          return {
            title: mercuryResponse.data.title || '',
            content: mercuryResponse.data.content,
            author: mercuryResponse.data.author || '',
            publishedDate: mercuryResponse.data.date_published || null,
            domain: mercuryResponse.data.domain || '',
            excerpt: mercuryResponse.data.excerpt || ''
          };
        }
      }

      // Fallback to basic web scraping
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      
      // Extract title
      const title = $('title').text() || $('h1').first().text() || '';
      
      // Extract content (prioritize article content)
      let content = '';
      const articleSelectors = [
        'article',
        '[role="main"]',
        '.post-content',
        '.article-content',
        '.entry-content',
        'main'
      ];

      for (const selector of articleSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text().trim();
          break;
        }
      }

      // Fallback to body if no article content found
      if (!content) {
        content = $('body').text().trim();
      }

      // Extract metadata
      const author = $('meta[name="author"]').attr('content') || 
                    $('.author').text() || 
                    $('[rel="author"]').text() || '';
      
      const publishedDate = $('meta[property="article:published_time"]').attr('content') ||
                           $('meta[name="date"]').attr('content') || null;

      return {
        title: title.substring(0, 500),
        content: content.substring(0, 50000), // Limit content size
        author,
        publishedDate,
        domain: new URL(url).hostname,
        excerpt: content.substring(0, 200)
      };
    } catch (error) {
      console.error('Content extraction failed:', error.message);
      throw new Error('Failed to extract content from URL');
    }
  }

  // Analyze content with OpenAI
  async analyzeContent(content, title) {
    try {
      const prompt = `
Analyze the following content and provide:
1. A 2-3 sentence summary
2. Key entities (people, companies, concepts, topics)
3. Sentiment (positive, negative, neutral)
4. Key insights (3-5 main points)
5. Content type classification

Content: ${title}\n\n${content.substring(0, 4000)}

Respond in JSON format:
{
  "summary": "brief summary",
  "entities": ["entity1", "entity2"],
  "sentiment": "positive/negative/neutral",
  "insights": ["insight1", "insight2"],
  "contentType": "article/video/social/research"
}
`;

      const response = await this.getOpenAI().chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      return analysis;
    } catch (error) {
      console.error('Content analysis failed:', error.message);
      // Return basic analysis as fallback
      return {
        summary: title,
        entities: [],
        sentiment: 'neutral',
        insights: [],
        contentType: 'article'
      };
    }
  }

  // Generate embeddings for content
  async generateEmbeddings(text) {
    try {
      const response = await this.getOpenAI().embeddings.create({
        model: "text-embedding-ada-002",
        input: text.substring(0, 8000), // Limit text length
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Embedding generation failed:', error.message);
      return [];
    }
  }

  // Get clustering suggestions
  async getClusterSuggestions(userId, contentAnalysis, embeddings) {
    try {
      // Get existing clusters for the user
      const existingClusters = await db('clusters')
        .where('user_id', userId)
        .select('id', 'name', 'description', 'embeddings');

      if (existingClusters.length === 0) {
        return [{
          name: contentAnalysis.entities[0] || 'General',
          confidence: 0.8,
          isNew: true
        }];
      }

      // Calculate similarity scores with existing clusters
      const suggestions = [];
      
      for (const cluster of existingClusters) {
        if (cluster.embeddings && embeddings.length > 0) {
          const similarity = this.calculateCosineSimilarity(embeddings, cluster.embeddings);
          
          if (similarity > 0.3) { // Threshold for relevance
            suggestions.push({
              id: cluster.id,
              name: cluster.name,
              confidence: similarity,
              isNew: false
            });
          }
        }
      }

      // Sort by confidence and limit to top 3
      suggestions.sort((a, b) => b.confidence - a.confidence);
      const topSuggestions = suggestions.slice(0, 3);

      // Add option to create new cluster
      if (topSuggestions.length < 3) {
        topSuggestions.push({
          name: contentAnalysis.entities[0] || 'New Topic',
          confidence: 0.5,
          isNew: true
        });
      }

      return topSuggestions;
    } catch (error) {
      console.error('Cluster suggestions failed:', error.message);
      return [{
        name: 'General',
        confidence: 0.5,
        isNew: true
      }];
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

  // Process content end-to-end
  async processContent(userId, url) {
    try {
      // Extract content
      const extractedContent = await this.extractContent(url);
      
      // Analyze content
      const analysis = await this.analyzeContent(extractedContent.content, extractedContent.title);
      
      // Generate embeddings
      const embeddings = await this.generateEmbeddings(extractedContent.content);
      
      // Get cluster suggestions
      const clusterSuggestions = await this.getClusterSuggestions(userId, analysis, embeddings);

      return {
        extractedContent,
        analysis,
        embeddings,
        clusterSuggestions
      };
    } catch (error) {
      console.error('Content processing failed:', error.message);
      throw error;
    }
  }
}

module.exports = new ContentProcessor(); 