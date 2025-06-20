# Contextual Bookmarking App

An intelligent bookmarking platform that automatically understands, categorises, and synthesises saved content into coherent knowledge clusters, enabling effortless saving and meaningful consumption.

## 🎯 Problem Statement

Knowledge workers save significantly more content than they consume, creating information graveyards rather than useful knowledge bases. Current bookmarking tools are glorified lists that don't help users make sense of saved content or facilitate actual consumption.

## ✨ Key Features

- **Intelligent Content Analysis**: AI-powered content summarization and entity extraction
- **Automatic Clustering**: Smart categorization of saved content based on semantic similarity
- **Synthesized Summaries**: Coherent knowledge clusters with source-attributed insights
- **Chrome Extension**: One-click saving from any webpage
- **PWA Interface**: Progressive web app for seamless mobile and desktop experience
- **Conflict Detection**: Automatic identification of contradictory information

## 🏗️ Architecture

```
├── client/          # React PWA frontend
├── server/          # Node.js API backend
├── extension/       # Chrome extension
└── shared/          # Shared types and utilities
```

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm run install:all
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Start development servers:**
   ```bash
   npm run dev
   ```

4. **Load Chrome extension:**
   - Open Chrome Extensions (chrome://extensions/)
   - Enable Developer Mode
   - Load unpacked extension from `extension/dist/`

## 🔧 Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/bookmarking_app

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# JWT Secret
JWT_SECRET=your_jwt_secret

# Server
PORT=3001
NODE_ENV=development

# Content Processing
MERCURY_API_KEY=your_mercury_api_key
YOUTUBE_API_KEY=your_youtube_api_key
```

## 📱 Features

### Save Mode
- Chrome extension with right-click context menu
- PWA with share target functionality
- Automatic content analysis and clustering suggestions
- One-tap categorization

### Consume Mode
- Synthesized cluster summaries with source citations
- Conflict detection and highlighting
- Multiple view modes (Summary, Sources, Mixed)
- Intelligent content organization

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, PWA
- **Backend**: Node.js, Express, PostgreSQL, Redis
- **AI**: OpenAI GPT-4, Embeddings API
- **Content Processing**: Mercury API, YouTube API
- **Extension**: Chrome Extension Manifest V3

## 📊 Development Phases

- **Phase 1**: Core infrastructure and save flow
- **Phase 2**: Clustering intelligence and suggestions
- **Phase 3**: Advanced consumption features and polish

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details 