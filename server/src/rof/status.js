/**
 * ROF order status → the app's 4 tracking steps (+ cancelled). Guide §9.2 / §11, design spec §6.8.
 * ROF's GET /api/orders/... endpoints return status NAMES, which is what these functions take.
 */

export const STEP = { CONFIRMED: 0, PREPARING: 1, OUT_FOR_DELIVERY: 2, DELIVERED: 3 };

const STEP_BY_STATUS = {
  Created: 0,
  AwaitingLocation: 0,
  SharedLocationManually: 0,
  AssignedToBranch: 0,
  AssignedToAdmin: 0,
  LocationNotSharedByCustomer: 0,
  BranchAccepted: 0,
  ActionRequired: 0,
  NotAvailable: 1,
  Preparing: 1,
  Prepared: 1,
  AssignedToTechnician: 2,
  TechnicianAccepted: 2,
  PickUpByTechnician: 2,
  ReAssignedToTechnician: 2,
  OutForDelivery: 2,
  Delivered: 3,
  DeliveredWithoutOtp: 3,
  PickUpByCustomer: 3,
  Canceled: 'cancelled',
};

const TERMINAL = new Set(['Delivered', 'DeliveredWithoutOtp', 'PickUpByCustomer', 'Canceled']);

export const STATUS_LABEL = { 0: 'Confirmed', 1: 'Preparing', 2: 'Out for delivery', 3: 'Delivered', cancelled: 'Cancelled' };

/** 0–3, 'cancelled', or null for a status we do not know (e.g. transfer statuses 20–27). */
export const stepOf = (name) => (Object.hasOwn(STEP_BY_STATUS, name ?? '') ? STEP_BY_STATUS[name] : null);

export const isTerminal = (name) => TERMINAL.has(name);

/** Customers may cancel only before the branch starts preparing (agreed default, spec §6.8). */
export const canCancel = (name) => stepOf(name) === STEP.CONFIRMED;

/** ROF resends the delivery code only while the order is OutForDelivery (guide §9.5). */
export const canResendCode = (name) => name === 'OutForDelivery';

/**
 * When each step was reached: the first timeline row (oldest first) whose status belongs to it.
 * @param {{ status: string, at: string }[]} timeline
 */
export function stepTimes(timeline = []) {
  const times = {};
  for (const row of timeline) {
    const step = stepOf(row.status);
    if (step !== null && times[step] === undefined) times[step] = row.at;
  }
  return times;
}
