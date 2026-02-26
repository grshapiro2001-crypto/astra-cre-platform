import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import organizationService from '@/services/organizationService';
import type { Organization } from '@/services/organizationService';
import { propertyService } from '@/services/propertyService';

interface DealItem {
  id: number;
  deal_name: string;
  property_address: string;
}

interface MigrateDealModalProps {
  org: Organization;
  onClose: () => void;
}

export const MigrateDealModal = ({ org, onClose }: MigrateDealModalProps) => {
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    propertyService
      .listProperties({})
      .then((res) => {
        // Only show personal deals (no org_id)
        const personalDeals = (res.properties || []).map((p: any) => ({
          id: p.id,
          deal_name: p.deal_name,
          property_address: p.property_address || '\u2014',
        }));
        setDeals(personalDeals);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleDeal = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMigrate = async () => {
    if (selectedIds.size === 0) return;
    setMigrating(true);
    try {
      await organizationService.migrateDeals(Array.from(selectedIds));
      toast.success(`Migrated ${selectedIds.size} deal${selectedIds.size > 1 ? 's' : ''} to ${org.name}`);
      localStorage.setItem('astra_migration_seen', 'true');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to migrate deals');
    } finally {
      setMigrating(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('astra_migration_seen', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleSkip} />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6 space-y-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">You've joined {org.name}!</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Would you like to move any of your existing deals into the shared organization workspace?
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSkip} className="shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Deal list */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted rounded-lg" />
              ))}
            </div>
          ) : deals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No personal deals to migrate.
            </p>
          ) : (
            deals.map((deal) => (
              <button
                key={deal.id}
                onClick={() => toggleDeal(deal.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                  selectedIds.has(deal.id)
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-muted/50 border-border/40 hover:bg-muted'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selectedIds.has(deal.id)
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground/40'
                  }`}
                >
                  {selectedIds.has(deal.id) && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{deal.deal_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{deal.property_address}</p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip — keep my deals personal
          </Button>
          <Button
            size="sm"
            disabled={selectedIds.size === 0 || migrating}
            onClick={handleMigrate}
          >
            {migrating ? 'Moving...' : `Move ${selectedIds.size} Deal${selectedIds.size !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
};
