import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { User, Sword, ArrowLeft } from 'lucide-react';
import io from 'socket.io-client';

interface OnlineUser {
  id: string;
  username: string;
  elo: number;
  is_ai?: boolean;
}

const socket = io('http://127.0.0.1:8000');

const Matchmaking = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [customTopic, setCustomTopic] = useState('');
  const [customTime, setCustomTime] = useState(900);
  const [aiPersonality, setAiPersonality] = useState('Neutral');

  useEffect(() => {
    if (!user) {
      toast({
        title: "Not Authenticated",
        description: "Please log in to use matchmaking.",
        variant: "destructive",
      });
      navigate('/login');
      return;
    }

    socket.emit('user_online', { userId: user.id, username: user.username, elo: user.elo });

    socket.on('online_users', (users: OnlineUser[]) => {
      setOnlineUsers(users.filter(u => u.id !== String(user.id) && u.id !== '0'));
    });

    socket.on('challenge_received', ({ challenger, topic }) => {
      toast({
        title: `Debate Challenge from ${challenger.username}`,
        description: `Topic: ${topic}. Do you accept?`,
        action: (
          <>
            <Button onClick={() => acceptChallenge(challenger, topic)}>Accept</Button>
            <Button variant="ghost" onClick={() => declineChallenge(challenger)}>Decline</Button>
          </>
        ),
      });
    });

    socket.on('challenge_accepted', ({ opponent, topic, debateId, timeLimit }) => {
      console.log(`Challenge accepted for Debate ID: ${debateId}`);
      navigate('/chatroom', { state: { opponent, topic, debateId, timeLimit: timeLimit || customTime } });
    });

    socket.on('challenge_declined', ({ opponentId }) => {
      const opponentUser = onlineUsers.find(u => u.id === opponentId);
      if (opponentUser) {
        toast({
          title: "Challenge Declined",
          description: `${opponentUser.username} has declined your challenge.`,
          variant: "destructive"
        });
      }
    });

    return () => {
      socket.off('online_users');
      socket.off('challenge_received');
      socket.off('challenge_accepted');
      socket.off('challenge_declined');
      if (user) {
        socket.emit('user_offline', { userId: user.id });
      }
    };
  }, [user, navigate]); // <-- FIXED: `onlineUsers` dependency removed

  const startAIDebate = async () => {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in to challenge opponents.", variant: "destructive" });
      return;
    }

    const topic = customTopic.trim() || getRandomTopic();
    const opponent = { id: '1', username: `AI Bot (${aiPersonality})`, elo: 1200, is_ai: true };
    toast({ title: `Starting debate with AI Bot`, description: 'Generating initial arguments...', });

    try {
        const response = await fetch('http://127.0.0.1:8000/debate/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({
                player1_id: parseInt(opponent.id, 10),
                player2_id: parseInt(user.id, 10),
                topic: topic,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status}, detail: ${errorData.detail || 'Unknown error'}`);
        }

        const data = await response.json();
        const debateId = data.id;

        console.log("AI Debate created with ID:", debateId);
        navigate('/debate', { state: { opponent, topic, debateId, timeLimit: customTime, personality: aiPersonality } });

    } catch (error) {
        console.error('Error starting AI debate:', error);
        toast({
            title: 'Error Starting AI Debate',
            description: `Could not start the debate. ${error instanceof Error ? error.message : 'Please try again.'}`,
            variant: 'destructive',
        });
    }
  };

  const handleChallenge = (opponent: OnlineUser) => {
    if (!user) { return; }
    const topic = customTopic.trim() || getRandomTopic();
    const timeLimit = customTime;
    
    if (opponent.id === 'human') {
        const humanOpponent = onlineUsers.find(onlineUser => onlineUser.id !== String(user.id));
        if (humanOpponent) {
            socket.emit('challenge_user', { challenger: user, opponentId: humanOpponent.id, topic, timeLimit });
            toast({ title: `Challenge sent to ${humanOpponent.username}`, description: 'Waiting for them to accept...', });
        } else {
            toast({ title: 'No human opponents available', description: 'Please try again later.', variant: 'destructive', });
        }
    } else {
        socket.emit('challenge_user', { challenger: user, opponentId: opponent.id, topic, timeLimit });
        toast({ title: `Challenge sent to ${opponent.username}`, description: 'Waiting for them to accept...', });
    }
  };

  const acceptChallenge = async (challenger: OnlineUser, topic: string) => {
    if (!user) { return; }
    try {
        const player1Id = parseInt(challenger.id, 10);
        const player2Id = parseInt(user.id, 10);
        const response = await fetch('http://127.0.0.1:8000/debate/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}`, },
            body: JSON.stringify({ player1_id: player1Id, player2_id: player2Id, topic: topic, }),
        });
        if (!response.ok) { 
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status}, detail: ${errorData.detail || 'Unknown error'}`);
        }
        const data = await response.json();
        const debateId = data.id;
        console.log("Debate created with ID:", debateId);
        socket.emit('accept_challenge', { challengerId: challenger.id, opponent: user, topic, debateId, timeLimit: customTime });
        navigate('/chatroom', { state: { opponent: challenger, topic, debateId, timeLimit: customTime } });
    } catch (error) {
        console.error('Error creating debate:', error);
        toast({ title: 'Error Accepting Challenge', description: `Could not start the debate. ${error instanceof Error ? error.message : 'Please try again.'}`, variant: 'destructive', });
    }
  };

  const declineChallenge = (challenger: OnlineUser) => {
    socket.emit('decline_challenge', { challengerId: challenger.id });
    toast({ title: "Challenge Declined", description: `You declined the challenge from ${challenger.username}.`, });
  };

  const getRandomTopic = () => {
    const topics = [
      "Artificial Intelligence will make human intelligence obsolete",
      "Social media does more harm than good for society",
      "Privacy is more important than security in the digital age",
      "Universal basic income is a viable solution to poverty",
      "Cryptocurrencies will revolutionize global finance",
      "Genetic engineering will solve humanity's greatest challenges",
      "Formal education is becoming obsolete",
      "All forms of animal agriculture should be banned",
      "Governments should heavily regulate artificial intelligence development",
      "Space exploration is a waste of resources",
    ];
    return topics[Math.floor(Math.random() * topics.length)];
  };

  return (
    <div className="min-h-screen bg-gradient-bg text-foreground p-8">
      <header className="border-b border-border/50 bg-card/20 backdrop-blur-sm mb-8">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>
      <Card className="max-w-2xl mx-auto bg-card/50 border-border/30">
        <CardHeader>
          <CardTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent flex items-center">
            <User className="mr-2" />
            Find an Opponent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-4 bg-background/50 p-4 rounded-lg border border-border/30">
              <h3 className="text-lg font-semibold mb-2">Debate Settings</h3>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Custom Topic (optional)</label>
                <Input 
                  placeholder="Leave blank for random topic" 
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  className="bg-input/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Duration</label>
                  <select 
                    value={customTime}
                    onChange={(e) => setCustomTime(Number(e.target.value))}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-input/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value={180}>3 Minutes</option>
                    <option value={300}>5 Minutes</option>
                    <option value={600}>10 Minutes</option>
                    <option value={900}>15 Minutes</option>
                    <option value={1800}>30 Minutes</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">AI Personality</label>
                  <select 
                    value={aiPersonality}
                    onChange={(e) => setAiPersonality(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-input/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="Neutral">Neutral</option>
                    <option value="Aggressive">Aggressive</option>
                    <option value="Socratic">Socratic</option>
                    <option value="Devil's Advocate">Devil's Advocate</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
            <Button onClick={startAIDebate} size="lg" className="w-full">
              <Sword className="mr-2 h-4 w-4" />
              Challenge AI Bot
            </Button>
            <Button onClick={() => handleChallenge({ id: 'human', username: 'Human', elo: 1200, is_ai: false })} size="lg" className="w-full">
              <Sword className="mr-2 h-4 w-4" />
              Challenge Random Human
            </Button>
            
            {onlineUsers
              .filter((onlineUser) => onlineUser.id !== String(user?.id))
              .map((onlineUser) => (
                <div
                  key={onlineUser.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/30"
                >
                  <div>
                    <p className="font-semibold">{onlineUser.username}</p>
                    <p className="text-sm text-muted-foreground">{onlineUser.elo} ELO</p>
                  </div>
                  <Button onClick={() => handleChallenge({ ...onlineUser, is_ai: false })} size="sm">
                    <Sword className="mr-2 h-4 w-4" />
                    Challenge
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Matchmaking;