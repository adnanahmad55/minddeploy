import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Brain, Lock, User, Mail, KeyRound, HelpCircle } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Forgot Password States
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [fpStep, setFpStep] = useState<1|2>(1);
  const [fpEmail, setFpEmail] = useState('');
  const [fpSecurityQuestion, setFpSecurityQuestion] = useState('');
  const [fpSecurityAnswer, setFpSecurityAnswer] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpIsLoading, setFpIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(username, password);
      toast({
        title: "Login successful",
        description: "Welcome to MindGrid!",
      });
      navigate('/dashboard');
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchSecurityQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fpEmail) return;
    setFpIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/security-question/${fpEmail}`, {
        method: 'GET',
      });
      const data = await res.json();
      if (res.ok) {
        setFpSecurityQuestion(data.security_question);
        setFpStep(2);
      } else {
        toast({ title: "Error", description: data.detail || "Failed to find user", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setFpIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fpSecurityAnswer || !fpNewPassword) return;
    setFpIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fpEmail, security_answer: fpSecurityAnswer, new_password: fpNewPassword })
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Success", description: "Password has been reset. You can now login." });
        setIsForgotOpen(false);
        setFpStep(1);
        setFpEmail('');
        setFpSecurityAnswer('');
        setFpNewPassword('');
      } else {
        toast({ title: "Error", description: data.detail || "Invalid answer", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setFpIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Brain className="h-12 w-12 text-cyber-red mr-2" />
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              MindGrid
            </h1>
          </div>
          <p className="text-muted-foreground">
            Enter the neural battleground
          </p>
        </div>

        <Card className="bg-gradient-card border-border/50 p-8 shadow-cyber">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-input/50 border-border/50 focus:border-cyber-red"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-input/50 border-border/50 focus:border-cyber-red"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Connecting..." : "Enter the Grid"}
            </Button>
            <div className="flex justify-end">
              <Button type="button" variant="link" onClick={() => setIsForgotOpen(true)} className="px-0 text-muted-foreground hover:text-cyber-red">
                Forgot Password?
              </Button>
            </div>
          </form>

          <Dialog open={isForgotOpen} onOpenChange={(open) => { setIsForgotOpen(open); if(!open) setFpStep(1); }}>
            <DialogContent className="sm:max-w-md bg-gradient-card border-border/50">
              <DialogHeader>
                <DialogTitle>Reset Password</DialogTitle>
              </DialogHeader>
              {fpStep === 1 ? (
                <form onSubmit={handleFetchSecurityQuestion} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        value={fpEmail}
                        onChange={(e) => setFpEmail(e.target.value)}
                        className="pl-10 bg-input/50"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={fpIsLoading}>
                    {fpIsLoading ? "Fetching..." : "Next"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="p-4 bg-muted/20 rounded-md border border-border/50 mb-4">
                    <p className="text-sm text-muted-foreground mb-1">Security Question</p>
                    <p className="font-medium text-foreground">{fpSecurityQuestion}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Your Answer</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        value={fpSecurityAnswer}
                        onChange={(e) => setFpSecurityAnswer(e.target.value)}
                        className="pl-10 bg-input/50"
                        placeholder="Type your answer"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        value={fpNewPassword}
                        onChange={(e) => setFpNewPassword(e.target.value)}
                        className="pl-10 bg-input/50"
                        placeholder="New password"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={fpIsLoading}>
                    {fpIsLoading ? "Resetting..." : "Reset Password"}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setFpStep(1)}>
                    Back
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              New to MindGrid?{' '}
              <Link 
                to="/register" 
                className="text-cyber-red hover:text-cyber-red/80 font-medium transition-colors"
              >
                Join the battle
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
