import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Users, Hash, Send, ArrowLeft, UserPlus, Paperclip, Loader2, Mic, Square, Smile, SmilePlus, MoreVertical, Edit2, Trash2, Sticker, Phone, Video, PhoneOff } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import CallOverlay from '@/components/ui/CallOverlay';

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
  is_edited?: boolean;
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
  
  // Voice Recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  // Giphy
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<string[]>([]);
  const [isGifPopoverOpen, setIsGifPopoverOpen] = useState(false);
  
  // WebRTC
  const [incomingCall, setIncomingCall] = useState<{ callerId: number, callerUsername: string, offer: any, callType: 'audio'|'video' } | null>(null);
  const [callState, setCallState] = useState<'idle' | 'calling' | 'active'>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerUsername, setPeerUsername] = useState('');
  const [callType, setCallType] = useState<'audio'|'video'>('audio');
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const ringtone = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3'));
  
  // Emoji
  const [isEmojiPopoverOpen, setIsEmojiPopoverOpen] = useState(false);

  // Edit Message
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  
  // Members Modal
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchGroupMembers = async () => {
    if (!activeChatId || activeTab !== 'groups') return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/chat/groups/${activeChatId}/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGroupMembers(data);
        const myMember = data.find((m: any) => m.user.id === parseInt(user?.id || '0'));
        setIsAdmin(myMember?.role === 'admin');
      }
    } catch (err) {
      console.error("Error fetching members", err);
    }
  };

  const removeMember = async (userId: number) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/chat/groups/${activeChatId}/remove_user/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchGroupMembers();
    } catch (err) { console.error(err); }
  };

  const promoteMember = async (userId: number) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/chat/groups/${activeChatId}/promote_user/${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchGroupMembers();
    } catch (err) { console.error(err); }
  };
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

  useEffect(() => {
    // Fetch initial groups and DM users
    const fetchSidebarData = async () => {
      try {
        const groupsRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/chat/groups`, {
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
    const fetchGifs = async () => {
      try {
        const apiKey = import.meta.env.VITE_GIPHY_API_KEY || 'lR7L81vCg2tK1G1J3yv05K57T2L2bB1O';
        let endpoint = `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=12`;
        if (gifSearch.trim()) {
          endpoint = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(gifSearch)}&limit=12`;
        }
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          setGifs(data.data.map((g: any) => g.images.fixed_height.url));
        }
      } catch (err) {
        console.error("Giphy error", err);
      }
    };
    if (isGifPopoverOpen) {
      const timer = setTimeout(fetchGifs, 300);
      return () => clearTimeout(timer);
    }
  }, [gifSearch, isGifPopoverOpen]);

  useEffect(() => {
    // Setup Socket.IO
    socketRef.current = io((import.meta.env.VITE_API_URL || 'http://localhost:8000'), {
      query: { username: user?.username || 'user' }
    });

    if (user?.id) {
      socketRef.current.emit('join_dm_room', { userId: user.id });
    }

    socketRef.current.on('new_group_message', (msg: Message) => {
      if (activeTab === 'groups' && (msg as any).group_id === activeChatId) {
        setMessages(prev => [...prev, msg]);
      } else if (msg.sender_id !== parseInt(user?.id || '0')) {
        audioRef.current.play().catch(e => console.log(e));
        setUnreadGroups(prev => ({ ...prev, [(msg as any).group_id]: (prev[(msg as any).group_id] || 0) + 1 }));
      }
      setGroups(prev => {
        const target = prev.find(g => g.id === (msg as any).group_id);
        if (target) return [target, ...prev.filter(g => g.id !== (msg as any).group_id)];
        return prev;
      });
    });

    socketRef.current.on('new_direct_message', (msg: Message) => {
      const isRelevantDM = (activeTab === 'dms') && (msg.sender_id === activeChatId || (msg as any).receiver_id === activeChatId);
      if (isRelevantDM) {
        setMessages(prev => [...prev, msg]);
      } else if (msg.sender_id !== parseInt(user?.id || '0')) {
        audioRef.current.play().catch(e => console.log(e));
        setUnreadDms(prev => ({ ...prev, [msg.sender_id]: (prev[msg.sender_id] || 0) + 1 }));
      }
      const otherUserId = msg.sender_id === parseInt(user?.id || '0') ? (msg as any).receiver_id : msg.sender_id;
      setDmUsers(prev => {
        const target = prev.find(u => u.id === otherUserId);
        if (target) return [target, ...prev.filter(u => u.id !== otherUserId)];
        return prev;
      });
    });

    socketRef.current.on('message_edited', (data: any) => {
      setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, content: data.newContent, is_edited: true } : m));
    });

    socketRef.current.on('message_deleted', (data: any) => {
      setMessages(prev => prev.filter(m => m.id !== data.messageId));
    });

    socketRef.current.on('webrtc_offer', async (data: any) => {
      if (callState !== 'idle') {
        // Automatically reject if already in a call
        socketRef.current?.emit('webrtc_reject_call', { targetUserId: data.callerId });
        return;
      }
      setIncomingCall(data);
      ringtone.current.loop = true;
      ringtone.current.play().catch(e => console.log(e));
    });

    socketRef.current.on('webrtc_answer', async (data: any) => {
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        setCallState('active');
      }
    });

    socketRef.current.on('webrtc_ice_candidate', async (data: any) => {
      if (peerConnection.current && data.candidate) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    socketRef.current.on('webrtc_reject_call', () => {
      toast({ title: 'Call Rejected', description: 'The user declined your call.', variant: 'destructive' });
      endCall(true);
    });

    socketRef.current.on('webrtc_end_call', () => {
      toast({ title: 'Call Ended', description: 'The remote user ended the call.' });
      endCall(true);
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
    setIsGifPopoverOpen(false);
  };

  const submitEdit = (messageId: number) => {
    if (!editContent.trim()) return;
    socketRef.current?.emit('edit_message', {
      messageId,
      type: activeTab === 'groups' ? 'group' : 'direct',
      newContent: editContent,
      senderId: user?.id
    });
    setEditingMessageId(null);
  };

  const deleteMessage = (messageId: number) => {
    if (confirm("Delete this message?")) {
      socketRef.current?.emit('delete_message', {
        messageId,
        type: activeTab === 'groups' ? 'group' : 'direct',
        senderId: user?.id
      });
    }
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
        let finalUrl = data.media_url;
        if (file.type.startsWith('audio/')) {
          finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'type=audio';
        }
        handleSendMessage(undefined, finalUrl);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };
      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const file = new File([audioBlob], 'voice_message.webm', { type: 'audio/webm' });
        handleFileUpload(file);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      toast({ title: 'Microphone Error', description: 'Could not access microphone. Please allow permissions.', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
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
      } else {
        const errData = await res.json();
        toast({ title: 'Creation Failed', description: errData.detail || 'Could not create group', variant: 'destructive' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Network Error', description: 'Failed to connect to the server.', variant: 'destructive' });
    }
  };

  const createPeerConnection = (targetUserId: number) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('webrtc_ice_candidate', { targetUserId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    return pc;
  };

  const startCall = async (type: 'audio'|'video') => {
    if (!activeChatId) return;
    setCallType(type);
    setCallState('calling');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
      setLocalStream(stream);
      
      const targetUser = dmUsers.find(u => u.id === activeChatId);
      if (targetUser) setPeerUsername(targetUser.username);

      const pc = createPeerConnection(activeChatId);
      peerConnection.current = pc;
      
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current?.emit('webrtc_offer', {
        targetUserId: activeChatId,
        callerId: user?.id,
        callerUsername: user?.username,
        offer,
        callType: type
      });
    } catch (err) {
      console.error("Media error:", err);
      toast({ title: 'Error', description: 'Could not access camera/microphone.', variant: 'destructive' });
      setCallState('idle');
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    ringtone.current.pause();
    ringtone.current.currentTime = 0;
    
    setCallType(incomingCall.callType);
    setPeerUsername(incomingCall.callerUsername);
    setCallState('active');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: incomingCall.callType === 'video', audio: true });
      setLocalStream(stream);

      const pc = createPeerConnection(incomingCall.callerId);
      peerConnection.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current?.emit('webrtc_answer', {
        targetUserId: incomingCall.callerId,
        answer
      });
      setIncomingCall(null);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Could not access media devices.', variant: 'destructive' });
      rejectCall();
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      socketRef.current?.emit('webrtc_reject_call', { targetUserId: incomingCall.callerId });
      setIncomingCall(null);
      ringtone.current.pause();
      ringtone.current.currentTime = 0;
    }
  };

  const endCall = (remoteEnded = false) => {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    
    if (!remoteEnded && (callState === 'active' || callState === 'calling')) {
      const targetId = incomingCall ? incomingCall.callerId : activeChatId;
      if (targetId) {
        socketRef.current?.emit('webrtc_end_call', { targetUserId: targetId });
      }
    }
    
    setCallState('idle');
    setRemoteStream(null);
    setIncomingCall(null);
    ringtone.current.pause();
    ringtone.current.currentTime = 0;
  };

  const deleteGroup = async () => {
    if (!activeChatId) return;
    if (!confirm("Are you sure you want to completely delete this guild? This action cannot be undone.")) return;
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/chat/groups/${activeChatId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Guild deleted.' });
        setGroups(groups.filter(g => g.id !== activeChatId));
        setActiveChatId(null);
      } else {
        const errData = await res.json();
        toast({ title: 'Error', description: errData.detail || 'Failed to delete guild.', variant: 'destructive' });
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  const addUserToGroup = async (username: string) => {
    if (!activeChatId) return;
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
    const cleanUrl = url.split('?')[0];
    const isAudio = cleanUrl.match(/\.(mp3|wav|ogg|webm|m4a|aac)$/i) || url.includes('type=audio') || (url.includes('/video/upload/') && !cleanUrl.match(/\.(mp4|mov|avi|mkv|jpg|jpeg|png|gif|webp)$/i));
    const isVideo = cleanUrl.match(/\.(mp4|mov|avi|mkv)$/i) && !isAudio;
    
    if (isAudio) {
      return (
        <audio controls className="w-[240px] mt-1">
          <source src={url} />
          Your browser does not support audio.
        </audio>
      );
    }
    if (isVideo) {
      return (
        <video controls className="max-w-full rounded-lg max-h-64 object-cover">
          <source src={url} />
          Your browser does not support the video tag.
        </video>
      );
    }
    return (
      <Dialog>
        <DialogTrigger asChild>
          <img src={url} alt="media" className="w-64 h-64 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity shadow-sm" />
        </DialogTrigger>
        <DialogContent className="max-w-4xl w-full p-1 bg-transparent border-none flex justify-center">
          <img src={url} alt="media fullscreen" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
        </DialogContent>
      </Dialog>
    );
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
        <div className={`w-full md:w-64 border-r border-border/30 bg-card/30 flex-col ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
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
        className={`flex-1 flex-col bg-background/50 relative ${!activeChatId ? 'hidden md:flex' : 'flex'}`}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {activeChatId ? (
          <>
            <CardHeader className="border-b border-border/30 bg-card/50 py-4">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center">
                  <Button variant="ghost" size="icon" className="md:hidden mr-2" onClick={() => setActiveChatId(null)}>
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  {activeTab === 'groups' ? (
                    <><Hash className="w-5 h-5 mr-2 text-primary" /> {groups.find(g => g.id === activeChatId)?.name}</>
                  ) : (
                    <><div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center mr-3 text-sm">{dmUsers.find(u => u.id === activeChatId)?.username[0].toUpperCase()}</div> {dmUsers.find(u => u.id === activeChatId)?.username}</>
                  )}
                </div>
                {activeTab === 'groups' && (
                  <div className="flex gap-2">
                    {isAdmin && (
                      <>
                        <Dialog open={isAddUserModalOpen} onOpenChange={setIsAddUserModalOpen}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8">
                              <UserPlus className="w-4 h-4 mr-2" /> Add User
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <h2 className="text-lg font-bold mb-4">Add User to Guild</h2>
                            <Input 
                              placeholder="Search users..." 
                              value={userSearchQuery} 
                              onChange={(e) => setUserSearchQuery(e.target.value)} 
                              className="mb-4"
                            />
                            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                              {dmUsers
                                .filter(u => u.username.toLowerCase().includes(userSearchQuery.toLowerCase()))
                                .map(u => (
                                  <div key={u.id} className="flex items-center justify-between p-2 rounded bg-secondary/30 hover:bg-secondary/60 transition-colors">
                                    <div className="flex items-center">
                                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mr-3 font-medium text-primary">
                                        {u.username[0].toUpperCase()}
                                      </div>
                                      <span className="font-medium">{u.username}</span>
                                    </div>
                                    <Button size="sm" onClick={() => {
                                      addUserToGroup(u.username);
                                      setIsAddUserModalOpen(false);
                                    }}>
                                      Add
                                    </Button>
                                  </div>
                                ))}
                              {dmUsers.filter(u => u.username.toLowerCase().includes(userSearchQuery.toLowerCase())).length === 0 && (
                                <p className="text-center text-muted-foreground text-sm py-4">No users found.</p>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button variant="destructive" size="sm" onClick={deleteGroup} className="h-8">
                          <Trash2 className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Delete Guild</span>
                        </Button>
                      </>
                    )}
                    <Dialog open={isMembersModalOpen} onOpenChange={(open) => { setIsMembersModalOpen(open); if(open) fetchGroupMembers(); }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 border-border/50">
                          <Users className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Members</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <h2 className="text-lg font-bold mb-4">Group Members</h2>
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                          {groupMembers.map((member) => (
                            <div key={member.id} className="flex items-center justify-between p-2 rounded bg-secondary/50">
                              <div>
                                <span className="font-medium">{member.user.username}</span>
                                {member.role === 'admin' && <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Admin</span>}
                              </div>
                              {isAdmin && member.user.id !== parseInt(user?.id || '0') && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="w-4 h-4"/></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {member.role !== 'admin' && <DropdownMenuItem onClick={() => promoteMember(member.user.id)}>Make Admin</DropdownMenuItem>}
                                    <DropdownMenuItem onClick={() => removeMember(member.user.id)} className="text-red-500">Remove</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
                {activeTab === 'dms' && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => startCall('audio')} className="h-8 w-8 text-primary">
                      <Phone className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => startCall('video')} className="h-8 w-8 text-primary">
                      <Video className="w-5 h-5" />
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg, idx) => {
                  const isMine = msg.sender_id === parseInt(user?.id || '0');
                  const isEditing = editingMessageId === msg.id;

                  return (
                    <div key={idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group relative`}>
                      {!isMine && activeTab === 'groups' && msg.sender && (
                        <span className="text-xs text-muted-foreground ml-1 mb-1">{msg.sender.username}</span>
                      )}
                      
                      <div className="flex items-center gap-2">
                        {isMine && !isEditing && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setEditingMessageId(msg.id);
                                setEditContent(msg.content || '');
                              }}>
                                <Edit2 className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteMessage(msg.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Unsend
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}

                        <div className={`flex flex-col gap-1 max-w-[80%] ${isMine ? 'items-end' : 'items-start'}`}>
                          {isEditing ? (
                            <div className={`px-4 py-2 rounded-2xl ${isMine ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary text-secondary-foreground rounded-tl-sm'}`}>
                              <div className="flex gap-2">
                                <Input 
                                  value={editContent} 
                                  onChange={e => setEditContent(e.target.value)} 
                                  className="h-7 text-sm text-foreground bg-background"
                                  autoFocus
                                  onKeyDown={e => e.key === 'Enter' && submitEdit(msg.id)}
                                />
                                <Button size="sm" onClick={() => submitEdit(msg.id)} className="h-7 px-2">Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingMessageId(null)} className="h-7 px-2 text-primary-foreground hover:bg-primary/80 hover:text-white">Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {msg.content && (
                                <div className={`px-4 py-2 rounded-2xl ${isMine ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary text-secondary-foreground rounded-tl-sm'}`}>
                                  <p>{msg.content}</p>
                                </div>
                              )}
                              {msg.media_url && (
                                <div className="mt-1">
                                  {renderMedia(msg.media_url)}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 mt-1 mx-1">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.is_edited && !isEditing && (
                          <span className="text-[10px] text-muted-foreground italic">(edited)</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-2 md:p-4 bg-card/50 border-t border-border/30 relative">
              <form onSubmit={handleSendMessage} className="flex gap-1 sm:gap-2 items-center">
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
                    disabled={isUploading || isRecording}
                    title="Attach file"
                    className="h-8 w-8 sm:h-10 sm:w-10"
                  >
                    <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>

                <Popover open={isGifPopoverOpen} onOpenChange={setIsGifPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" disabled={isUploading || isRecording} title="GIFs" className="h-8 w-8 sm:h-10 sm:w-10">
                      <Sticker className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-72 p-2">
                    <Input 
                      placeholder="Search GIFs..." 
                      value={gifSearch} 
                      onChange={e => setGifSearch(e.target.value)} 
                      className="mb-2 h-8 text-sm"
                    />
                    <div className="grid grid-cols-3 gap-1 overflow-y-auto max-h-48">
                      {gifs.map((url, i) => (
                        <img 
                          key={i} 
                          src={url} 
                          alt="gif" 
                          className="w-full h-16 object-cover rounded cursor-pointer hover:opacity-80"
                          onClick={() => handleSendMessage(undefined, url)}
                        />
                      ))}
                      {gifs.length === 0 && <p className="text-xs text-muted-foreground col-span-3 text-center py-4">No GIFs found</p>}
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover open={isEmojiPopoverOpen} onOpenChange={setIsEmojiPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" disabled={isUploading || isRecording} title="Emojis" className="h-8 w-8 sm:h-10 sm:w-10">
                      <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-auto p-0 border-none shadow-none bg-transparent">
                    <EmojiPicker 
                      onEmojiClick={(emojiData) => {
                        setNewMessage(prev => prev + emojiData.emoji);
                        setIsEmojiPopoverOpen(false);
                      }} 
                    />
                  </PopoverContent>
                </Popover>

                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message...`}
                  className="flex-1 bg-background h-8 sm:h-10 text-sm"
                  disabled={isUploading || isRecording}
                />

                {isRecording ? (
                  <Button type="button" variant="destructive" size="icon" onClick={stopRecording} className="animate-pulse h-8 w-8 sm:h-10 sm:w-10">
                    <Square className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="icon" onClick={startRecording} disabled={isUploading || !!newMessage.trim()} className="h-8 w-8 sm:h-10 sm:w-10">
                    <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                )}

                {(!isRecording && (newMessage.trim() || isUploading)) && (
                  <Button type="submit" size="icon" disabled={isUploading} className="h-8 w-8 sm:h-10 sm:w-10">
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </Button>
                )}
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

      {/* WebRTC Call UI */}
      {callState === 'active' && (
        <CallOverlay
          localStream={localStream}
          remoteStream={remoteStream}
          peerUsername={peerUsername}
          callType={callType}
          onEndCall={() => endCall(false)}
        />
      )}

      <Dialog open={!!incomingCall && callState === 'idle'} onOpenChange={(open) => { if(!open) rejectCall(); }}>
        <DialogContent className="sm:max-w-md text-center">
          <div className="flex flex-col items-center justify-center p-6 space-y-6">
            <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
              {incomingCall?.callType === 'video' ? <Video className="w-12 h-12 text-primary" /> : <Phone className="w-12 h-12 text-primary" />}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{incomingCall?.callerUsername}</h2>
              <p className="text-muted-foreground mt-1">Incoming {incomingCall?.callType} call...</p>
            </div>
            <div className="flex gap-6 mt-4 w-full justify-center">
              <Button variant="destructive" size="lg" className="rounded-full w-16 h-16" onClick={rejectCall}>
                <PhoneOff className="w-6 h-6" />
              </Button>
              <Button variant="default" size="lg" className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600 text-white" onClick={acceptCall}>
                {incomingCall?.callType === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Messages;
