/**
 * Background status check (guide §12 "Polling"): every ORDER_POLL_INTERVAL_MS, re-read each
 * unfinished order from ROF so status changes become notifications even when nobody has the app
 * open. Webhooks (guide §12) can replace this later without changing the app.
 * Never throws: failures are logged and retried on the next tick. Overlapping ticks are skipped.
 */
export function createOrderPoller({ ctx, intervalMs = ctx.config.pollIntervalMs }) {
  let timer = null;
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      const rows = await ctx.db('orders')
        .where({ cancelled: false })
        .andWhere((q) => q.whereNull('step').orWhere('step', '<', 3))
        .orderBy('created_at')
        .limit(500);
      for (const row of rows) {
        try {
          await ctx.orders.refresh(row, { maxAgeMs: intervalMs / 2 });
        } catch (error) {
          ctx.logger.error(`[poller] KR-${row.rof_order_number}: ${error.message}`);
        }
      }
    } catch (error) {
      ctx.logger.error(`[poller] tick failed: ${error.message}`);
    } finally {
      running = false;
    }
  }

  return {
    tick,
    start() {
      if (timer) return;
      timer = setInterval(tick, intervalMs);
      timer.unref?.();
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
  };
}
