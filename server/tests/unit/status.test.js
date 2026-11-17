import { describe, expect, test } from 'vitest';
import { FALLBACK_BY_STEP, canCancel, canResendCode, isTerminal, normalizeStatus, statusInfo, stepOf, stepTimes } from '../../src/rof/status.js';

// Design 2026-11-18 §5.1 (ROF's status list, codes 0–19):
// [code, ROF name, customer label, step (delivery), step (pickup), filter group]
const TABLE = [
  [0, 'Created', 'Order placed', 0, 0, 'placed'],
  [1, 'AwaitingLocation', 'Confirming your location', 0, 0, 'placed'],
  [2, 'SharedLocationManually', 'Location received', 0, 0, 'placed'],
  [3, 'AssignedToBranch', 'Sent to branch', 0, 0, 'placed'],
  [18, 'BranchAccepted', 'Branch accepted', 0, 0, 'placed'],
  [4, 'NotAvailable', 'Checking availability', 0, 0, 'attention'],
  [13, 'AssignedToAdmin', 'Being reviewed', 0, 0, 'attention'],
  [14, 'LocationNotSharedByCustomer', 'Location needed', 0, 0, 'attention'],
  [19, 'ActionRequired', 'Being reviewed', 0, 0, 'attention'],
  [5, 'Preparing', 'Preparing', 1, 1, 'preparing'],
  [7, 'AssignedToTechnician', 'Rider assigned', 1, 1, 'preparing'],
  [8, 'TechnicianAccepted', 'Rider assigned', 1, 1, 'preparing'],
  [15, 'ReAssignedToTechnician', 'Rider assigned', 1, 1, 'preparing'],
  [9, 'PickUpByTechnician', 'Out for delivery', 2, 2, 'on_the_way'],
  [10, 'OutForDelivery', 'Out for delivery', 2, 2, 'on_the_way'],
  [11, 'Delivered', 'Delivered', 3, 3, 'completed'],
  [16, 'DeliveredWithoutOtp', 'Delivered', 3, 3, 'completed'],
  [17, 'PickUpByCustomer', 'Picked up', 3, 3, 'completed'],
  [12, 'Canceled', 'Cancelled', 'cancelled', 'cancelled', 'cancelled'],
];

describe('statusInfo', () => {
  test.each(TABLE)('%i %s → "%s", step %s / pickup %s, group %s', (code, name, label, step, pickupStep, group) => {
    expect(statusInfo(name)).toEqual({ name, step, label, group });
    expect(statusInfo(code)).toEqual({ name, step, label, group });
    expect(statusInfo(name, 'pickup').step).toBe(pickupStep);
  });

  test('Prepared reads differently for delivery and pickup', () => {
    expect(statusInfo('Prepared')).toEqual({ name: 'Prepared', step: 1, label: 'Packed, waiting for a rider', group: 'preparing' });
    expect(statusInfo(6, 'pickup')).toEqual({ name: 'Prepared', step: 2, label: 'Ready for pickup', group: 'ready' });
  });

  test('transfer and unknown statuses have no info', () => {
    expect(statusInfo(22)).toBeNull();
    expect(statusInfo('TransferRequested')).toBeNull();
    expect(statusInfo(undefined)).toBeNull();
  });

  test('stepOf follows the table', () => {
    expect(stepOf('Prepared')).toBe(1);
    expect(stepOf('Prepared', 'pickup')).toBe(2);
    expect(stepOf(10)).toBe(2);
    expect(stepOf('TransferRequested')).toBeNull();
  });

  test('fallback label and group per step for statuses we do not know', () => {
    expect(FALLBACK_BY_STEP).toEqual([
      { label: 'Order placed', group: 'placed' },
      { label: 'Preparing', group: 'preparing' },
      { label: 'Out for delivery', group: 'on_the_way' },
      { label: 'Delivered', group: 'completed' },
    ]);
  });
});

describe('normalizeStatus', () => {
  test('numbers and numeric strings become names', () => {
    expect(normalizeStatus(5)).toBe('Preparing');
    expect(normalizeStatus('5')).toBe('Preparing');
    expect(normalizeStatus(0)).toBe('Created');
  });

  test('names stay; transfer codes and blanks give null; unknown names pass through', () => {
    expect(normalizeStatus('Preparing')).toBe('Preparing');
    expect(normalizeStatus(22)).toBeNull();
    expect(normalizeStatus('TransferInTransit')).toBe('TransferInTransit');
    expect(normalizeStatus(null)).toBeNull();
    expect(normalizeStatus('')).toBeNull();
  });
});

describe('rules', () => {
  test('cancel while the order is still in its first step', () => {
    for (const code of [0, 1, 2, 3, 4, 13, 14, 18, 19]) expect(canCancel(code)).toBe(true);
    for (const code of [5, 6, 10, 11, 12]) expect(canCancel(code)).toBe(false);
    expect(canCancel('BranchAccepted')).toBe(true);
  });

  test('resend the delivery code only while out for delivery', () => {
    expect(canResendCode(10)).toBe(true);
    expect(canResendCode('OutForDelivery')).toBe(true);
    expect(canResendCode(9)).toBe(false);
  });

  test('terminal statuses', () => {
    expect([11, 16, 17, 12].every((c) => isTerminal(c))).toBe(true);
    expect(['Delivered', 'DeliveredWithoutOtp', 'PickUpByCustomer', 'Canceled'].every((n) => isTerminal(n))).toBe(true);
    expect(isTerminal(5)).toBe(false);
  });
});

describe('stepTimes', () => {
  test('first row of each reached step wins; unknown rows ignored', () => {
    const times = stepTimes([
      { status: 'Created', at: 't0' },
      { status: 'AssignedToBranch', at: 't1' },
      { status: 'Preparing', at: 't2' },
      { status: 'Prepared', at: 't3' },
      { status: 'TransferRequested', at: 't3b' },
      { status: 'AssignedToTechnician', at: 't4' },
      { status: 'OutForDelivery', at: 't5' },
    ]);
    expect(times).toEqual({ 0: 't0', 1: 't2', 2: 't5' });
  });

  test('numeric rows count too', () => {
    expect(stepTimes([{ status: 5, at: 'x' }])).toEqual({ 1: 'x' });
  });

  test('pickup: Prepared is the "ready" step', () => {
    expect(stepTimes([{ status: 'Prepared', at: 'r' }], 'pickup')).toEqual({ 2: 'r' });
  });

  test('cancelled time', () => {
    expect(stepTimes([{ status: 'Created', at: 't0' }, { status: 'Canceled', at: 't9' }])).toEqual({ 0: 't0', cancelled: 't9' });
  });
});
