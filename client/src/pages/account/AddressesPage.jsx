import { useState } from 'react';
import { MapPin, Pencil, Plus, Store, Trash2 } from 'lucide-react';
import ScreenHeader from '@/components/layout/ScreenHeader.jsx';
import BottomBar from '@/components/layout/BottomBar.jsx';
import { Button, Card, ConfirmDialog, EmptyState, IconTile, Skeleton, Tag } from '@/components/ui';
import { useAddresses } from '@/context/AddressContext.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { formatAddress } from '@/domain';
import { ROUTES } from '@/config/routes.js';
import { useDocumentTitle } from '@/hooks';

/** 23 · Saved addresses */
export default function AddressesPage() {
  useDocumentTitle('Saved addresses');
  const toast = useToast();
  const { user } = useAuth();
  const { addresses, remove, loaded } = useAddresses();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await remove(pendingDelete.id);
      toast.show(`${pendingDelete.label} address deleted`, { tone: 'info' });
      setPendingDelete(null);
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="pb-6">
      <div className="mx-auto max-w-column lg:max-w-[960px] lg:px-8">
        <ScreenHeader title="Saved addresses" backFallback={ROUTES.profile} />
        <div className="px-5 lg:px-0">
          {!loaded ? (
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-5" aria-busy="true">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-[180px] rounded-xl" />
              ))}
            </div>
          ) : !addresses.length ? (
            <EmptyState
              icon={MapPin}
              title="No saved addresses"
              message="Add an address and we will deliver from the kuraat branch nearest to it."
            />
          ) : (
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-5">
              {addresses.map((a) => (
                <Card key={a.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <IconTile icon={a.type === 'office' ? Store : MapPin} size={40} iconSize={19} />
                    <h2 className="min-w-0 flex-1 truncate text-[17px] font-bold leading-6 text-ink">{a.label}</h2>
                    {a.isDefault && <Tag tone="dark">Default</Tag>}
                  </div>
                  <p className="mt-3 text-body text-copy">{formatAddress(a)}</p>
                  <p className="mt-0.5 text-label font-normal text-muted">
                    {a.contactName || user?.name}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Button variant="secondary" size="md" leftIcon={Pencil} to={ROUTES.addressEdit(a.id)}>
                      Edit
                    </Button>
                    <Button variant="secondary" size="md" leftIcon={Trash2} onClick={() => setPendingDelete(a)}>
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <BottomBar>
            <Button block leftIcon={Plus} to={ROUTES.addressNew} className="lg:w-auto lg:min-w-[280px]">
              Add new address
            </Button>
          </BottomBar>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        icon={Trash2}
        title={`Delete ${pendingDelete?.label || 'this'} address?`}
        message={
          pendingDelete?.isDefault && addresses.length > 1
            ? `This is your default address. ${addresses.find((x) => x.id !== pendingDelete.id)?.label} will become your default.`
            : pendingDelete
              ? formatAddress(pendingDelete)
              : ''
        }
        confirmLabel="Delete address"
        cancelLabel="Keep address"
      />
    </div>
  );
}
