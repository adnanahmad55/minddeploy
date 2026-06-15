import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Users, Hash, Send, ArrowLeft, UserPlus, Paperclip, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/components/ui/use-toast';

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
  content?: string;
  media_url?: string;
  timestamp: string;
  sender?: User; // For group messages
}

const Messages = () => {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [dmUsers, setDmUsers] = useState<User[]>([]);
  
  const [activeTab, setActiveTab] = useState<'groups' | 'dms'>('groups');
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [unreadDms, setUnreadDms] = useState<Record<number, number>>({});
  const [unreadGroups, setUnreadGroups] = useState<Record<number, number>>({});
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

  useEffect(() => {
    // Fetch initial groups and DM users
    const fetchSidebarData = async () => {
      try {
        const groupsRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/chat/groups/all`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (groupsRes.ok) setGroups(await groupsRes.json());

        const dmsRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/users/all`, {
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
    socketRef.current = io((import.meta.env.VITE_API_URL || 'http://localhost:8000'), {
      query: { username: user?.username || 'user' }
    });

    if (user?.id) {
      socketRef.current.emit('join_dm_room', { userId: user.id });
    }

    socketRef.current.on('new_group_message', (msg: Message) => {
      if (activeTab === 'groups' && msg.group_id === activeChatId) {
        setMessages(prev => [...prev, msg]);
      } else if (msg.sender_id !== parseInt(user?.id || '0')) {
        audioRef.current.play().catch(e => console.log(e));
        setUnreadGroups(prev => ({ ...prev, [msg.group_id]: (prev[msg.group_id] || 0) + 1 }));
      }
      // Reorder groups
      setGroups(prev => {
        const target = prev.find(g => g.id === msg.group_id);
        if (target) return [target, ...prev.filter(g => g.id !== msg.group_id)];
        return prev;
      });
    });

    socketRef.current.on('new_direct_message', (msg: Message) => {
      const isRelevantDM = (activeTab === 'dms') && (msg.sender_id === activeChatId || msg.receiver_id === activeChatId);
      if (isRelevantDM) {
        setMessages(prev => [...prev, msg]);
      } else if (msg.sender_id !== parseInt(user?.id || '0')) {
        audioRef.current.play().catch(e => console.log(e));
        setUnreadDms(prev => ({ ...prev, [msg.sender_id]: (prev[msg.sender_id] || 0) + 1 }));
      }
      
      // Reorder dms
      const otherUserId = msg.sender_id === parseInt(user?.id || '0') ? msg.receiver_id : msg.sender_id;
      setDmUsers(prev => {
        const target = prev.find(u => u.id === otherUserId);
        if (target) return [target, ...prev.filter(u => u.id !== otherUserId)];
        return prev;
      });
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [user, activeTab, activeChatId]);

  useEffect(() => {
    // Clear unreads when active chat changes
    if (activeChatId) {
      if (activeTab === 'groups') {
        setUnreadGroups(prev => {
          const newObj = { ...prev };
          delete newObj[activeChatId];
          return newObj;
        });
      } else {
        setUnreadDms(prev => {
          const newObj = { ...prev };
          delete newObj[activeChatId];
          return newObj;
        });
      }
    }

    // Fetch messages when active chat changes
    const fetchMessages = async () => {
      if (!activeChatId) return;
      
      try {
        let url = '';
        if (activeTab === 'groups') {
          // Join group room via socket to receive live updates
          socketRef.current?.emit('join_group_room', { groupId: activeChatId });
          url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/chat/groups/${activeChatId}/messages`;
        } else {
          url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/chat/dms/${activeChatId}/messages`;
        }

        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          setMessages(await res.json());
        } else if (res.status === 403 && activeTab === 'groups') {
          // Auto-join group if not a member for demo purposes
          await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/chat/groups/${activeChatId}/join`, {
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

  const handleSendMessage = (e?: React.FormEvent, mediaUrl?: string) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !mediaUrl) || !activeChatId) return;

    if (activeTab === 'groups') {
      socketRef.current?.emit('send_group_message', {
        groupId: activeChatId,
        senderId: user?.id,
        content: newMessage || '',
        media_url: mediaUrl || null
      });
    } else {
      socketRef.current?.emit('send_direct_message', {
        senderId: user?.id,
        receiverId: activeChatId,
        content: newMessage || '',
        media_url: mediaUrl || null
      });
    }
    
    setNewMessage('');
  };

  const handleFileUpload = async (file: File) => {
    if (!activeChatId) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/chat/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        handleSendMessage(undefined, data.media_url);
      } else {
        const errData = await res.json();
        toast({ title: 'Upload Failed', description: errData.detail || 'Could not upload file.', variant: 'destructive' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Upload Failed', description: 'Network error.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const createGroup = async () => {
    const name = prompt("Enter new group name:");
    if (!name) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/chat/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, description: "A new group" })
      });
      if (res.ok) {
        const newGroup = await res.json();
        setGroups([newGroup, ...groups]);
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  const addUserToGroup = async () => {
    if (!activeChatId) return;
    const username = prompt("Enter the exact username to add to this group:");
    if (!username) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/chat/groups/${activeChatId}/add_user?username=${encodeURIComponent(username)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        toast({ title: 'Success', description: `${username} added to the group!` });
      } else {
        const errData = await res.json();
        toast({ title: 'Error', description: errData.detail || 'Failed to add user.', variant: 'destructive' });
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

  const renderMedia = (url: string) => {
    const isVideo = url.match(/\.(mp4|webm|ogg)$/i) || url.includes('/video/upload/');
    if (isVideo) {
      return (
        <video controls className="max-w-full rounded-md mt-2 max-h-64">
          <source src={url} />
          Your browser does not support the video tag.
        </video>
      );
    }
    return <img src={url} alt="media" className="max-w-full rounded-md mt-2 max-h-64 object-cover" />;
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
                  className={`w-full flex justify-between items-center p-2 rounded-md transition-colors ${activeChatId === g.id ? 'bg-primary/20 text-primary' : 'hover:bg-muted'}`}
                >
                  <div className="flex items-center truncate">
                    <Hash className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="truncate">{g.name}</span>
                  </div>
                  {unreadGroups[g.id] > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {unreadGroups[g.id]}
                    </span>
                  )}
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
                  className={`w-full flex justify-between items-center p-2 rounded-md transition-colors ${activeChatId === u.id ? 'bg-primary/20 text-primary' : 'hover:bg-muted'}`}
                >
                  <div className="flex items-center truncate">
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center mr-2 text-xs">
                      {u.username[0].toUpperCase()}
                    </div>
                    <span className="truncate">{u.username}</span>
                  </div>
                  {unreadDms[u.id] > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {unreadDms[u.id]}
                    </span>
                  )}
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
      <div 
        className="flex-1 flex flex-col bg-background/50 relative"
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {activeChatId ? (
          <>
            <CardHeader className="border-b border-border/30 bg-card/50 py-4">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center">
                  {activeTab === 'groups' ? (
                    <><Hash className="w-5 h-5 mr-2 text-primary" /> {groups.find(g => g.id === activeChatId)?.name}</>
                  ) : (
                    <><div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center mr-3 text-sm">{dmUsers.find(u => u.id === activeChatId)?.username[0].toUpperCase()}</div> {dmUsers.find(u => u.id === activeChatId)?.username}</>
                  )}
                </div>
                {activeTab === 'groups' && (
                  <Button variant="ghost" size="sm" onClick={addUserToGroup} className="h-8">
                    <UserPlus className="w-4 h-4 mr-2" /> Add User
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg, idx) => {
                  const isMine = msg.sender_id === parseInt(user?.id || '0');
                  return (
                    <div key={idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      {!isMine && activeTab === 'groups' && msg.sender && (
                        <span className="text-xs text-muted-foreground ml-1 mb-1">{msg.sender.username}</span>
                      )}
                      <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${isMine ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary text-secondary-foreground rounded-tl-sm'}`}>
                        {msg.content && <p>{msg.content}</p>}
                        {msg.media_url && renderMedia(msg.media_url)}
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

            <div className="p-4 bg-card/50 border-t border-border/30 relative">
              <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }} 
                  accept="image/*,video/*"
                />
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                </Button>
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message ${activeTab === 'groups' ? 'group' : 'user'}... (or drag & drop media)`}
                  className="flex-1 bg-background"
                  disabled={isUploading}
                />
                <Button type="submit" size="icon" disabled={(!newMessage.trim() && !isUploading) || isUploading}>
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
