import { describe, expect, test } from 'vitest';
import { STATUS_LABEL, canCancel, canResendCode, isTerminal, stepOf, stepTimes } from '../../src/rof/status.js';

// Spec §6.8 / guide §9.2: every ROF status name and the UI step it belongs to.
const EXPECTED = {
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

describe('status mapping', () => {
  test.each(Object.entries(EXPECTED))('%s → step %s', (name, step) => {
    expect(stepOf(name)).toBe(step);
  });

  test('unknown statuses (e.g. transfer statuses) map to null', () => {
    expect(stepOf('TransferRequested')).toBeNull();
    expect(stepOf(undefined)).toBeNull();
  });

  test('terminal statuses', () => {
    expect(['Delivered', 'DeliveredWithoutOtp', 'PickUpByCustomer', 'Canceled'].every(isTerminal)).toBe(true);
    expect(isTerminal('OutForDelivery')).toBe(false);
  });

  test('cancel only in step 0; resend code only while OutForDelivery', () => {
    expect(canCancel('BranchAccepted')).toBe(true);
    expect(canCancel('Preparing')).toBe(false);
    expect(canCancel('Canceled')).toBe(false);
    expect(canResendCode('OutForDelivery')).toBe(true);
    expect(canResendCode('PickUpByTechnician')).toBe(false);
  });

  test('labels', () => {
    expect(STATUS_LABEL).toEqual({ 0: 'Confirmed', 1: 'Preparing', 2: 'Out for delivery', 3: 'Delivered', cancelled: 'Cancelled' });
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
    expect(times).toEqual({ 0: 't0', 1: 't2', 2: 't4' });
  });

  test('cancelled time', () => {
    expect(stepTimes([{ status: 'Created', at: 't0' }, { status: 'Canceled', at: 't9' }])).toEqual({ 0: 't0', cancelled: 't9' });
  });
});
