import { useAuthStore } from '@/store/authSlice';
import { TalismanLogo } from '@/components/ui/TalismanLogo';
import { Button } from '@/components/ui/button';
import { LogOut, Clock } from 'lucide-react';

export const PendingApproval = () => {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950 via-yellow-950 to-amber-950 flex items-center justify-center">
      <div className="max-w-md w-full mx-4 text-center">
        {/* Compass */}
        <div className="flex justify-center mb-8">
          <TalismanLogo size={64} />
        </div>

        {/* Status badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-amber-300 text-xs font-medium uppercase tracking-wide">
            Pending Approval
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold font-display text-white mb-3">
          Welcome to <span className="text-amber-300">Talisman</span>
          <span className="text-amber-300/60 text-sm ml-1">IO</span>
        </h1>

        {/* Message */}
        <p className="text-amber-200/60 text-sm leading-relaxed mb-2">
          Your account has been created successfully.
        </p>
        <p className="text-amber-200/60 text-sm leading-relaxed mb-8">
          Griffin will reach out when you're in.
        </p>

        {/* User info */}
        <div className="bg-white/5 rounded-xl border border-white/5 p-4 mb-6">
          <p className="text-white text-sm font-medium">
            {user?.full_name || 'User'}
          </p>
          <p className="text-amber-300/50 text-xs mt-0.5">
            {user?.email}
          </p>
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          onClick={logout}
          className="text-amber-200/50 hover:text-white hover:bg-white/5"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </Button>
      </div>
    </div>
  );
};
