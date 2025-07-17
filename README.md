# Intelligent News Aggregator

An AI-powered news aggregation platform that collects, summarizes, and categorizes news from multiple sources using advanced natural language processing.

## Features

- **Multi-Source News Aggregation**: Collect news from various RSS feeds and news APIs
- **AI-Powered Summarization**: Generate concise summaries of news articles using GPT-4
- **Intelligent Categorization**: Automatically categorize news into topics (Politics, Technology, Sports, etc.)
- **Sentiment Analysis**: Analyze the sentiment and tone of news articles
- **Trending Topics Detection**: Identify trending topics and emerging stories
- **Personalized Feed**: Customize news feed based on user preferences
- **Search and Filter**: Advanced search and filtering capabilities
- **Real-time Updates**: Live news updates with WebSocket integration
- **Export and Share**: Export summaries and share curated news collections

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: FastAPI, Python
- **AI/ML**: OpenAI GPT-4 API, NLTK, TextBlob
- **Data Sources**: NewsAPI, RSS feeds, web scraping
- **Database**: In-memory storage with JSON persistence
- **Real-time**: WebSocket for live updates
- **Deployment**: Fly.io (backend), Vercel (frontend)

## Setup Instructions

### Backend Setup
```bash
cd backend
poetry install
poetry run fastapi dev app/main.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Create `.env` files in both backend and frontend directories:

**Backend (.env)**:
```
OPENAI_API_KEY=your_openai_api_key_here
NEWS_API_KEY=your_news_api_key_here
```

**Frontend (.env)**:
```
VITE_API_URL=http://localhost:8000
```

## API Endpoints

- `GET /news` - Get aggregated news articles
- `POST /summarize` - Generate AI summary of article
- `GET /categories` - Get available news categories
- `GET /trending` - Get trending topics
- `POST /analyze-sentiment` - Analyze article sentiment
- `GET /search` - Search news articles
- `POST /personalize` - Get personalized news feed

## Supported Categories

- Technology
- Politics
- Business
- Sports
- Entertainment
- Health
- Science
- World News

## Demo

[Live Demo](https://your-deployed-app-url.com)

## Screenshots

![News Dashboard](screenshots/dashboard.png)
![Article Summary](screenshots/summary.png)
![Trending Topics](screenshots/trending.png)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Author

Created by **Anand Chunduri** - [GitHub](https://github.com/anandc1)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License
