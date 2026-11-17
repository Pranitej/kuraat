/**
 * Fake ROF — order endpoints (guide §7–§9, status names §11) and dev-only controls used by tests
 * and by `npm run mock-rof:advance`.
 */
import { randomUUID } from 'node:crypto';
import { distanceKm } from '../src/lib/geo.js';

/** Status number ↔ name (guide §11). */
export const STATUS_NAMES = [
  'Created',
  'AwaitingLocation',
  'SharedLocationManually',
  'AssignedToBranch',
  'NotAvailable',
  'Preparing',
  'Prepared',
  'AssignedToTechnician',
  'TechnicianAccepted',
  'PickUpByTechnician',
  'OutForDelivery',
  'Delivered',
  'Canceled',
  'AssignedToAdmin',
  'LocationNotSharedByCustomer',
  'ReAssignedToTechnician',
  'DeliveredWithoutOtp',
  'PickUpByCustomer',
  'BranchAccepted',
  'ActionRequired',
];
const statusNumber = (name) => STATUS_NAMES.indexOf(name);
const label = (name) => name.replace(/([a-z])([A-Z])/g, '$1 $2');

const COMPLETED = ['Delivered', 'DeliveredWithoutOtp', 'PickUpByCustomer', 'Canceled'];
/** The path a delivery order normally takes after it is assigned (used by dev "advance"). */
export const HAPPY_PATH = [
  'Created',
  'AssignedToBranch',
  'BranchAccepted',
  'Preparing',
  'Prepared',
  'AssignedToTechnician',
  'OutForDelivery',
  'Delivered',
];

