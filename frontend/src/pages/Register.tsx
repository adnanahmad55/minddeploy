import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Brain, Lock, Mail, User, KeyRound } from 'lucide-react';

const Register = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Error", description: "Please enter an email address.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'signup' })
      });
      
      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        toast({ title: "OTP Sent", description: "Check your email for the verification code." });
      } else {
        toast({ title: "Error", description: data.detail || "Failed to send OTP", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) {
      toast({ title: "Error", description: "Please enter the OTP.", variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Password mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // The register function in AuthContext needs to be updated to pass otp_code.
      // We will override it here for simplicity.
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, otp_code: otpCode })
      });
      const data = await res.json();
      
      if (res.ok) {
        toast({ title: "Registration successful", description: "Welcome to MindGrid!" });
        navigate('/login');
      } else {
        toast({ title: "Registration failed", description: data.detail || "Invalid OTP or credentials.", variant: "destructive" });
        if (data.detail && data.detail.toLowerCase().includes('otp')) {
          setStep(1); // Go back if OTP was invalid
        }
      }
    } catch (error) {
      console.error("Registration failed:", error);
      toast({ title: "Registration failed", description: "Network error.", variant: "destructive" });
    } finally {
      setIsLoading(false);
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
            Join the neural battleground
          </p>
        </div>

        <Card className="bg-gradient-card border-border/50 p-8 shadow-cyber">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-input/50 border-border/50 focus:border-cyber-red"
                    placeholder="Enter your email"
                    disabled={otpSent || isLoading}
                    required
                  />
                </div>
              </div>
              
              {!otpSent ? (
                <Button onClick={handleSendOTP} size="lg" className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending..." : "Send OTP"}
                </Button>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Verification Code</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        className="pl-10 bg-input/50 border-border/50 focus:border-cyber-red tracking-widest text-lg font-bold"
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                        required
                      />
                    </div>
                  </div>
                  <Button onClick={handleVerifyOTP} size="lg" className="w-full">
                    Verify & Continue
                  </Button>
                  <Button variant="ghost" onClick={() => setOtpSent(false)} className="w-full text-sm">
                    Change Email
                  </Button>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 bg-input/50 border-border/50 focus:border-cyber-red"
                    placeholder="Choose your handle"
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
                    placeholder="Create a password"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 bg-input/50 border-border/50 focus:border-cyber-red"
                    placeholder="Confirm your password"
                    required
                  />
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep(1)} className="w-full text-sm">
                Back to Email
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              Already connected?{' '}
              <Link to="/login" className="text-cyber-red hover:text-cyber-red/80 font-medium transition-colors">
                Enter here
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Register;