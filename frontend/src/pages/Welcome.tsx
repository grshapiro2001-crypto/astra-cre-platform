import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import organizationService from '@/services/organizationService';

export const Welcome = () => {
  const navigate = useNavigate();

  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinSent, setJoinSent] = useState(false);

  // If user already has org, redirect to dashboard
  useEffect(() => {
    organizationService.getMyOrg().then(() => {
      navigate('/dashboard', { replace: true });
    }).catch(() => {
      // No org — stay on this page
    });
  }, [navigate]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await organizationService.create(createName.trim());
      toast.success('Organization created!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      await organizationService.join(joinCode.trim());
      setJoinSent(true);
      toast.success('Join request sent!');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-950 via-slate-950 to-purple-950 px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold">
          <span className="text-white">Astra</span>
          <span className="text-purple-300/70 ml-1.5 font-normal text-sm">CRE</span>
        </h1>
      </div>

      {/* Heading */}
      <h2 className="text-3xl font-bold text-white mb-2">Welcome to ASTRA CRE</h2>
      <p className="text-purple-200/60 text-sm mb-10">Set up your workspace to get started</p>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
        {/* Create */}
        <div className="bg-white/[0.06] backdrop-blur border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Create a New Organization</h3>
            <p className="text-sm text-purple-200/50 mt-1">
              Start a shared workspace for your team. You'll get an invite code to share with colleagues.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="welcomeOrgName" className="text-purple-200/70 text-sm">Organization name</Label>
            <Input
              id="welcomeOrgName"
              placeholder="e.g. Acme Capital"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <Button onClick={handleCreate} disabled={creating || !createName.trim()} className="w-full">
            {creating ? 'Creating...' : 'Create & Continue'}
          </Button>
        </div>

        {/* Join */}
        <div className="bg-white/[0.04] backdrop-blur border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-200/60" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Join an Organization</h3>
            <p className="text-sm text-purple-200/50 mt-1">
              Have an invite code? Enter it below to request access. The owner will approve your request.
            </p>
          </div>

          {joinSent ? (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
              <Check className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-sm text-white font-medium">Request sent!</p>
              <p className="text-xs text-purple-200/50 mt-1">You'll get access once the owner approves.</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-1 text-sm text-primary mt-3 hover:underline"
              >
                Go to Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="welcomeJoinCode" className="text-purple-200/70 text-sm">Invite code</Label>
                <Input
                  id="welcomeJoinCode"
                  placeholder="e.g. aX9kR2mQ"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
              <Button variant="outline" onClick={handleJoin} disabled={joining || !joinCode.trim()} className="w-full border-white/20 text-white hover:bg-white/5">
                {joining ? 'Requesting...' : 'Request to Join'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Skip link */}
      <button
        onClick={() => navigate('/dashboard')}
        className="mt-8 text-sm text-purple-300/50 hover:text-purple-200/70 transition-colors"
      >
        Skip for now — I'll set this up later
      </button>
    </div>
  );
};
