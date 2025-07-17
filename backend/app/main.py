from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import os
import json
import requests
import feedparser
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv
from textblob import TextBlob
import re
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import hashlib

load_dotenv()

app = FastAPI(title="Intelligent News Aggregator", version="1.0.0")

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

news_articles = []
trending_topics = []
user_preferences = {}

class NewsArticle(BaseModel):
    id: str
    title: str
    content: str
    summary: Optional[str] = None
    url: str
    source: str
    category: str
    published_at: datetime
    sentiment: Optional[Dict[str, Any]] = None
    keywords: List[str] = []

class SummarizeRequest(BaseModel):
    article_id: str

class SentimentRequest(BaseModel):
    text: str

class PersonalizeRequest(BaseModel):
    categories: List[str]
    keywords: List[str]
    sources: List[str] = []

class SearchRequest(BaseModel):
    query: str
    category: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None

CATEGORIES = [
    "technology", "politics", "business", "sports", 
    "entertainment", "health", "science", "world"
]

RSS_FEEDS = {
    "technology": [
        "https://feeds.feedburner.com/oreilly/radar",
        "https://techcrunch.com/feed/",
        "https://www.wired.com/feed/rss"
    ],
    "politics": [
        "https://feeds.npr.org/1001/rss.xml",
        "https://feeds.reuters.com/reuters/politicsNews"
    ],
    "business": [
        "https://feeds.reuters.com/reuters/businessNews",
        "https://feeds.feedburner.com/entrepreneur/latest"
    ],
    "sports": [
        "https://feeds.reuters.com/reuters/sportsNews"
    ],
    "entertainment": [
        "https://feeds.reuters.com/reuters/entertainment"
    ],
    "health": [
        "https://feeds.reuters.com/reuters/health"
    ],
    "science": [
        "https://feeds.reuters.com/reuters/scienceNews"
    ],
    "world": [
        "https://feeds.reuters.com/reuters/worldNews"
    ]
}

def generate_article_id(title: str, url: str) -> str:
    """Generate unique ID for article"""
    return hashlib.md5(f"{title}{url}".encode()).hexdigest()

def clean_html(html_content: str) -> str:
    """Clean HTML content and extract text"""
    if not html_content:
        return ""
    
    soup = BeautifulSoup(html_content, 'html.parser')
    return soup.get_text().strip()

def extract_keywords(text: str, max_keywords: int = 10) -> List[str]:
    """Extract keywords from text using simple NLP"""
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'}
    
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    keywords = [word for word in words if word not in stop_words]
    
    word_freq = {}
    for word in keywords:
        word_freq[word] = word_freq.get(word, 0) + 1
    
    sorted_keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
    return [word for word, freq in sorted_keywords[:max_keywords]]

def analyze_sentiment(text: str) -> Dict[str, Any]:
    """Analyze sentiment of text"""
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity
    subjectivity = blob.sentiment.subjectivity
    
    if polarity > 0.1:
        sentiment = "positive"
    elif polarity < -0.1:
        sentiment = "negative"
    else:
        sentiment = "neutral"
    
    return {
        "sentiment": sentiment,
        "polarity": polarity,
        "subjectivity": subjectivity,
        "confidence": abs(polarity)
    }

def fetch_rss_articles(category: str) -> List[NewsArticle]:
    """Fetch articles from RSS feeds"""
    articles = []
    feeds = RSS_FEEDS.get(category, [])
    
    for feed_url in feeds:
        try:
            feed = feedparser.parse(feed_url)
            source = feed.feed.get('title', urlparse(feed_url).netloc)
            
            for entry in feed.entries[:5]:  # Limit to 5 articles per feed
                content = clean_html(entry.get('description', '') or entry.get('summary', ''))
                if len(content) < 50:  # Skip articles with very little content
                    continue
                
                article_id = generate_article_id(entry.title, entry.link)
                
                if any(article.id == article_id for article in news_articles):
                    continue
                
                published_at = datetime.now()
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    published_at = datetime(*entry.published_parsed[:6])
                
                article = NewsArticle(
                    id=article_id,
                    title=entry.title,
                    content=content,
                    url=entry.link,
                    source=source,
                    category=category,
                    published_at=published_at,
                    keywords=extract_keywords(f"{entry.title} {content}"),
                    sentiment=analyze_sentiment(f"{entry.title} {content}")
                )
                
                articles.append(article)
                
        except Exception as e:
            print(f"Error fetching from {feed_url}: {e}")
            continue
    
    return articles

def update_trending_topics():
    """Update trending topics based on recent articles"""
    global trending_topics
    
    recent_articles = [
        article for article in news_articles 
        if article.published_at > datetime.now() - timedelta(hours=24)
    ]
    
    keyword_freq = {}
    for article in recent_articles:
        for keyword in article.keywords:
            keyword_freq[keyword] = keyword_freq.get(keyword, 0) + 1
    
    trending_topics = [
        {"topic": keyword, "count": count, "category": "trending"}
        for keyword, count in sorted(keyword_freq.items(), key=lambda x: x[1], reverse=True)[:10]
        if count > 1  # Only include topics mentioned multiple times
    ]

