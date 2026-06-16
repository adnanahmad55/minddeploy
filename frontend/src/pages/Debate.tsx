import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  Brain,
  Send,
  Clock,
  Users,
  Bot,
  ArrowLeft,
  Shield,
  Sword
} from 'lucide-react';
import io, { Socket } from 'socket.io-client';

interface Message {
  id: string;
  content: string;
  sender_id: number | null;
  sender_type: 'user' | 'ai';
  debate_id: number;
  timestamp: Date;
}

interface Opponent {
  id: string;
  username: string;
  elo: number;
  is_ai: boolean;
}

const Debate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState<number>(location.state?.timeLimit || 900);
  const [isDebateActive, setIsDebateActive] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const opponent: Opponent = location.state?.opponent || {
    id: '0',
    username: 'AI Bot',
    elo: 1200,
    is_ai: true
  };
  const topic: string = location.state?.topic || 'The role of AI in society';
  const personality: string = location.state?.personality || 'Neutral';
  const timeLimitMs: number = location.state?.timeLimit || 900;
  const debateId = typeof location.state?.debateId === 'number'
    ? location.state.debateId
    : parseInt(String(location.state?.debateId), 10);

  const socketRef = useRef<Socket | null>(null);
  const messagesRef = useRef(messages);
  const timeLeftRef = useRef(timeLeft);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  useEffect(() => {
    if (isNaN(debateId) || !debateId || !user) {
      toast({ title: "Debate ID Missing", description: "Could not find a valid debate. Please start a new one.", variant: "destructive" });
      navigate('/matchmaking');
      return;
    }

    if (!socketRef.current) {
      console.log("Initializing new socket instance for Debate ID:", debateId, "User ID:", user.id);
      socketRef.current = io((import.meta.env.VITE_API_URL || 'http://localhost:8000'), {
        query: {
          debateId: debateId,
          userId: parseInt(user.id, 10)
        }
      });

      socketRef.current.on('connect', () => {
        console.log('Connected to socket server');
        socketRef.current?.emit('join_debate_room', { debateId: debateId, userId: parseInt(user.id, 10) });
      });

      socketRef.current.on('new_message', (message: any) => {
        console.log('Received new message:', message);
        setMessages(prev => {
            // Prevent duplicates if any
            if (prev.find(m => String(m.id) === String(message.id))) return prev;
            return [...prev, {
                ...message,
                id: String(message.id),
                sender_id: message.sender_id !== null ? Number(message.sender_id) : null,
                timestamp: new Date(message.timestamp)
            }];
        });
      });

      socketRef.current.on('ai_typing', (data) => {
        if (data.debateId === debateId) {
          setIsTyping(data.is_typing);
        }
      });

      // --- REMOVED THE navigation from here, it's now in the endDebate function ---
      socketRef.current.on('debate_ended', (data) => {
        console.log('Debate ended event received. Navigating to Result.', data);
        navigate('/Result', {
          state: {
            opponent,
            topic,
            messages: messagesRef.current,
            duration: timeLimitMs - timeLeftRef.current,
            winner: data.winner,
            debateId: debateId,
            realResult: data // Pass the entire real result from backend
          }
        });
      });
      // --- END REMOVED ---
    }

    return () => {
      if (socketRef.current) {
        console.log("Cleaning up socket listeners and disconnecting.");
        socketRef.current.off('connect');
        socketRef.current.off('new_message');
        socketRef.current.off('ai_typing');
        socketRef.current.off('debate_ended');
        socketRef.current.emit('leave_debate_room', { debateId: debateId, userId: user ? parseInt(user.id, 10) : undefined });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [debateId, user, navigate, opponent, topic]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isNaN(debateId) || !debateId) return;

    const fetchInitialData = async () => {
      try {
        const [msgResponse, debateResponse] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/debate/${debateId}/messages`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, },
          }),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/debate/${debateId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, },
          })
        ]);

        if (debateResponse.ok) {
          const debateData = await debateResponse.json();
          if (debateData.winner !== null) {
             toast({ title: "Debate Already Finished", description: "This debate has already concluded." });
             navigate('/Result', {
               state: {
                 opponent,
                 topic,
                 messages: messagesRef.current,
                 duration: timeLimitMs,
                 winner: debateData.winner,
                 debateId: debateId
               }
             });
             return;
          }
        }

        if (msgResponse.ok) {
          const data = await msgResponse.json();
          setMessages(data.map((m: any) => ({
              ...m,
              id: String(m.id),
              sender_id: m.sender_id !== null ? Number(m.sender_id) : null,
              timestamp: new Date(m.timestamp)
          })));
          console.log("Initial messages fetched:", data);
        }
      } catch (error) {
        console.error("Error fetching initial debate data:", error);
        toast({ title: "Error loading debate", description: "Could not fetch debate data.", variant: "destructive", });
      }
    };
    fetchInitialData();
  }, [debateId, navigate, opponent, topic, timeLimitMs]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsDebateActive(false);
          toast({ title: "Debate finished!", description: "Time's up! Calculating results...", });
          clearInterval(timer);
          socketRef.current?.emit('end_debate', { debate_id: debateId, current_messages: messagesRef.current });
          // Navigation is handled directly by the endDebate function
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [debateId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || !isDebateActive || !user || isNaN(debateId) || !debateId || !socketRef.current) return;

    const messageData = {
      content: currentMessage,
      sender_type: 'user',
      sender_id: parseInt(String(user.id), 10)
    };

    const newMessage: Message = {
      id: Date.now().toString(),
      content: currentMessage,
      sender_type: 'user',
      sender_id: parseInt(String(user.id), 10),
      debate_id: debateId,
      timestamp: new Date(),
    };
    setCurrentMessage('');

    if (opponent.is_ai) {
      console.log("Sending message to AI debate endpoint...");
      try {
        const url = new URL(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/ai-debate/${debateId}/${encodeURIComponent(topic)}`);
        url.searchParams.append('personality', personality);
        
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(messageData),
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response from AI debate API:", response.status, errorText);
          toast({
            title: "Error",
            description: `Failed to send message: ${response.status} ${errorText}`,
            variant: "destructive",
          });
          return;
        }
        
        const aiMessage = await response.json();
        // Socket will handle adding the AI message and User message to state
      } catch (error) {
        console.error("Fetch error sending message to AI debate API:", error);
        toast({
          title: "Network Error",
          description: "Failed to send message due to network error.",
          variant: "destructive",
        });
      }
    } else {
      console.log("Sending message to human opponent via socket...");
      socketRef.current?.emit('send_message_to_human', {
        debateId: debateId,
        senderId: parseInt(String(user.id), 10),
        content: currentMessage,
        senderType: 'user'
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const endDebate = () => {
    setIsDebateActive(false);
    toast({ title: "Debate ended by user", description: "Evaluating debate... Please wait.", });
    // Emit end_debate event to backend, using messagesRef.current for the latest messages state
    socketRef.current?.emit('end_debate', { debate_id: debateId, current_messages: messagesRef.current });
  };

  const forfeit = () => {
    toast({
      title: "Debate forfeited",
      description: "You have left the debate arena.",
      variant: "destructive",
    });
    socketRef.current?.emit('forfeit_debate', { debate_id: debateId, user_id: user?.id ? parseInt(String(user.id), 10) : undefined });
    navigate('/dashboard');
  };

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col relative selection:bg-cyber-red/30">
      {/* Abstract Arena Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyber-red/10 via-background to-background"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay"></div>
      </div>

      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/60 shadow-[0_4px_30px_rgba(0,0,0,0.5)] border-b border-white/5">
        <header className="relative z-10 border-b border-white/5 bg-black/20">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={forfeit}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <div className="flex items-center space-x-3">
                <Brain className="h-6 w-6 text-cyber-red" />
                <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Neural Battle
                </h1>
              </div>

              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-cyber-gold" />
                <span className={`font-mono text-lg ${timeLeft < 60 ? 'text-cyber-red' : 'text-cyber-gold'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>

            <div className="mt-3 text-center">
              <p className="text-sm text-muted-foreground">Debate Topic:</p>
              <p className="text-lg font-semibold text-foreground">{topic}</p>
            </div>
          </div>
        </header>

        <div className="border-b border-white/5 bg-black/40 backdrop-blur-md">
        <div className="container mx-auto px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            <div className="flex items-center space-x-3 w-1/3">
              <div className="p-1.5 sm:p-2 bg-cyber-blue/10 rounded-lg shadow-[0_0_10px_rgba(0,100,255,0.2)]">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-cyber-blue" />
              </div>
              <div className="truncate">
                <p className="font-semibold text-foreground text-sm sm:text-base truncate">{user?.username}</p>
                <p className="text-xs sm:text-sm text-cyber-blue/80 font-mono">{user?.elo} ELO</p>
              </div>
            </div>

            <div className="text-center w-1/3 flex flex-col items-center">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-cyber-blue/20 to-cyber-red/20 flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <span className="text-xs sm:text-sm font-black italic tracking-widest bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent">VS</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 w-1/3 justify-end">
              <div className="text-right truncate">
                <p className="font-semibold text-foreground text-sm sm:text-base truncate">{opponent.username}</p>
                <p className="text-xs sm:text-sm text-cyber-red/80 font-mono">{opponent.elo} ELO</p>
              </div>
              <div className={`p-1.5 sm:p-2 rounded-lg shadow-[0_0_10px_rgba(255,0,0,0.2)] ${opponent.is_ai ? 'bg-cyber-gold/10' : 'bg-cyber-red/10'}`}>
                {opponent.is_ai ? (
                  <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-cyber-gold" />
                ) : (
                  <Sword className="h-4 w-4 sm:h-5 sm:w-5 text-cyber-red" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      <div className="flex-1 overflow-hidden relative z-0">
        <div className="h-full flex flex-col container mx-auto px-4 py-4 max-w-4xl">
          <div className="flex-1 overflow-y-auto space-y-6 mb-4 pr-2 custom-scrollbar">
            {messages.length === 0 && (
              <div className="text-center py-16 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,255,255,0.05)] border border-white/10 relative overflow-hidden">
                   <div className="absolute inset-0 bg-cyber-blue/20 blur-xl"></div>
                   <Brain className="h-10 w-10 text-cyber-blue relative z-10 animate-pulse" />
                </div>
                <p className="text-foreground/80 font-medium text-lg tracking-wide">
                  The Neural Arena Awaits
                </p>
                <p className="text-muted-foreground text-sm mt-2">
                  Launch your opening argument.
                </p>
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.sender_type === 'user';
              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <Card className={`max-w-[85%] sm:max-w-[75%] p-4 border-none shadow-lg backdrop-blur-md relative overflow-hidden ${
                    isUser
                      ? 'bg-gradient-to-br from-cyber-blue/90 to-blue-600 text-white rounded-2xl rounded-tr-sm'
                      : 'bg-white/10 text-foreground border border-white/10 rounded-2xl rounded-tl-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]'
                  }`}>
                    {/* Subtle inner glow for AI messages */}
                    {!isUser && <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>}
                    
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap relative z-10">{message.content}</p>
                    <p className={`text-[10px] mt-3 font-mono tracking-wider relative z-10 flex justify-between items-center ${
                      isUser ? 'text-white/70' : 'text-muted-foreground'
                    }`}>
                      <span className="uppercase">{isUser ? 'You' : opponent.username}</span>
                      <span>{new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </p>
                  </Card>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex justify-start">
                <Card className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-sm backdrop-blur-md flex items-center h-[52px]">
                  <div className="flex space-x-1.5 items-center justify-center">
                    <div className="w-2 h-2 bg-cyber-red rounded-full animate-bounce shadow-[0_0_5px_rgba(255,0,0,0.8)]"></div>
                    <div className="w-2 h-2 bg-cyber-red rounded-full animate-bounce shadow-[0_0_5px_rgba(255,0,0,0.8)]" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-cyber-red rounded-full animate-bounce shadow-[0_0_5px_rgba(255,0,0,0.8)]" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="pt-4 border-t border-white/10">
            <div className="flex items-end gap-3 bg-white/5 p-2 rounded-2xl border border-white/10 backdrop-blur-md focus-within:border-cyber-blue/50 focus-within:bg-white/10 transition-all">
              <textarea
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isDebateActive ? "Formulate your argument..." : "Debate has ended."}
                disabled={!isDebateActive}
                className="flex-1 bg-transparent border-none resize-none min-h-[44px] max-h-32 px-3 py-3 text-sm focus:outline-none focus:ring-0 custom-scrollbar text-foreground placeholder:text-muted-foreground/70"
                rows={1}
                style={{ height: "auto" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                }}
              />
              <Button
                onClick={sendMessage}
                disabled={!currentMessage.trim() || !isDebateActive}
                size="icon"
                className={`h-11 w-11 rounded-xl mb-0.5 shrink-0 transition-all ${
                  currentMessage.trim() && isDebateActive 
                  ? 'bg-cyber-blue hover:bg-cyber-blue/90 text-white shadow-[0_0_15px_rgba(0,100,255,0.4)]' 
                  : 'bg-white/10 text-muted-foreground'
                }`}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>

            {isDebateActive && (
              <div className="flex justify-between items-center mt-4 px-2">
                <p className="text-[11px] text-muted-foreground font-medium tracking-wide">
                  ENTER <span className="opacity-50 mx-1">to send</span> SHIFT+ENTER <span className="opacity-50 mx-1">for new line</span>
                </p>
                <Button variant="outline" size="sm" onClick={endDebate} className="border-cyber-red/30 text-cyber-red hover:bg-cyber-red/10 hover:text-cyber-red">
                  Concede & End
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Debate;