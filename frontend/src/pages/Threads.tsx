import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, ArrowLeft, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Thread {
  id: number;
  title: string;
}

const Threads = () => {
  const { forumId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/forums/${forumId}/threads`)
      .then((res) => res.json())
      .then((data) => setThreads(data));
  }, [forumId]);

  const createThread = async () => {
    const title = prompt("Enter thread title:");
    if (!title) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/forums/${forumId}/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, content: "Initial post" })
      });
      if (res.ok) {
        const newThread = await res.json();
        setThreads([newThread, ...threads]);
      }
    } catch (err) {
      console.error("Failed to create thread", err);
    }
  };

  return (
    <div className="min-h-screen bg-background/95 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" className="mb-4 text-muted-foreground hover:text-foreground" onClick={() => navigate('/forums')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Forums
        </Button>

        <Card className="bg-card/50 border-border/30 shadow-xl backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl font-bold flex items-center">
              <MessageSquare className="mr-3 text-primary w-6 h-6" />
              Forum Threads
            </CardTitle>
            <Button onClick={createThread} className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> New Thread
            </Button>
          </CardHeader>
          <CardContent>
            {threads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No threads found in this forum yet.</p>
                <p className="text-sm mt-1">Be the first to start a conversation!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {threads.map((thread) => (
                  <Link to={`/threads/${thread.id}/posts`} key={thread.id}>
                    <div className="p-4 rounded-xl bg-secondary/30 hover:bg-secondary/60 border border-border/20 transition-all flex items-center justify-between group mb-3">
                      <div className="flex items-center">
                        <MessageSquare className="w-5 h-5 mr-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <h3 className="font-semibold text-lg">{thread.title}</h3>
                      </div>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        View Discussion
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Threads;
