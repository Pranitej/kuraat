/**
 * RSOF payment links (lead's note, 19 Nov 2026): `POST /api/v1/orders/payment-link` with an API key
 * that has the `payments.link` scope (header X-Api-Key — NOT the Bearer login the rest of the ROF client uses).
 *
 * "Create or get": for an order that is not paid yet RSOF answers the live link (a new one when none is
 * live). The customer pays on RSOF's own page; RSOF keeps the payment. The answer's `data.outcome` says:
 *   LinkReady       → data.paymentLink is the page to open (data.expiresAt, data.reused)
 *   AlreadyPaid     → the order is paid
 *   NoPayableOrder  → no payable order has this number and phone (cancelled, wrong phone, …)
 *   NotReady        → the order or RSOF's payment settings are not ready
 *   Error           → temporary problem on RSOF's side; try again later
 * RSOF sends no WhatsApp message for this call: the apps open the link themselves.
 *
 * Returns RSOF's `data` as is; throws RofError for anything that is not one of those outcomes.
 */
import { RofError } from './errors.js';

export const PAYMENT_LINK_PATH = '/api/v1/orders/payment-link';
export const PAYMENT_OUTCOMES = ['LinkReady', 'AlreadyPaid', 'NoPayableOrder', 'NotReady', 'Error'];

export function createPaymentLinkClient({ baseUrl, apiKey, timeoutMs = 10000 }) {
  const url = baseUrl.replace(/\/+$/, '') + PAYMENT_LINK_PATH;

  return {
    /**
     * @param {{ orderNumber: number, phone: string }} input  phone in RSOF's format (country code, no "+"); it must match the order
     * @returns {Promise<{ outcome: string, orderNumber?: number, amount?: number, currency?: string, paymentLink?: string|null, expiresAt?: string|null, reused?: boolean, message?: string }>}
     */
    async createLink({ orderNumber, phone }) {
      let res;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ orderNumber: Number(orderNumber), phone: String(phone) }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw new RofError('unavailable', `ROF POST ${PAYMENT_LINK_PATH} failed: ${error.message}`, { path: PAYMENT_LINK_PATH });
      }
      // A refused key (or one without the payments.link scope) is a set-up problem, not the customer's.
      if (res.status === 401 || res.status === 403) {
        throw new RofError('auth', `ROF refused the payment API key (HTTP ${res.status}) — check ROF_API_KEY and its payments.link scope`, {
          status: res.status,
          path: PAYMENT_LINK_PATH,
        });
      }
      const json = await res.json().catch(() => null);
      const data = json && typeof json === 'object' ? json.data : null;
      // The outcome is the answer, whatever `success` says (RSOF may send success:false with NoPayableOrder).
      if (data && PAYMENT_OUTCOMES.includes(data.outcome)) return data;
      if (res.status === 429 || res.status >= 500 || res.status === 404 || !json) {
        // 404: on 19 Nov 2026 UAT answered "Cannot POST /api/v1/orders/payment-link" — the API is not live there yet.
        throw new RofError('unavailable', `ROF POST ${PAYMENT_LINK_PATH} answered HTTP ${res.status}${json?.message ? `: ${json.message}` : ''}`, {
          status: res.status,
          path: PAYMENT_LINK_PATH,
        });
      }
      throw new RofError('rejected', json.message || `ROF rejected the payment link request (HTTP ${res.status})`, { status: res.status, path: PAYMENT_LINK_PATH });
    },
  };
}
