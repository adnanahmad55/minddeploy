import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, ArrowLeft, MessageCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const Analysis = () => {
  const { debateId } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState('');
  const [debate, setDebate] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!debateId) {
      navigate('/dashboard');
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
        
        // Fetch debate info, messages, and analysis simultaneously
        const [analysisRes, messagesRes, debateRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/analysis/${debateId}`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/debate/${debateId}/messages`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/debate/${debateId}`, { headers })
        ]);

        if (analysisRes.ok) {
          const data = await analysisRes.json();
          setAnalysis(data.analysis);
        } else {
          setAnalysis("Failed to load analysis. Please try again later.");
        }

        if (messagesRes.ok) {
          const data = await messagesRes.json();
          setMessages(data);
        }

        if (debateRes.ok) {
          const data = await debateRes.json();
          setDebate(data);
        }
        
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [debateId, navigate]);

  return (
    <div className="min-h-screen bg-gradient-bg text-foreground p-8">
      <header className="border-b border-border/50 bg-card/20 backdrop-blur-sm mb-6">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="text-xl font-bold text-cyber-blue">MindGrid Debate Arena</div>
          <div className="w-20"></div> {/* Spacer for centering */}
        </div>
      </header>
      
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="bg-card/50 border-border/30 shadow-lg shadow-cyber-blue/5">
          <CardHeader>
            <CardTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent flex items-center">
              <Brain className="mr-2 h-6 w-6 text-cyber-blue" />
              {debate ? debate.topic : `Debate Details for ID: ${debateId}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="relative mx-auto w-12 h-12 mb-4">
                  <div className="absolute inset-0 border-2 border-cyber-blue/30 rounded-full"></div>
                  <div className="absolute inset-0 border-2 border-cyber-blue border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-muted-foreground">Reconstructing debate timeline...</p>
              </div>
            ) : (
              <Tabs defaultValue="messages" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/20 border border-border/50">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-cyber-blue/20 data-[state=active]:text-cyber-blue transition-all">
                    <Info className="w-4 h-4 mr-2" /> Overview
                  </TabsTrigger>
                  <TabsTrigger value="messages" className="data-[state=active]:bg-cyber-blue/20 data-[state=active]:text-cyber-blue transition-all">
                    <MessageCircle className="w-4 h-4 mr-2" /> Conversation
                  </TabsTrigger>
                  <TabsTrigger value="analysis" className="data-[state=active]:bg-cyber-blue/20 data-[state=active]:text-cyber-blue transition-all">
                    <Brain className="w-4 h-4 mr-2" /> AI Analysis
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border border-border/30 rounded-lg bg-background/50 hover:bg-background/80 transition-colors">
                      <p className="text-muted-foreground mb-1 text-sm uppercase tracking-wider">Topic</p>
                      <p className="font-semibold text-lg text-foreground">{debate?.topic || 'N/A'}</p>
                    </div>
                    <div className="p-4 border border-border/30 rounded-lg bg-background/50 hover:bg-background/80 transition-colors">
                      <p className="text-muted-foreground mb-1 text-sm uppercase tracking-wider">Winner</p>
                      <p className={`font-semibold text-lg ${
                        debate?.winner === 'draw' || debate?.winner === 'Draw' ? 'text-cyber-gold' : 
                        debate?.winner ? 'text-cyber-green' : 'text-cyber-red'
                      }`}>
                        {debate?.winner ? (debate.winner === 'draw' || debate.winner === 'Draw' ? 'DRAW' : debate.winner) : 'UNDETERMINED'}
                      </p>
                    </div>
                    <div className="p-4 border border-border/30 rounded-lg bg-background/50 hover:bg-background/80 transition-colors">
                      <p className="text-muted-foreground mb-1 text-sm uppercase tracking-wider">Date</p>
                      <p className="font-semibold text-foreground">{debate?.timestamp ? new Date(debate.timestamp).toLocaleString() : 'N/A'}</p>
                    </div>
                    <div className="p-4 border border-border/30 rounded-lg bg-background/50 hover:bg-background/80 transition-colors">
                      <p className="text-muted-foreground mb-1 text-sm uppercase tracking-wider">Messages</p>
                      <p className="font-semibold text-foreground">{messages.length} total messages exchanged</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="messages" className="mt-4">
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto p-4 sm:p-6 border border-border/20 rounded-lg bg-background/30 custom-scrollbar">
                    {messages.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No messages found for this debate.</p>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <Card className={`max-w-[85%] sm:max-w-[75%] p-4 ${
                            message.sender_type === 'user'
                              ? 'bg-gradient-primary text-primary-foreground border-none shadow-md shadow-cyber-blue/10'
                              : 'bg-gradient-card border-border/50 shadow-md shadow-black/20'
                          }`}>
                            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
                            <div className={`text-xs mt-3 ${
                              message.sender_type === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            } flex justify-between items-center`}>
                              <span className="font-medium uppercase tracking-wider text-[10px]">{message.sender_type === 'user' ? 'You' : 'AI'}</span>
                              {message.timestamp && <span>{new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                            </div>
                          </Card>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="analysis" className="mt-4">
                  <div 
                    className="w-full bg-background/30 p-4 sm:p-8 rounded-lg border border-border/20"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(analysis) }} 
                  />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analysis;