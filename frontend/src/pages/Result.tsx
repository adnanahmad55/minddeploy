import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  Brain,
  Trophy,
  Target,
  Zap,
  TrendingUp,
  RotateCcw,
  Home,
  Star,
  MessageCircle
} from 'lucide-react';

interface Message {
  id: string;
  content: string;
  sender_type: 'user' | 'ai';
  timestamp: Date;
}

interface Opponent {
  id: string;
  username: string;
  elo: number;
  is_ai: boolean;
}

interface DebateResult {
  score: number;
  result: 'win' | 'loss' | 'draw' | null;
  eloChange: number;
  tokensEarned: number;
  feedback: {
    logic: number;
    persuasion: number;
    evidence: number;
    style: number;
  };
  overallAnalysisText: string;
}

// Helper function to convert markdown to HTML
const renderMarkdown = (markdownText: string) => {
  if (!markdownText) return '';
  
  let text = markdownText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = text.split('\n');
  let resultHtml = '';
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      if (inList) {
        resultHtml += '</ul>';
        inList = false;
      }
      continue;
    }

    const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      if (inList) {
        resultHtml += '</ul>';
        inList = false;
      }
      
      const level = headerMatch[1].length;
      const content = headerMatch[2].trim();
      
      let colorClass = 'text-cyber-blue border-cyber-blue/30';
      let icon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 9.81h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14.19H4z"/></svg>`;
      
      if (content.toLowerCase().includes('weakness')) {
        colorClass = 'text-cyber-red border-cyber-red/30';
        icon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-alert"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`;
      } else if (content.toLowerCase().includes('strength')) {
        colorClass = 'text-cyber-green border-cyber-green/30';
        icon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-check"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`;
      } else if (content.toLowerCase().includes('overall')) {
        colorClass = 'text-cyber-gold border-cyber-gold/30';
        icon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-award"><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/></svg>`;
      }
      
      const tag = `h${level}`;
      const textSize = level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : 'text-lg';
      
      resultHtml += `<${tag} class="${textSize} font-bold ${colorClass} flex items-center gap-2 mt-8 mb-4 pb-2 border-b bg-background/50 p-2 rounded-t-md">
                ${icon} ${content}
              </${tag}>`;
      continue;
    }

    if (line.startsWith('* ') || line.startsWith('- ')) {
      if (!inList) {
        resultHtml += '<ul class="list-none pl-0 my-4 space-y-2">';
        inList = true;
      }
      let itemContent = line.replace(/^[\*\-]\s+/, '');
      itemContent = itemContent.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-medium">$1</strong>');
      resultHtml += `<li class="mb-3 text-muted-foreground flex items-start text-[15px]">
                  <span class="inline-flex w-5 h-5 items-center justify-center rounded-full bg-muted/50 mt-0.5 mr-3 flex-shrink-0 text-cyber-blue shadow-[0_0_8px_rgba(0,240,255,0.3)]">
                    <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
                  </span>
                  <span class="leading-relaxed">${itemContent}</span>
                </li>`;
      continue;
    }

    // Normal paragraph
    if (inList) {
      resultHtml += '</ul>';
      inList = false;
    }
    let pContent = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-medium">$1</strong>');
    resultHtml += `<p class="text-muted-foreground mb-4 leading-relaxed text-[15px]">${pContent}</p>`;
  }

  if (inList) {
    resultHtml += '</ul>';
  }

  return `<div class="space-y-2">${resultHtml}</div>`;
};

