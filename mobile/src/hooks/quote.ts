import type { Quote } from '@/types/api';
import { useDeliveryQuote as useDeliveryQuoteJs } from './useDeliveryQuote.js';

/**
 * The shared useDeliveryQuote (identical to the web's), typed: the branch the server would deliver
 * from for this address and these products, its distance and slot; answers reused for 30 s.
 */
export const useDeliveryQuote = useDeliveryQuoteJs as unknown as (args: { addressId?: string | null; productIds?: string[] }) => {
  quote: Quote | null;
  loading: boolean;
  error: (Error & { code?: string }) | null;
};
