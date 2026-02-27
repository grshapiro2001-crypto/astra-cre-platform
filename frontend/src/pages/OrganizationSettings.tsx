import { useState, useEffect, useCallback } from 'react';
import { PageTransition } from '@/components/layout/PageTransition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Users, Copy, RefreshCw, Shield, UserX, Trash2, Check, X, AlertTriangle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import organizationService from '@/services/organizationService';
import type { Organization, OrgMember } from '@/services/organizationService';

export const OrganizationSettings = () => {
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [pending, setPending] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasOrg, setHasOrg] = useState<boolean | null>(null);

  // Create form
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  // Join form
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinSent, setJoinSent] = useState(false);

  // Confirm states
  const [confirmDisband, setConfirmDisband] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const fetchOrg = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await organizationService.getMyOrg();
      setOrg(data);
      setHasOrg(true);

      const [membersData, pendingData] = await Promise.allSettled([
        organizationService.getMembers(),
        data.your_role === 'owner' ? organizationService.getPending() : Promise.resolve([]),
      ]);
      if (membersData.status === 'fulfilled') setMembers(membersData.value);
      if (pendingData.status === 'fulfilled') setPending(pendingData.value as OrgMember[]);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404 || status === 400) {
        // User genuinely has no organization
        setHasOrg(false);
      } else {
        // Server error (500), network error, or unexpected failure
        setHasOrg(false);
        setError(
          err?.response?.data?.detail ||
            'Unable to load organization data. The server may be temporarily unavailable.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const data = await organizationService.create(createName.trim());
      setOrg(data);
      setHasOrg(true);
      toast.success('Organization created!');
      fetchOrg();
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
      toast.error(err?.response?.data?.detail || 'Failed to join organization');
    } finally {
      setJoining(false);
    }
  };

  const handleApprove = async (memberId: number, approve: boolean) => {
    try {
      await organizationService.approve(memberId, approve);
      toast.success(approve ? 'Member approved' : 'Member rejected');
      fetchOrg();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to process request');
    }
  };

  const handleCopyCode = () => {
    if (org?.invite_code) {
      navigator.clipboard.writeText(org.invite_code);
      toast.success('Invite code copied!');
    }
  };

  const handleRegenCode = async () => {
    try {
      const data = await organizationService.regenerateCode();
      setOrg(data);
      setConfirmRegen(false);
      toast.success('Invite code regenerated');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to regenerate code');
    }
  };

  const handleLeave = async () => {
    try {
      await organizationService.leave();
      setOrg(null);
      setHasOrg(false);
      setMembers([]);
      setPending([]);
      setConfirmLeave(false);
      toast.success('You have left the organization');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to leave organization');
    }
  };

  const handleDisband = async () => {
    try {
      await organizationService.disband();
      setOrg(null);
      setHasOrg(false);
      setMembers([]);
      setPending([]);
      setConfirmDisband(false);
      toast.success('Organization disbanded');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to disband organization');
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="max-w-3xl mx-auto py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-40 bg-muted rounded-2xl" />
          </div>
        </div>
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition>
        <div className="max-w-3xl mx-auto py-8">
          <div className="bg-card/50 border border-destructive/30 rounded-2xl p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Failed to load organization</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button onClick={fetchOrg} variant="outline" size="sm">
              <RotateCcw className="w-4 h-4 mr-1.5" /> Try Again
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  // ========== NO ORG — SHOW CREATE/JOIN ==========
  if (!hasOrg) {
    return (
      <PageTransition>
        <div className="max-w-3xl mx-auto py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Organization</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Create or join a team workspace to share deals with colleagues.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Create */}
            <div className="bg-card/50 border border-border/60 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Create Organization</h2>
                  <p className="text-xs text-muted-foreground">Start a shared workspace</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgName" className="text-sm">Organization Name</Label>
                <Input
                  id="orgName"
                  placeholder="e.g. Acme Capital"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <Button onClick={handleCreate} disabled={creating || !createName.trim()} className="w-full">
                {creating ? 'Creating...' : 'Create Organization'}
              </Button>
            </div>

            {/* Join */}
            <div className="bg-card/50 border border-border/60 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Join Organization</h2>
                  <p className="text-xs text-muted-foreground">Have an invite code?</p>
                </div>
              </div>

              {joinSent ? (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                  <Check className="w-5 h-5 text-primary mx-auto mb-2" />
                  <p className="text-sm text-foreground font-medium">Request sent!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You'll get access once the owner approves.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="inviteCode" className="text-sm">Invite Code</Label>
                    <Input
                      id="inviteCode"
                      placeholder="e.g. aX9kR2mQ"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    />
                  </div>
                  <Button variant="outline" onClick={handleJoin} disabled={joining || !joinCode.trim()} className="w-full">
                    {joining ? 'Requesting...' : 'Request to Join'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  // ========== HAS ORG — FULL SETTINGS ==========
  const isOwner = org?.your_role === 'owner';

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto py-8 space-y-6">
        {/* Organization Info */}
        <div className="bg-card/50 border border-border/60 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{org?.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={
                      isOwner
                        ? 'px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary'
                        : 'px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground'
                    }
                  >
                    {isOwner ? 'Owner' : 'Member'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {org?.member_count} {org?.member_count === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invite Code — Owner only */}
        {isOwner && org && (
          <div className="bg-card/50 border border-border/60 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Invite Code</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 font-mono bg-muted rounded-lg px-4 py-3 text-foreground text-lg tracking-wider">
                {org.invite_code}
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyCode}>
                <Copy className="w-4 h-4 mr-1.5" /> Copy
              </Button>
              {confirmRegen ? (
                <div className="flex items-center gap-1.5">
                  <Button variant="destructive" size="sm" onClick={handleRegenCode}>
                    Confirm
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRegen(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmRegen(true)}>
                  <RefreshCw className="w-4 h-4 mr-1.5" /> Regenerate
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Share this code with people you want to invite. They'll need owner approval after joining.
            </p>
          </div>
        )}

        {/* Pending Requests — Owner only */}
        {isOwner && pending.length > 0 && (
          <div className="bg-card/50 border border-border/60 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Pending Requests ({pending.length})
            </h2>
            <div className="space-y-3">
              {pending.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.user_email}</p>
                    {m.user_name && (
                      <p className="text-xs text-muted-foreground">{m.user_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleApprove(m.id, true)}>
                      <Check className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleApprove(m.id, false)}>
                      <X className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        <div className="bg-card/50 border border-border/60 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Members ({members.length})
          </h2>
          <div className="space-y-3">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary text-xs font-bold">
                      {(m.user_name || m.user_email).slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {m.user_name || m.user_email}
                    </p>
                    {m.user_name && (
                      <p className="text-xs text-muted-foreground">{m.user_email}</p>
                    )}
                  </div>
                </div>
                <span
                  className={
                    m.role === 'owner'
                      ? 'px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary'
                      : 'px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground'
                  }
                >
                  {m.role === 'owner' ? 'Owner' : 'Member'}
                </span>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-card/50 border border-destructive/30 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-destructive uppercase tracking-wider">Danger Zone</h2>

          {isOwner ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Disband Organization</p>
                <p className="text-xs text-muted-foreground">
                  Remove all members and delete the organization. Properties will become personal.
                </p>
              </div>
              {confirmDisband ? (
                <div className="flex items-center gap-1.5">
                  <Button variant="destructive" size="sm" onClick={handleDisband}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Confirm Disband
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDisband(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="destructive" size="sm" onClick={() => setConfirmDisband(true)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Disband
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Leave Organization</p>
                <p className="text-xs text-muted-foreground">
                  Your deals will become personal again.
                </p>
              </div>
              {confirmLeave ? (
                <div className="flex items-center gap-1.5">
                  <Button variant="destructive" size="sm" onClick={handleLeave}>
                    <UserX className="w-3.5 h-3.5 mr-1" /> Confirm Leave
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmLeave(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="destructive" size="sm" onClick={() => setConfirmLeave(true)}>
                  <UserX className="w-3.5 h-3.5 mr-1" /> Leave
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};