const Result = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [result, setResult] = useState<DebateResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

  const opponent: Opponent = location.state?.opponent || { id: '0', username: 'Unknown', elo: 1200, is_ai: true };
  const topic: string = location.state?.topic || 'Unknown topic';
  const messages: Message[] = location.state?.messages || [];
  const duration: number = location.state?.duration || 0;
  const debateId: number = location.state?.debateId;
  const winnerName: string | null = location.state?.winner || null;

  useEffect(() => {
    if (isNaN(debateId) || !debateId) {
      toast({
        title: "Debate Data Missing",
        description: "Could not load debate results. Please start a new debate.",
        variant: "destructive",
      });
      navigate('/dashboard');
      return;
    }

    const calculateSimulatedResults = (serverWinner: string | null) => {
      let simulatedResult: 'win' | 'loss' | 'draw' | null = null;
      if (serverWinner === user?.username) {
        simulatedResult = 'win';
      } else if (serverWinner === 'Draw') {
        simulatedResult = 'draw';
      } else if (serverWinner !== null && serverWinner !== user?.username) {
        simulatedResult = 'loss';
      }

      const userMessages = messages.filter(m => m.sender_type === 'user');
      const baseScore = Math.min(50 + userMessages.length * 5, 100);
      const scoreVariation = Math.random() * 20 - 10;
      const finalScore = Math.max(20, Math.min(100, baseScore + scoreVariation));
      const eloChange = simulatedResult === 'win' ? 10 : (simulatedResult === 'loss' ? -10 : 0);
      const tokensEarned = simulatedResult === 'win' ? 50 : (simulatedResult === 'loss' ? 10 : 25);

      return {
        score: Math.round(finalScore),
        result: simulatedResult,
        eloChange,
        tokensEarned,
        feedback: {
          logic: Math.floor(finalScore * 0.8 + Math.random() * 20),
          persuasion: Math.floor(finalScore * 0.9 + Math.random() * 20),
          evidence: Math.floor(finalScore * 0.7 + Math.random() * 30),
          style: Math.floor(finalScore * 0.85 + Math.random() * 20),
        },
        overallAnalysisText: '',
      };
    };

    const realResult = location.state?.realResult;
    
    if (realResult) {
      let resultStr: 'win' | 'loss' | 'draw' | null = null;
      if (realResult.winner === user?.username) resultStr = 'win';
      else if (realResult.winner === 'Draw') resultStr = 'draw';
      else if (realResult.winner !== 'Undetermined') resultStr = 'loss';
      
      setResult({
        score: realResult.score || 50,
        result: resultStr,
        eloChange: realResult.elo_change || 0,
        tokensEarned: resultStr === 'win' ? 50 : (resultStr === 'loss' ? 10 : 25),
        feedback: {
          logic: realResult.feedback?.logic || 50,
          persuasion: realResult.feedback?.persuasion || 50,
          evidence: realResult.feedback?.evidence || 50,
          style: realResult.feedback?.style || 50,
        },
        overallAnalysisText: '',
      });
      setIsLoading(false);
    } else {
      const initialSimulatedResult = calculateSimulatedResults(winnerName);
      setResult(initialSimulatedResult);
      setIsLoading(false);
    }

    const fetchAnalysis = async () => {
      setIsAnalysisLoading(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/analysis/${debateId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setResult(prevResult => ({
          ...prevResult!,
          overallAnalysisText: data.analysis,
        }));
        toast({
          title: "AI Analysis loaded!",
          description: "Detailed feedback is now available.",
        });
      } catch (error) {
        console.error("Error fetching AI analysis:", error);
        setResult(prevResult => ({
          ...prevResult!,
          overallAnalysisText: "Failed to load detailed AI analysis. Please try again later.",
        }));
        toast({
          title: "Analysis Error",
          description: "Could not load AI's detailed debate analysis.",
          variant: "destructive",
        });
      } finally {
        setIsAnalysisLoading(false);
      }
    };

    fetchAnalysis();
  }, [messages, debateId, navigate, winnerName, user]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getResultColor = (resultValue: string | null) => {
    if (!resultValue) return 'text-foreground';
    switch (resultValue.toLowerCase()) {
      case 'win': return 'text-cyber-green';
      case 'loss': return 'text-cyber-red';
      case 'draw': return 'text-cyber-gold';
      default: return 'text-foreground';
    }
  };

  const getResultIcon = (resultValue: string | null) => {
    if (!resultValue) return <Brain className="h-8 w-8" />;
    switch (resultValue.toLowerCase()) {
      case 'win': return <Trophy className="h-8 w-8" />;
      case 'loss': return <Target className="h-8 w-8" />;
      case 'draw': return <Star className="h-8 w-8" />;
      default: return <Brain className="h-8 w-8" />;
    }
  };

  if (isLoading || !result) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
        <Card className="bg-gradient-card border-border/50 p-8 text-center max-w-md">
          <div className="relative mx-auto w-16 h-16 mb-6">
            <div className="absolute inset-0 border-4 border-cyber-blue/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-cyber-blue border-t-transparent rounded-full animate-spin"></div>
            <Brain className="absolute inset-0 m-auto h-8 w-8 text-cyber-blue" />
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-2">
            Calculating Debate Scores
          </h2>
          <p className="text-muted-foreground">
            Analyzing performance metrics...
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-bg">
      <header className="border-b border-border/50 bg-card/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Brain className="h-8 w-8 text-cyber-red" />
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              MindGrid
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-card border-border/50 p-8 text-center mb-8">
            <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
              getResultColor(result.result)
            }`}>
              <div className={getResultColor(result.result)}>
                {getResultIcon(result.result)}
              </div>
            </div>

            <h2 className={`text-4xl font-bold mb-2 ${getResultColor(result.result)}`}>
              {result.result ? result.result.charAt(0).toUpperCase() + result.result.slice(1) : 'Undetermined'}!
            </h2>
            <p className="text-muted-foreground mb-4">
              Battle complete • {formatDuration(duration)} duration
            </p>
            <p className="text-xl font-semibold text-foreground">
              Final Score: {result.score}/100
            </p>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-gradient-card border-border/50 p-6">
                <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5 text-cyber-blue" />
                  Performance Breakdown
                </h3>
                <div className="space-y-4">
                  {[
                    { label: 'Logic & Reasoning', score: result.feedback.logic, color: 'cyber-red' },
                    { label: 'Persuasion', score: result.feedback.persuasion, color: 'cyber-blue' },
                    { label: 'Evidence Quality', score: result.feedback.evidence, color: 'cyber-green' },
                    { label: 'Style & Clarity', score: result.feedback.style, color: 'cyber-gold' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      <div className="flex items-center space-x-3">
                        <div className="w-32 bg-muted/30 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full bg-${item.color}`}
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-foreground w-10 text-right">
                          {item.score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="bg-gradient-card border-border/50 p-6">
                <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                  <MessageCircle className="mr-2 h-5 w-5 text-cyber-gold" />
                  AI Analysis
                </h3>
                {isAnalysisLoading ? (
                  <div className="text-center py-4">
                    <div className="relative mx-auto w-8 h-8 mb-2">
                      <div className="absolute inset-0 border-2 border-cyber-blue/30 rounded-full"></div>
                      <div className="absolute inset-0 border-2 border-cyber-blue border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-muted-foreground text-sm">Generating detailed analysis...</p>
                  </div>
                ) : (
                  <div
                    className="w-full"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(result.overallAnalysisText) }}
                  />
                )}
              </Card>

              <Card className="bg-gradient-card border-border/50 p-6">
                <h3 className="text-xl font-semibold text-foreground mb-4">
                  Debate Summary
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Topic</p>
                    <p className="text-foreground font-medium">{topic}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Opponent</p>
                    <p className="text-foreground font-medium">
                      {opponent.username} {opponent.is_ai && '(AI)'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Duration</p>
                    <p className="text-foreground font-medium">{formatDuration(duration)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Messages</p>
                    <p className="text-foreground font-medium">
                      {messages.filter(m => m.sender_type === 'user').length}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="bg-gradient-card border-border/50 p-6">
                <h3 className="text-xl font-semibold text-foreground mb-4">
                  Rewards Earned
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-cyber-red/20 rounded-lg">
                        <Target className="h-5 w-5 text-cyber-red" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">ELO Change</p>
                        <p className={`font-semibold ${result.eloChange >= 0 ? 'text-cyber-green' : 'text-cyber-red'}`}>
                          {result.eloChange >= 0 ? '+' : ''}{result.eloChange}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-cyber-gold/20 rounded-lg">
                        <Zap className="h-5 w-5 text-cyber-gold" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Mind Tokens</p>
                        <p className="font-semibold text-cyber-gold">
                          +{result.tokensEarned}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => navigate('/matchmaking')}
                >
                  <RotateCcw className="mr-2 h-5 w-5" />
                  Battle Again
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => navigate('/dashboard')}
                >
                  <Home className="mr-2 h-5 w-5" />
                  Return to Base
                </Button>
                <Link to={`/analysis/${debateId}`} className="w-full">
                  <Button variant="secondary" size="lg" className="w-full">
                    <Brain className="mr-2 h-5 w-5" />
                    View Analysis
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Result;