// btc-race-bot: long-only trend follower for 1-minute cbBTC/USDC bars.
//
// Strategy (validated on the published 24h dev window with a local replay that
// mirrors the harness fill model: next-open fills, 4 bps fee, 2 bps slippage,
// constant-product impact against pool depth):
//
//   * Entry: EMA(20) above EMA(120) by more than 10 bps — a confirmed trend,
//     not a 1-minute wiggle. One position at a time, 50% of equity, so a bad
//     day cannot draw the account down anywhere near the 25% guardrail.
//   * Exit: the whole position when EMA(20) falls below EMA(120), or below
//     EMA(60) (a faster exit that protects gains when the trend turns).
//   * Cooldown: after an exit, no re-entry for 120 bars (2h). On 1-minute
//     bars with ~22 bps round-trip costs, re-entering immediately after an
//     exit is pure churn: every fast-exit variant without a cooldown lost
//     money in backtests, while the cooldown version kept 4 trades and a
//     positive PnL across a wide parameter neighbourhood.
//   * A bar with zero volume signals nothing (its close still feeds the EMAs).
//
// Deterministic: float64 EMA math on closes alone, no clock, no randomness,
// no network, no files. The same bars always produce the same orders.
//
// Dev-window result (local replay of the frozen 24h window): net PnL
// +$3.78 over 4 trades.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const FAST = 20; // entry fast EMA span, in 1-minute bars
const SLOW = 120; // entry slow EMA span
const EXIT_SLOW = 60; // faster exit EMA span
const GAP_BPS = 10; // entry needs fast > slow by more than this many bps
const SIZE_BPS = 5000; // buy at most 50% of equity per entry
const COOLDOWN_BARS = 120; // bars to wait after an exit before re-entering
const MAX_SLIPPAGE_BPS = 100; // 1% past the close the order was decided on

/** Mean of an array, summed left-to-right. */
function mean(xs: number[]): number {
  return xs.reduce((a, x) => a + x, 0) / xs.length;
}

/** One EMA: seeded as the mean of its first span of closes, then moving
 *  2 / (span + 1) of the way to each new close. */
class Ema {
  readonly span: number;
  private warm: number[] = [];
  value: number | null = null;

  constructor(span: number) {
    this.span = span;
  }

  step(close: number): void {
    if (this.value !== null) {
      this.value += (2 / (this.span + 1)) * (close - this.value);
      return;
    }
    this.warm.push(close);
    if (this.warm.length === this.span) this.value = mean(this.warm);
  }
}

class Series {
  fast = new Ema(FAST);
  slow = new Ema(SLOW);
  exitSlow = new Ema(EXIT_SLOW);
  /** (fast - slow) / slow after this bar, once both are set. */
  gap: number | null = null;
  /** Fast below the exit EMA after this bar. */
  exitDown = false;

  push(close: number): void {
    this.fast.step(close);
    this.slow.step(close);
    this.exitSlow.step(close);
    this.gap =
      this.fast.value !== null && this.slow.value !== null
        ? (this.fast.value - this.slow.value) / this.slow.value
        : null;
    this.exitDown =
      this.fast.value !== null && this.exitSlow.value !== null && this.fast.value < this.exitSlow.value;
  }
}

const series = new Map<string, Series>();
let lastExitSeq = -1e9;

await runBars({
  onBatch(state: BarsState, batch) {
    const fresh = new Map<string, Series>();
    for (const bar of batch.bars) {
      let s = series.get(bar.symbol);
      if (s === undefined) {
        s = new Series();
        series.set(bar.symbol, s);
      }
      s.push(Number(bar.c));
      if (bar.v !== '0') fresh.set(bar.symbol, s);
    }
    if (state.warmingUp) return [];

    const orders: (BuyInput | SellInput)[] = [];
    const { caps, fees } = state.hello;
    for (const { symbol } of state.hello.symbols) {
      const s = fresh.get(symbol);
      if (s === undefined) continue;
      const held = state.positions.get(symbol);
      if (held !== undefined) {
        // Exit the whole position: trend reversed, or the faster exit fired.
        if (s.gap !== null && (s.gap < 0 || s.exitDown)) {
          orders.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
          lastExitSeq = state.seq;
        }
      } else if (
        s.gap !== null &&
        s.gap * 10000 > GAP_BPS &&
        state.seq - lastExitSeq >= COOLDOWN_BARS
      ) {
        let stake = (state.equity * BigInt(SIZE_BPS)) / 10000n;
        const room = state.weightRoom(symbol);
        if (room < stake) stake = room;
        if (state.cash < stake) stake = state.cash;
        if (stake >= BigInt(fees.min_notional_quote_units)) {
          orders.push({ side: 'buy', symbol, notional_quote_units: stake, max_slippage_bps: MAX_SLIPPAGE_BPS });
        }
      }
    }
    return orders.slice(0, caps.max_orders_per_bar);
  },
});
