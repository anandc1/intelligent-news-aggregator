import { useState, useEffect } from 'react'
import { Newspaper, Search, TrendingUp, Filter, RefreshCw, Sparkles, Clock, ExternalLink, Heart, Share2, BookOpen, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface NewsArticle {
  id: string
  title: string
  content: string
  summary?: string
  url: string
  source: string
  category: string
  published_at: string
  sentiment?: {
    sentiment: string
    polarity: number
    subjectivity: number
    confidence: number
  }
  keywords: string[]
  relevance_score?: number
  personalization_score?: number
}

interface TrendingTopic {
  topic: string
  count: number
  category: string
}

function App() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('news')
  
  const [personalizedArticles, setPersonalizedArticles] = useState<NewsArticle[]>([])
  const [userCategories, setUserCategories] = useState<string[]>([])
  const [userKeywords, setUserKeywords] = useState('')
  
  const [summaryLoading, setSummaryLoading] = useState<string>('')
  const [articleSummaries, setArticleSummaries] = useState<{[key: string]: string}>({})

  const getSentimentColor = (sentiment?: { sentiment: string; confidence: number }) => {
    if (!sentiment) return 'bg-gray-100 text-gray-800'
    
    const { sentiment: type, confidence } = sentiment
    const opacity = Math.max(0.3, confidence)
    
    switch (type) {
      case 'positive': return `bg-green-100 text-green-800 border-green-200`
      case 'negative': return `bg-red-100 text-red-800 border-red-200`
      default: return `bg-gray-100 text-gray-800 border-gray-200`
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 48) return 'Yesterday'
    return date.toLocaleDateString()
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/categories`)
      const data = await response.json()
      setCategories(data.categories)
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }

  const fetchNews = async (category?: string, refresh = false) => {
    setIsLoading(true)
    setError('')
    
    try {
      const params = new URLSearchParams()
      if (category) params.append('category', category)
      if (refresh) params.append('refresh', 'true')
      
      const response = await fetch(`${API_URL}/news?${params}`)
      if (!response.ok) throw new Error('Failed to fetch news')
      
      const data = await response.json()
      setArticles(data.articles)
    } catch (err) {
      setError('Failed to load news. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTrending = async () => {
    try {
      const response = await fetch(`${API_URL}/trending`)
      const data = await response.json()
      setTrendingTopics(data.trending_topics)
    } catch (err) {
      console.error('Error fetching trending topics:', err)
    }
  }

  const searchNews = async () => {
    if (!searchQuery.trim()) return
    
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch(`${API_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          category: selectedCategory || undefined
        })
      })
      
      if (!response.ok) throw new Error('Search failed')
      
      const data = await response.json()
      setArticles(data.results)
    } catch (err) {
      setError('Search failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const summarizeArticle = async (articleId: string) => {
    setSummaryLoading(articleId)
    
    try {
      const response = await fetch(`${API_URL}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId })
      })
      
      if (!response.ok) throw new Error('Summarization failed')
      
      const data = await response.json()
      setArticleSummaries(prev => ({
        ...prev,
        [articleId]: data.summary
      }))
    } catch (err) {
      setError('Failed to generate summary')
    } finally {
      setSummaryLoading('')
    }
  }

  const getPersonalizedFeed = async () => {
    if (userCategories.length === 0 && !userKeywords.trim()) {
      setError('Please select categories or enter keywords for personalization')
      return
    }
    
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch(`${API_URL}/personalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: userCategories,
          keywords: userKeywords.split(',').map(k => k.trim()).filter(k => k)
        })
      })
      
      if (!response.ok) throw new Error('Personalization failed')
      
      const data = await response.json()
      setPersonalizedArticles(data.personalized_articles)
      setActiveTab('personalized')
    } catch (err) {
      setError('Failed to create personalized feed')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshNews = async () => {
    try {
      await fetch(`${API_URL}/refresh`, { method: 'POST' })
      await fetchNews(selectedCategory, true)
      await fetchTrending()
    } catch (err) {
      setError('Failed to refresh news')
    }
  }

  useEffect(() => {
    fetchCategories()
    fetchNews()
    fetchTrending()
  }, [])

  const renderArticleCard = (article: NewsArticle, showScore = false) => (
    <Card key={article.id} className="mb-4 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="text-lg leading-tight mb-2">
              {article.title}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Badge variant="outline" className="text-xs">
                {article.category}
              </Badge>
              <span>•</span>
              <span>{article.source}</span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(article.published_at)}
              </div>
            </div>
            {article.sentiment && (
              <Badge className={`text-xs ${getSentimentColor(article.sentiment)}`}>
                {article.sentiment.sentiment} ({Math.round(article.sentiment.confidence * 100)}%)
              </Badge>
            )}
          </div>
          {showScore && (article.relevance_score || article.personalization_score) && (
            <Badge variant="secondary" className="text-xs">
              Score: {article.relevance_score || article.personalization_score}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-gray-700 mb-3 line-clamp-3">
          {article.content.substring(0, 200)}...
        </p>
        
        {articleSummaries[article.id] && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">AI Summary</span>
            </div>
            <p className="text-sm text-blue-700">{articleSummaries[article.id]}</p>
          </div>
        )}
        
        {article.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {article.keywords.slice(0, 5).map((keyword, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {keyword}
              </Badge>
            ))}
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => summarizeArticle(article.id)}
              disabled={summaryLoading === article.id || !!articleSummaries[article.id]}
            >
              {summaryLoading === article.id ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Summarizing...
                </>
              ) : articleSummaries[article.id] ? (
                <>
                  <Sparkles className="h-3 w-3 mr-1" />
                  Summarized
                </>
              ) : (
                <>
                  <BookOpen className="h-3 w-3 mr-1" />
                  Summarize
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={article.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Read Full
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Newspaper className="h-10 w-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">Intelligent News Aggregator</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI-powered news aggregation with smart summarization, sentiment analysis, and personalized feeds
          </p>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            <div className="flex gap-2">
              <Input
                placeholder="Search news..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchNews()}
                className="w-64"
              />
              <Button onClick={searchNews} disabled={isLoading}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => fetchNews(selectedCategory)}
              disabled={isLoading}
            >
              <Filter className="h-4 w-4 mr-1" />
              Filter
            </Button>
          </div>
          <Button onClick={refreshNews} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="news">Latest News</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="personalize">Personalize</TabsTrigger>
            <TabsTrigger value="personalized">My Feed</TabsTrigger>
          </TabsList>

          <TabsContent value="news" className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading news...</span>
              </div>
            ) : articles.length === 0 ? (
              <div className="text-center py-12">
                <Newspaper className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No articles found. Try refreshing or changing filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {articles.map(article => renderArticleCard(article, true))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trending" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Trending Topics
                </CardTitle>
                <CardDescription>
                  Most discussed topics in the last 24 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                {trendingTopics.length === 0 ? (
                  <p className="text-gray-600">No trending topics available yet.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {trendingTopics.map((topic, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          setSearchQuery(topic.topic)
                          setActiveTab('news')
                          searchNews()
                        }}
                      >
                        <div className="font-medium text-blue-900">{topic.topic}</div>
                        <div className="text-sm text-blue-600">{topic.count} mentions</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="personalize" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personalize Your News Feed</CardTitle>
                <CardDescription>
                  Select your interests to get a customized news experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Preferred Categories</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {categories.map((category) => (
                      <Button
                        key={category}
                        variant={userCategories.includes(category) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setUserCategories(prev =>
                            prev.includes(category)
                              ? prev.filter(c => c !== category)
                              : [...prev, category]
                          )
                        }}
                      >
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Keywords (comma-separated)</label>
                  <Textarea
                    placeholder="AI, technology, climate change, sports..."
                    value={userKeywords}
                    onChange={(e) => setUserKeywords(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>

                <Button
                  onClick={getPersonalizedFeed}
                  disabled={isLoading || (userCategories.length === 0 && !userKeywords.trim())}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Feed...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Create Personalized Feed
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="personalized" className="space-y-6">
            {personalizedArticles.length === 0 ? (
              <div className="text-center py-12">
                <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No personalized feed yet.</p>
                <Button onClick={() => setActiveTab('personalize')}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Set Up Personalization
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {personalizedArticles.map(article => renderArticleCard(article, true))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="text-center mt-12 text-gray-500">
          <p>Built with React, FastAPI, and OpenAI GPT-3.5</p>
        </div>
      </div>
    </div>
  )
}

export default App
