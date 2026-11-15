import { useMemo } from 'react';
import { chooseBranch, areaLabel } from '@/domain';
import { useAddresses } from '@/context/AddressContext.jsx';

/**
 * Which branch will deliver to an address (default address unless one is given), for the given
 * products — the client mirror of the backend rule "branch is chosen from the address and stock".
 */
export function useDeliveryBranch(productIds = [], address = null) {
  const { defaultAddress } = useAddresses();
  const target = address || defaultAddress;
  const key = productIds.join('|');
  return useMemo(() => {
    if (!target?.location) return null;
    const choice = chooseBranch(target.location, productIds);
    return { ...choice, address: target, area: areaLabel(target) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, key]);
}
