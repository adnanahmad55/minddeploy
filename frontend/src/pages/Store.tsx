import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Zap, Crown, Shield, Bot, Home, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: React.ReactNode;
  color: string;
}

const STORE_ITEMS: StoreItem[] = [
  {
    id: 'ai_socrates',
    name: 'Socrates AI Persona',
    description: 'Unlock the Socrates personality for AI Debates. Deeply philosophical and questioning.',
    price: 100,
    icon: <Bot className="h-8 w-8" />,
    color: 'text-cyber-blue'
  },
  {
    id: 'ai_machiavelli',
    name: 'Machiavelli AI Persona',
    description: 'Unlock the Machiavelli personality. Cunning, ruthless, and strategic.',
    price: 150,
    icon: <Bot className="h-8 w-8" />,
    color: 'text-cyber-red'
  },
  {
    id: 'badge_veteran',
    name: 'Veteran Debater Badge',
    description: 'A shiny gold badge for your profile to show off your dedication.',
    price: 50,
    icon: <Shield className="h-8 w-8" />,
    color: 'text-cyber-gold'
  },
  {
    id: 'premium_guild',
    name: 'Guild Creation Ticket',
    description: 'Create your own custom persistent group (Guild) and invite friends.',
    price: 500,
    icon: <Crown className="h-8 w-8" />,
    color: 'text-cyber-purple'
  }
];

const Store = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [ownedItems, setOwnedItems] = useState<string[]>([]);
  
  React.useEffect(() => {
    if (!user) return;
    const fetchPurchases = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/store/purchases`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setOwnedItems(data.purchases || []);
        }
      } catch (err) {
        console.error("Failed to fetch purchases:", err);
      }
    };
    fetchPurchases();
  }, [user]);

  const handlePurchase = async (item: StoreItem) => {
    if (!user) return;
    
    // In a real app, we check balance before sending to backend, but backend enforces it too.
    if (user.mind_tokens < item.price) {
      toast({
        title: 'Insufficient Tokens',
        description: `You need ${item.price - user.mind_tokens} more MindTokens.`,
        variant: 'destructive'
      });
      return;
    }

    setPurchasingId(item.id);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/store/purchase/${item.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      });

      if (response.ok) {
        toast({
          title: 'Purchase Successful!',
          description: `You unlocked: ${item.name}`,
        });
        setOwnedItems(prev => [...prev, item.id]);
        // Note: You may want to trigger a context update to refresh the user's mind_tokens
      } else {
        const errorData = await response.json();
        toast({
          title: 'Purchase Failed',
          description: errorData.detail || 'Something went wrong.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Network Error',
        description: 'Failed to connect to the store.',
        variant: 'destructive'
      });
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-bg">
      <header className="border-b border-border/50 bg-card/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Zap className="h-8 w-8 text-cyber-gold" />
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              MindStore
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-muted/20 px-4 py-2 rounded-lg border border-border/50">
              <Zap className="h-4 w-4 text-cyber-gold" />
              <span className="font-semibold text-foreground">{user?.mind_tokens || 0}</span>
            </div>
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Unlock Premium Content</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Spend the MindTokens you earn from winning debates to unlock exclusive AI personalities, profile badges, and guild features.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {STORE_ITEMS.map(item => {
            const isOwned = ownedItems.includes(item.id);
            return (
              <Card key={item.id} className="bg-gradient-card border-border/50 p-6 flex flex-col h-full hover:border-cyber-gold/50 transition-colors">
                <div className={`mb-4 ${item.color} flex justify-center`}>
                  <div className="p-4 bg-muted/20 rounded-full">
                    {item.icon}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-foreground text-center mb-2">{item.name}</h3>
                <p className="text-sm text-muted-foreground text-center flex-grow mb-6">
                  {item.description}
                </p>
                <div className="mt-auto">
                  {isOwned ? (
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white cursor-default">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Owned
                    </Button>
                  ) : (
                    <Button 
                      className="w-full group" 
                      variant="outline"
                      disabled={purchasingId === item.id}
                      onClick={() => handlePurchase(item)}
                    >
                      {purchasingId === item.id ? (
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                      ) : (
                        <>
                          <Zap className="mr-2 h-4 w-4 text-cyber-gold group-hover:scale-110 transition-transform" />
                          {item.price} Tokens
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default Store;
