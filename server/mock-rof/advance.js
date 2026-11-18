/**
 * npm run mock-rof:advance -- <orderNumber> [Status]
 *
 * Plays "branch staff" for the fake ROF: moves an order to the next status on the normal delivery
 * path (AssignedToBranch → BranchAccepted → Preparing → Prepared → AssignedToTechnician →
 * OutForDelivery → Delivered; pickup orders go Prepared → PickUpByCustomer instead), or straight to
 * the status given (e.g. Canceled).
 * The fake ROF must be running (npm run mock-rof).
 */
const [orderNumber, status] = process.argv.slice(2);
if (!orderNumber) {
  console.error('Usage: npm run mock-rof:advance -- <orderNumber> [Status]   e.g. npm run mock-rof:advance -- 20418');
  process.exit(2);
}

const port = Number(process.env.MOCK_ROF_PORT || 8080);
const orderNo = String(orderNumber).replace(/^KR-/i, '');

try {
  const res = await fetch(`http://localhost:${port}/__dev/orders/${orderNo}/advance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(status ? { status } : {}),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error(`Could not advance KR-${orderNo}: ${body.error}`);
    process.exit(1);
  }
  console.log(`KR-${body.orderNumber} is now ${body.status}`);
} catch (error) {
  console.error(`Fake ROF is not reachable on port ${port}. Start it with: npm run mock-rof (${error.message})`);
  process.exit(1);
}