export function registerOrderRoutes(app, { store, now, ok, fail, availableToSell }) {
  const db = store.data;
  const iso = () => now().toISOString();
  const findOrder = (id) => db.orders.find((o) => o.id === id);
  const productName = (id) => db.products.find((p) => p.id === id)?.name ?? 'Unknown product';
  const branchName = (id) => db.branches.find((b) => b.id === id)?.name ?? null;

  function setStatus(order, to, remarks) {
    order.timeline.push({ statusFrom: order.status, statusTo: to, remarks, createdBy: 'mock', createdOn: iso() });
    order.status = to;
    order.modifiedOn = iso();
  }

  function releaseStock(order) {
    if (!order.assignedToBranch || !order.reserved) return;
    for (const item of order.items) db.stock[item.productId][order.assignedToBranch] += item.quantity;
    order.reserved = false;
  }

  /* ---------- create (guide §7.1) ---------- */

  app.post('/api/orders/manual', async (req, res) => {
    const delay = app.locals.faults.createOrderDelayMs;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (app.locals.faults.createOrderReject) return res.json(fail(app.locals.faults.createOrderReject));
    const b = req.body || {};
    if (!b.customerName || !String(b.customerName).trim()) return res.json(fail('Customer name is required'));
    if (!/^\d{8,15}$/.test(String(b.phoneNumber || ''))) return res.json(fail('Phone number must be digits with country code'));
    if (!Array.isArray(b.items) || b.items.length === 0) return res.json(fail('At least one item is required'));
    for (const item of b.items) {
      const product = db.products.find((p) => p.id === item.productId);
      if (!product) return res.json(fail('Product not found'));
      if (product.status !== 'Active') return res.json(fail(`Product "${product.name}" is not active`));
      if (!Number.isInteger(item.quantity) || item.quantity < 1) return res.json(fail('Quantity must be a whole number of at least 1'));
      const available = availableToSell(product.id);
      if (!product.allowOversell && available < item.quantity) {
        return res.json(fail(`Only ${available} of "${product.name}" available (requested ${item.quantity})`));
      }
    }
    const createdOn = iso();
    const order = {
      id: randomUUID(),
      orderNumber: db.nextOrderNumber,
      status: 'Created',
      customerName: String(b.customerName).trim(),
      phoneNumber: String(b.phoneNumber),
      customerEmail: b.customerEmail ?? null,
      address: b.address ?? null,
      city: b.city ?? null,
      remarks: b.remarks ?? null,
      source: b.source || 'Manual',
      fulfillmentType: b.fulfillmentType || 'Delivery',
      orderType: b.orderType ?? 0,
      country: b.country ?? null,
      province: b.province ?? null,
      latitude: null,
      longitude: null,
      items: b.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      assignedToBranch: null,
      reserved: false,
      createdOn,
      modifiedOn: createdOn,
      timeline: [{ statusFrom: null, statusTo: 'Created', remarks: 'Order created', createdBy: 'mock', createdOn }],
    };
    db.nextOrderNumber += 1;
    db.orders.push(order);
    store.save();
    return res.json(
      ok(
        {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          customerName: order.customerName,
          phoneNumber: order.phoneNumber,
          address: order.address,
          city: order.city,
          assignedToBranch: null,
          createdOn,
          items: order.items,
        },
        'Order created',
      ),
    );
  });

  /* ---------- assign branch (guide §7.2) ---------- */

  app.put('/api/orders/:id/assign/branch', (req, res) => {
    const order = findOrder(req.params.id);
    if (!order) return res.json(fail('Order not found'));
    const branch = db.branches.find((x) => x.id === req.query.BranchId && x.isActive);
    if (!branch) return res.json(fail('Branch not found'));
    if (COMPLETED.includes(order.status)) return res.json(fail('A completed or cancelled order cannot be assigned'));
    releaseStock(order);
    for (const item of order.items) {
      const qty = db.stock[item.productId]?.[branch.id] ?? 0;
      if (qty < item.quantity) return res.json(fail(`Only ${qty} of "${productName(item.productId)}" available`));
    }
    for (const item of order.items) db.stock[item.productId][branch.id] -= item.quantity;
    order.reserved = true;
    order.assignedToBranch = branch.id;
    setStatus(order, 'AssignedToBranch', 'Assigned to branch');
    store.save();
    return res.json(ok(null, 'Order assigned to branch'));
  });

  /* ---------- customer pin (lead's collection) + ROF auto-assignment ---------- */

  // Real ROF assigns "the nearest branch with availability" once it has a location. The fake does
  // the same: nearest active hub whose stock covers every item; none → left for staff.
  app.put('/api/orders/:id/location/shared', (req, res) => {
    if (app.locals.faults.locationReject) return res.json(fail(app.locals.faults.locationReject));
    const order = findOrder(req.params.id);
    if (!order) return res.json(fail('Order not found'));
    if (COMPLETED.includes(order.status)) return res.json(fail('A completed or cancelled order cannot be changed'));
    const lat = Number(req.body?.latitude);
    const lng = Number(req.body?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.json(fail('Latitude and longitude are required'));
    order.latitude = lat;
    order.longitude = lng;
    setStatus(order, 'SharedLocationManually', 'Location shared by customer');
    if (!order.assignedToBranch) {
      const pin = { lat, lng };
      const hubs = db.branches
        .filter((b) => b.isActive && b.isHubBranch)
        .sort((a, b) => distanceKm(pin, { lat: a.latitude, lng: a.longitude }) - distanceKm(pin, { lat: b.latitude, lng: b.longitude }));
      const branch = hubs.find((h) => order.items.every((i) => (db.stock[i.productId]?.[h.id] ?? 0) >= i.quantity));
      if (branch) {
        for (const item of order.items) db.stock[item.productId][branch.id] -= item.quantity;
        order.reserved = true;
        order.assignedToBranch = branch.id;
        setStatus(order, 'AssignedToBranch', 'Assigned to branch automatically');
      }
    }
    store.save();
    return res.json(ok({ status: order.status }, 'Location shared'));
  });

  /* ---------- read (guide §9.1, §9.2, §8 option B) ---------- */

  app.get('/api/orders/by-phone/:phone', (req, res) => {
    const last8 = String(req.params.phone).replace(/\D/g, '').slice(-8);
    const bucket = (s) => (['Delivered', 'DeliveredWithoutOtp', 'PickUpByCustomer'].includes(s) ? 'Delivered' : s === 'Canceled' ? 'Cancelled' : 'In Progress');
    const rows = db.orders
      .filter((o) => o.phoneNumber.slice(-8) === last8)
      .sort((a, b) => b.createdOn.localeCompare(a.createdOn))
      .slice(0, 20)
      .map((o) => {
        const branch = db.branches.find((x) => x.id === o.assignedToBranch);
        return {
          id: `#ORD-${o.orderNumber}`,
          orderId: o.id,
          product: productName(o.items[0].productId),
          qty: o.items[0].quantity,
          price: 0,
          date: o.createdOn,
          status: bucket(o.status),
          branch: branch?.name ?? null,
          branchCity: branch?.city ?? null,
          city: o.city,
        };
      });
    return res.json(ok(rows));
  });

  app.get('/api/orders/:id/timeline', (req, res) => {
    const order = findOrder(req.params.id);
    if (!order) return res.json(fail('Order not found'));
    return res.json(ok(order.timeline.map((r) => ({ ...r, statusToLabel: label(r.statusTo) }))));
  });

  app.get('/api/orders/:id', (req, res) => {
    const o = findOrder(req.params.id);
    if (!o) return res.json(fail('Order not found'));
    const onRoad = statusNumber(o.status) >= 7 && !COMPLETED.includes(o.status);
    return res.json(
      ok({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        customerName: o.customerName,
        phoneNumber: o.phoneNumber,
        address: o.address,
        city: o.city,
        fulfillmentType: o.fulfillmentType === 'Pickup' ? 'Pickup' : null,
        assignedToBranch: o.assignedToBranch,
        assignBranchName: branchName(o.assignedToBranch),
        technicianName: onRoad || o.status === 'Delivered' ? 'Mock Rider' : null,
        remarks: o.remarks,
        createdOn: o.createdOn,
        modifiedOn: o.modifiedOn,
        products: o.items.map((i) => ({ productId: i.productId, productName: productName(i.productId), quantity: i.quantity })),
        timeline: o.timeline.map((r) => ({
          statusFrom: r.statusFrom === null ? null : statusNumber(r.statusFrom),
          statusTo: statusNumber(r.statusTo),
          remarks: r.remarks,
          createdOn: r.createdOn,
        })),
      }),
    );
  });

  /* ---------- cancel (guide §9.4) and delivery code (guide §9.5) ---------- */

  app.put('/api/orders/:id/cancel', (req, res) => {
    const order = findOrder(req.params.id);
    if (!order) return res.json(fail('Order not found'));
    if (COMPLETED.includes(order.status)) return res.json(fail('A completed or already cancelled order cannot be cancelled'));
    releaseStock(order);
    setStatus(order, 'Canceled', 'Cancelled by customer');
    store.save();
    return res.json(ok(null, 'Order cancelled'));
  });

  app.post('/api/orders/:id/resend-otp', (req, res) => {
    const order = findOrder(req.params.id);
    if (!order) return res.json(fail('Order not found'));
    if (order.status !== 'OutForDelivery') return res.json(fail('OTP can only be resent while the order is out for delivery'));
    return res.json(ok(null, 'OTP resent'));
  });

  /* ---------- dev-only controls (no auth; never exist in real ROF) ---------- */

  function advance(order, target) {
    if (COMPLETED.includes(order.status)) return { error: `Order is already ${order.status}` };
    if (!order.assignedToBranch) return { error: 'Assign a branch first (the app does this when the order is placed)' };
    let to = target;
    if (!to) {
      const i = HAPPY_PATH.indexOf(order.status);
      to = HAPPY_PATH[i + 1] ?? 'Delivered';
    }
    if (!STATUS_NAMES.includes(to)) return { error: `Unknown status ${to}` };
    if (to === 'Canceled') releaseStock(order);
    if (['Delivered', 'DeliveredWithoutOtp', 'PickUpByCustomer'].includes(to)) order.reserved = false;
    setStatus(order, to, `Moved to ${label(to)} (dev)`);
    store.save();
    return { status: to };
  }

  app.post('/__dev/orders/:orderNumber/advance', (req, res) => {
    const order = db.orders.find((o) => String(o.orderNumber) === String(req.params.orderNumber));
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const result = advance(order, req.body?.status);
    if (result.error) return res.status(409).json(result);
    return res.json({ orderNumber: order.orderNumber, status: result.status });
  });

  app.post('/__dev/faults', (req, res) => {
    Object.assign(app.locals.faults, req.body || {});
    res.json(app.locals.faults);
  });

  app.post('/__dev/rotate-token-secret', (req, res) => {
    app.locals.tokenSecret = randomUUID();
    res.json({ rotated: true });
  });

  /** Moves every assigned, unfinished order one step (MOCK_AUTO_ADVANCE_SECONDS). */
  return {
    advanceAll() {
      for (const order of db.orders) {
        if (order.assignedToBranch && !COMPLETED.includes(order.status)) advance(order);
      }
    },
  };
}