async def refresh_news_data():
    """Background task to refresh news data"""
    global news_articles
    
    new_articles = []
    for category in CATEGORIES:
        category_articles = fetch_rss_articles(category)
        new_articles.extend(category_articles)
    
    news_articles.extend(new_articles)
    
    cutoff_date = datetime.now() - timedelta(days=7)
    news_articles = [article for article in news_articles if article.published_at > cutoff_date]
    
    update_trending_topics()
    
    return len(new_articles)

@app.get("/")
def read_root():
    return {"message": "Intelligent News Aggregator API", "version": "1.0.0"}

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

@app.get("/categories")
def get_categories():
    return {"categories": CATEGORIES}

@app.get("/news")
async def get_news(
    category: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    refresh: bool = False
):
    if refresh or len(news_articles) == 0:
        await refresh_news_data()
    
    filtered_articles = news_articles
    if category:
        filtered_articles = [article for article in news_articles if article.category == category]
    
    filtered_articles.sort(key=lambda x: x.published_at, reverse=True)
    
    paginated_articles = filtered_articles[offset:offset + limit]
    
    return {
        "articles": [article.dict() for article in paginated_articles],
        "total": len(filtered_articles),
        "category": category,
        "limit": limit,
        "offset": offset
    }

@app.post("/summarize")
async def summarize_article(request: SummarizeRequest):
    article = next((a for a in news_articles if a.id == request.article_id), None)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    if article.summary:
        return {"summary": article.summary, "article_id": request.article_id}
    
    try:
        prompt = f"""
        Summarize the following news article in 2-3 concise sentences. Focus on the key facts and main points:
        
        Title: {article.title}
        Content: {article.content[:2000]}  # Limit content length
        
        Provide a clear, factual summary without opinions or speculation.
        """
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a professional news summarizer. Create concise, factual summaries of news articles."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=200,
            temperature=0.3
        )
        
        summary = response.choices[0].message.content
        
        article.summary = summary
        
        return {
            "summary": summary,
            "article_id": request.article_id,
            "title": article.title
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")

@app.get("/trending")
async def get_trending():
    if len(trending_topics) == 0:
        update_trending_topics()
    
    return {"trending_topics": trending_topics}

@app.post("/analyze-sentiment")
async def analyze_article_sentiment(request: SentimentRequest):
    try:
        sentiment_data = analyze_sentiment(request.text)
        return sentiment_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing sentiment: {str(e)}")

@app.post("/search")
async def search_news(request: SearchRequest):
    try:
        filtered_articles = news_articles
        
        if request.category:
            filtered_articles = [a for a in filtered_articles if a.category == request.category]
        
        if request.date_from:
            filtered_articles = [a for a in filtered_articles if a.published_at >= request.date_from]
        if request.date_to:
            filtered_articles = [a for a in filtered_articles if a.published_at <= request.date_to]
        
        query_lower = request.query.lower()
        search_results = []
        
        for article in filtered_articles:
            score = 0
            if query_lower in article.title.lower():
                score += 3
            if query_lower in article.content.lower():
                score += 2
            if any(query_lower in keyword.lower() for keyword in article.keywords):
                score += 1
            
            if score > 0:
                article_dict = article.dict()
                article_dict['relevance_score'] = score
                search_results.append(article_dict)
        
        search_results.sort(key=lambda x: x['relevance_score'], reverse=True)
        
        return {
            "results": search_results[:20],  # Limit to top 20 results
            "query": request.query,
            "total_found": len(search_results)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching articles: {str(e)}")

@app.post("/personalize")
async def get_personalized_feed(request: PersonalizeRequest):
    try:
        user_preferences["default"] = {
            "categories": request.categories,
            "keywords": request.keywords,
            "sources": request.sources
        }
        
        personalized_articles = []
        
        for article in news_articles:
            score = 0
            
            if article.category in request.categories:
                score += 3
            
            for keyword in request.keywords:
                if keyword.lower() in article.title.lower():
                    score += 2
                if keyword.lower() in article.content.lower():
                    score += 1
                if any(keyword.lower() in k.lower() for k in article.keywords):
                    score += 1
            
            if request.sources and article.source in request.sources:
                score += 2
            
            if score > 0:
                article_dict = article.dict()
                article_dict['personalization_score'] = score
                personalized_articles.append(article_dict)
        
        personalized_articles.sort(key=lambda x: x['personalization_score'], reverse=True)
        
        return {
            "personalized_articles": personalized_articles[:15],
            "preferences": request.dict(),
            "total_matched": len(personalized_articles)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating personalized feed: {str(e)}")

@app.post("/refresh")
async def refresh_news(background_tasks: BackgroundTasks):
    """Manually trigger news refresh"""
    background_tasks.add_task(refresh_news_data)
    return {"message": "News refresh started in background"}

@app.on_event("startup")
async def startup_event():
    """Load initial news data on startup"""
    try:
        await refresh_news_data()
        print(f"Loaded {len(news_articles)} initial articles")
    except Exception as e:
        print(f"Error loading initial data: {e}")
