import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { 
  Brain, 
  Zap, 
  Trophy, 
  Target, 
  TrendingUp, 
  Clock,
  LogOut,
  Swords,
  ChevronRight,
  Activity
} from 'lucide-react';
// We're moving away from the static hero image to a css-based generative background,
// but keeping the import just in case, though we won't actively use it in the new hero.
import heroImage from '@/assets/hero-debate-arena.jpg';

interface DebateHistory {
  id: number;
  topic: string;
  opponent_username: string;
  winner: string;
  date: string;
}

interface UserStats {
    debates_won: number;
    debates_lost: number;
    debates_competed: number;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  elo: number;
  mind_tokens: number;
}

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [debates, setDebates] = useState<DebateHistory[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [badges, setBadges] = useState([]);
  const [streaks, setStreaks] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
        if (!user) {
            setIsLoading(false);
            return;
        }

      try {
        const [statsRes, historyRes, leaderboardRes, badgesRes, streaksRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/dashboard/stats`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/dashboard/history`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/leaderboard/`),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/gamification/badges`),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/gamification/streaks`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          }),
        ]);

        if (!statsRes.ok || !historyRes.ok || !leaderboardRes.ok || !badgesRes.ok || !streaksRes.ok) {
            throw new Error('One or more API requests failed.');
        }

        const stats = await statsRes.json();
        const history = await historyRes.json();
        const leaderboard = await leaderboardRes.json();
        const badges = await badgesRes.json();
        const streaks = await streaksRes.json();

        setStats(stats);
        setDebates(history);
        setLeaderboard(leaderboard.map((u: any, index: number) => ({ ...u, rank: index + 1 })));
        setBadges(badges);
        setStreaks(streaks);

      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        toast({
            title: "Dashboard Load Error",
            description: "Failed to sync with neural network.",
            variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const handleStartDebate = () => {
    navigate('/matchmaking');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (isLoading || !stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        {/* Subtle background glow while loading */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyber-blue/10 blur-[100px] rounded-full"></div>
        <div className="flex flex-col items-center z-10 space-y-6">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-t-2 border-cyber-blue rounded-full animate-spin"></div>
            <div className="absolute inset-2 border-r-2 border-cyber-red rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            <Brain className="absolute inset-0 m-auto w-6 h-6 text-cyber-blue animate-pulse" />
          </div>
          <p className="text-cyber-blue/80 font-medium tracking-widest uppercase text-sm animate-pulse">Establishing Neural Link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-cyber-blue/30 overflow-x-hidden">
      
      {/* Abstract Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyber-blue/10 blur-[120px] rounded-full mix-blend-screen"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyber-red/10 blur-[120px] rounded-full mix-blend-screen"></div>
      </div>

      {/* Floating Glass Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 group cursor-pointer">
            <div className="relative">
              <Brain className="h-8 w-8 text-foreground transition-transform duration-500 group-hover:scale-110 group-hover:text-cyber-blue" />
              <div className="absolute inset-0 bg-cyber-blue blur-lg opacity-0 group-hover:opacity-40 transition-opacity duration-500"></div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              MindGrid
            </h1>
          </div>
          
          <div className="hidden md:flex items-center space-x-1 bg-white/5 rounded-full px-2 py-1 border border-white/5">
            <Link to="/leaderboard"><Button variant="ghost" className="rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all">Leaderboard</Button></Link>
            <Link to="/store"><Button variant="ghost" className="rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all">Store</Button></Link>
            <Link to="/forums"><Button variant="ghost" className="rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all">Forums</Button></Link>
            <Link to="/messages">
              <Button variant="ghost" className="relative rounded-full text-cyber-blue hover:text-cyber-blue hover:bg-cyber-blue/10 transition-all group overflow-visible">
                <span className="relative z-10 flex items-center font-bold tracking-wide">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 group-hover:scale-110 transition-transform"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Messages
                </span>
                <span className="absolute inset-0 bg-cyber-blue/10 rounded-full scale-110 group-hover:bg-cyber-blue/20 transition-all blur-sm"></span>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-red opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyber-red"></span>
                </span>
              </Button>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:block text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Connected</p>
              <p className="text-sm font-medium text-foreground">{user?.username}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyber-blue to-cyber-red p-[1px]">
              <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                <span className="text-xs font-bold">{user?.username?.[0]?.toUpperCase()}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-cyber-red transition-colors">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-6 py-10">
        
        {/* Immersive Hero Section */}
        <section className="relative rounded-3xl overflow-hidden mb-12 border border-white/10 shadow-2xl shadow-cyber-blue/5 group">
          {/* Generative-looking abstract backdrop */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyber-blue/20 via-background to-background"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay"></div>
          
          <div className="relative p-10 md:p-16 flex flex-col items-start justify-center min-h-[320px]">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyber-blue/10 border border-cyber-blue/20 text-cyber-blue text-xs font-medium uppercase tracking-wider mb-6">
              <Activity className="w-3 h-3 animate-pulse" />
              <span>Global Arena Online</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold text-foreground tracking-tight mb-4 max-w-2xl">
              Sharpen your mind in the <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-blue to-cyber-purple">Neural Arena</span>.
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl leading-relaxed">
              Engage in high-stakes intellectual combat against advanced AI or global human challengers. Prove your mastery.
            </p>
            <Button 
              size="lg" 
              onClick={handleStartDebate}
              className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 h-12 text-base font-semibold shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 group"
            >
              <Swords className="mr-2 h-5 w-5 transition-transform group-hover:rotate-12" />
              Enter Matchmaking
            </Button>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <Card className="bg-white/5 border-white/5 backdrop-blur-sm p-6 rounded-2xl hover:bg-white/10 transition-all duration-300 hover:-translate-y-1 group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">ELO Rating</p>
                <p className="text-3xl font-bold text-foreground tracking-tight">{stats?.elo ?? user?.elo}</p>
              </div>
              <div className="p-3 bg-cyber-red/10 rounded-xl text-cyber-red group-hover:bg-cyber-red/20 transition-colors shadow-[0_0_15px_rgba(255,0,0,0.1)]">
                <Target className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="bg-white/5 border-white/5 backdrop-blur-sm p-6 rounded-2xl hover:bg-white/10 transition-all duration-300 hover:-translate-y-1 group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Mind Tokens</p>
                <p className="text-3xl font-bold text-foreground tracking-tight">{stats?.mind_tokens ?? user?.mind_tokens}</p>
              </div>
              <div className="p-3 bg-cyber-gold/10 rounded-xl text-cyber-gold group-hover:bg-cyber-gold/20 transition-colors shadow-[0_0_15px_rgba(255,215,0,0.1)]">
                <Zap className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="bg-white/5 border-white/5 backdrop-blur-sm p-6 rounded-2xl hover:bg-white/10 transition-all duration-300 hover:-translate-y-1 group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Victories</p>
                <p className="text-3xl font-bold text-foreground tracking-tight">{stats?.debates_won || 0}</p>
              </div>
              <div className="p-3 bg-cyber-green/10 rounded-xl text-cyber-green group-hover:bg-cyber-green/20 transition-colors shadow-[0_0_15px_rgba(0,255,0,0.1)]">
                <Trophy className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="bg-white/5 border-white/5 backdrop-blur-sm p-6 rounded-2xl hover:bg-white/10 transition-all duration-300 hover:-translate-y-1 group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Debates</p>
                <p className="text-3xl font-bold text-foreground tracking-tight">{stats?.debates_competed || 0}</p>
              </div>
              <div className="p-3 bg-cyber-blue/10 rounded-xl text-cyber-blue group-hover:bg-cyber-blue/20 transition-colors shadow-[0_0_15px_rgba(0,100,255,0.1)]">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </Card>
        </section>

        {/* Two-Column Layout for Main Content */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Recent Debates Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-foreground flex items-center">
                <Clock className="mr-3 h-5 w-5 text-muted-foreground" />
                Recent Synapses
              </h3>
            </div>
            
            <div className="space-y-3">
              {debates.length > 0 ? (
                debates.map((debate) => {
                  const isWin = debate.winner === user?.username;
                  const isDraw = debate.winner.toLowerCase() === 'draw';
                  const statusColor = isWin ? 'bg-cyber-green' : isDraw ? 'bg-cyber-gold' : 'bg-cyber-red';
                  const statusTextClass = isWin ? 'text-cyber-green' : isDraw ? 'text-cyber-gold' : 'text-cyber-red';
                  
                  return (
                    <Link 
                      to={`/analysis/${debate.id}`} 
                      key={debate.id} 
                      className="group flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all duration-300 relative overflow-hidden"
                    >
                      {/* Left status indicator line */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColor} opacity-70`}></div>
                      
                      <div className="flex-1 ml-2">
                        <div className="flex items-center space-x-3 mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-background/50 ${statusTextClass}`}>
                            {isWin ? 'VICTORY' : isDraw ? 'DRAW' : 'DEFEAT'}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {new Date(debate.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <h4 className="text-base font-semibold text-foreground group-hover:text-cyber-blue transition-colors line-clamp-1">
                          {debate.topic}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          vs <span className="text-foreground/80 font-medium">{debate.opponent_username || 'AI'}</span>
                        </p>
                      </div>
                      
                      <div className="pl-4">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-cyber-blue/10 transition-colors">
                          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-cyber-blue transition-colors group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </Link>
                  )
                })
              ) : (
                <div className="p-10 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center text-center bg-white/5">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Activity className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-foreground font-medium mb-1">No debates recorded yet.</p>
                  <p className="text-sm text-muted-foreground">Step into the arena to begin your journey.</p>
                </div>
              )}
            </div>
          </div>

          {/* Leaderboard Column */}
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-foreground flex items-center">
                <Trophy className="mr-3 h-5 w-5 text-muted-foreground" />
                Global Rankings
              </h3>
            </div>

            <Card className="bg-white/5 border-white/5 backdrop-blur-sm rounded-2xl overflow-hidden">
              <div className="p-1 bg-gradient-to-r from-transparent via-white/10 to-transparent h-[1px]"></div>
              <div className="p-5 space-y-4">
                {leaderboard.length > 0 ? (
                  leaderboard.slice(0, 5).map((entry) => {
                    const isCurrentUser = entry.username === user?.username;
                    const isFirst = entry.rank === 1;
                    const isSecond = entry.rank === 2;
                    const isThird = entry.rank === 3;
                    
                    return (
                      <div
                        key={entry.rank}
                        className={`group flex items-center justify-between p-3 rounded-xl transition-colors ${
                          isCurrentUser ? 'bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                            isFirst ? 'bg-gradient-to-br from-yellow-300 to-amber-600 text-black' :
                            isSecond ? 'bg-gradient-to-br from-gray-200 to-gray-500 text-black' :
                            isThird ? 'bg-gradient-to-br from-orange-300 to-red-800 text-white' :
                            'bg-background border border-white/10 text-muted-foreground'
                          }`}>
                            {entry.rank}
                          </div>
                          <div>
                            <span className={`font-medium ${isCurrentUser ? 'text-cyber-blue' : 'text-foreground'}`}>
                              {entry.username}
                              {isCurrentUser && <span className="ml-2 text-[10px] bg-cyber-blue/20 text-cyber-blue px-1.5 py-0.5 rounded uppercase tracking-wider">You</span>}
                            </span>
                            <div className="text-xs text-muted-foreground flex items-center space-x-2 mt-0.5">
                              <span>{entry.mind_tokens} Tokens</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground">{entry.elo}</p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ELO</p>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-muted-foreground text-center py-4 text-sm">Rankings syncing...</p>
                )}
                
                {leaderboard.length > 5 && (
                  <Button variant="ghost" className="w-full text-xs text-muted-foreground hover:text-foreground mt-2">
                    View Complete Leaderboard
                  </Button>
                )}
              </div>
            </Card>
          </div>
          
        </section>

        {/* Creator Attribution */}
        <footer className="mt-16 pt-8 border-t border-white/5 text-center flex flex-col items-center justify-center">
          <div className="inline-flex items-center space-x-2 text-sm text-muted-foreground/60 hover:text-cyber-blue transition-colors duration-300">
            
            {/* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-cyber-red/80">
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg> */}
            <span>Created by <strong className="text-foreground tracking-wide">Adnan Ahmad</strong></span>
          </div>
        </footer>

      </main>
    </div>
  );
};

export default Dashboard;