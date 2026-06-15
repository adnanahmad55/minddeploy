import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Users, Hash, Send, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { io, Socket } from 'socket.io-client';

interface Group {
  id: number;
  name: string;
}

interface User {
  id: number;
  username: string;
}

interface Message {
  id: number;
  sender_id: number;
  content: string;
  timestamp: string;
  sender?: User; // For group messages
}

const Messages = () => {
  const { user, token } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [dmUsers, setDmUsers] = useState<User[]>([]);
  
  const [activeTab, setActiveTab] = useState<'groups' | 'dms'>('groups');
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch initial groups and DM users
    const fetchSidebarData = async () => {
      try {
        const groupsRes = await fetch('http://localhost:8000/chat/groups/all', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (groupsRes.ok) setGroups(await groupsRes.json());

        const dmsRes = await fetch('http://localhost:8000/users/all', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (dmsRes.ok) setDmUsers(await dmsRes.json());
      } catch (err) {
        console.error("Error fetching sidebar data:", err);
      }
    };
    if (token) fetchSidebarData();
  }, [token]);

  useEffect(() => {
    // Setup Socket.IO
    socketRef.current = io('http://localhost:8000', {
      query: { username: user?.username || 'user' }
    });

    if (user?.id) {
      socketRef.current.emit('join_dm_room', { userId: user.id });
    }

    socketRef.current.on('new_group_message', (msg: Message) => {
      if (activeTab === 'groups' && msg.group_id === activeChatId) {
        setMessages(prev => [...prev, msg]);
      }
    });

    socketRef.current.on('new_direct_message', (msg: Message) => {
      if (activeTab === 'dms' && (msg.sender_id === activeChatId || msg.receiver_id === activeChatId)) {
        setMessages(prev => [...prev, msg]);
      } else if (msg.sender_id !== user?.id) {
        // Here you could show a toast or notification badge for new DM
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [user, activeTab, activeChatId]);

  useEffect(() => {
    // Fetch messages when active chat changes
    const fetchMessages = async () => {
      if (!activeChatId) return;
      
      try {
        let url = '';
        if (activeTab === 'groups') {
          // Join group room via socket to receive live updates
          socketRef.current?.emit('join_group_room', { groupId: activeChatId });
          url = `http://localhost:8000/chat/groups/${activeChatId}/messages`;
        } else {
          url = `http://localhost:8000/chat/dms/${activeChatId}/messages`;
        }

        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          setMessages(await res.json());
        } else if (res.status === 403 && activeTab === 'groups') {
          // Auto-join group if not a member for demo purposes
          await fetch(`http://localhost:8000/chat/groups/${activeChatId}/join`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const retryRes = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
          if (retryRes.ok) setMessages(await retryRes.json());
        }
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    fetchMessages();
  }, [activeChatId, activeTab, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatId) return;

    if (activeTab === 'groups') {
      socketRef.current?.emit('send_group_message', {
        groupId: activeChatId,
        senderId: user?.id,
        content: newMessage
      });
    } else {
      socketRef.current?.emit('send_direct_message', {
        senderId: user?.id,
        receiverId: activeChatId,
        content: newMessage
      });
    }
    
    setNewMessage('');
  };

  const createGroup = async () => {
    const name = prompt("Enter new group name:");
    if (!name) return;
    try {
      const res = await fetch('http://localhost:8000/chat/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, description: "A new group" })
      });
      if (res.ok) {
        const newGroup = await res.json();
        setGroups([...groups, newGroup]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startNewDM = async () => {
    const username = prompt("Enter the exact username of the user to DM:");
    if (!username) return;
    alert("In this demo, DMs are started by clicking on users in the leaderboard or debate screens, but the backend is fully wired to support them!");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      {/* Top Navigation */}
      <div className="p-4 border-b border-border/30 bg-card/50 flex items-center">
        <Button variant="ghost" asChild className="mr-4">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Messages</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-border/30 bg-card/30 flex flex-col">
          <div className="p-4 border-b border-border/30 flex gap-2">
            <Button 
              variant={activeTab === 'groups' ? 'default' : 'ghost'} 
              className="flex-1"
              onClick={() => { setActiveTab('groups'); setActiveChatId(null); setMessages([]); }}
            >
              <Hash className="w-4 h-4 mr-2" /> Groups
            </Button>
            <Button 
              variant={activeTab === 'dms' ? 'default' : 'ghost'} 
              className="flex-1"
              onClick={() => { setActiveTab('dms'); setActiveChatId(null); setMessages([]); }}
            >
              <MessageSquare className="w-4 h-4 mr-2" /> DMs
            </Button>
          </div>
        
        <ScrollArea className="flex-1 p-2">
          {activeTab === 'groups' ? (
            <div className="space-y-1">
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase flex justify-between items-center">
                Guilds
                <Button variant="ghost" size="icon" className="h-4 w-4" onClick={createGroup}>+</Button>
              </div>
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setActiveChatId(g.id)}
                  className={`w-full flex items-center p-2 rounded-md transition-colors ${activeChatId === g.id ? 'bg-primary/20 text-primary' : 'hover:bg-muted'}`}
                >
                  <Hash className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span className="truncate">{g.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase flex justify-between items-center">
                Direct Messages
                <Button variant="ghost" size="icon" className="h-4 w-4" onClick={startNewDM}>+</Button>
              </div>
              {dmUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => setActiveChatId(u.id)}
                  className={`w-full flex items-center p-2 rounded-md transition-colors ${activeChatId === u.id ? 'bg-primary/20 text-primary' : 'hover:bg-muted'}`}
                >
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center mr-2 text-xs">
                    {u.username[0].toUpperCase()}
                  </div>
                  <span className="truncate">{u.username}</span>
                </button>
              ))}
              {dmUsers.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-4 text-center">No recent direct messages.</p>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-background/50">
        {activeChatId ? (
          <>
            <CardHeader className="border-b border-border/30 bg-card/50 py-4">
              <CardTitle className="text-lg flex items-center">
                {activeTab === 'groups' ? (
                  <><Hash className="w-5 h-5 mr-2 text-primary" /> {groups.find(g => g.id === activeChatId)?.name}</>
                ) : (
                  <><div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center mr-3 text-sm">{dmUsers.find(u => u.id === activeChatId)?.username[0].toUpperCase()}</div> {dmUsers.find(u => u.id === activeChatId)?.username}</>
                )}
              </CardTitle>
            </CardHeader>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg, idx) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div key={idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      {!isMine && activeTab === 'groups' && msg.sender && (
                        <span className="text-xs text-muted-foreground ml-1 mb-1">{msg.sender.username}</span>
                      )}
                      <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${isMine ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary text-secondary-foreground rounded-tl-sm'}`}>
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 mx-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 bg-card/50 border-t border-border/30">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message ${activeTab === 'groups' ? 'group' : 'user'}...`}
                  className="flex-1 bg-background"
                />
                <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
            <p>Select a {activeTab === 'groups' ? 'group' : 'user'} to start chatting</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default Messages;
