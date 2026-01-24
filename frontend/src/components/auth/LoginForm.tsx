import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authSlice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export const LoginForm = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (error) {
      // Error is handled by the store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-900 via-canopy-800 to-emerald-950 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md w-full forest-glass shadow-forest-xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center shadow-forest-md">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            Sign in to <span className="text-emerald-600">Astra CRE</span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Or{' '}
            <Link to="/register" className="font-medium text-emerald-500 hover:text-emerald-600 transition-colors">
              create a new account
            </Link>
          </p>
        </CardHeader>

        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
                <div className="text-sm text-destructive">{error}</div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-emerald-800">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="Enter your email"
                  className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-emerald-800">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              size="lg"
              className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-forest-md"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>

            <div className="text-center">
              <span className="inline-block px-3 py-1 rounded-full bg-sunlight-100 text-sunlight-700 text-xs font-medium">
                Powered by Emerald Forest
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
