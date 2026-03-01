// ============================================================================
// ArbCFO Risk Engine — TypeScript Mirror
// ============================================================================
// This is a 1:1 port of the Rust Stylus contract logic for client-side
// visualization. In production, the Stylus contract is the source of truth;
// this module drives the dashboard UI.
//
// Same algorithm: EMA + MAD + 4D composite scoring + circuit breaker
// ============================================================================

export interface VendorStats {
  txCount: number;
  emaAmount: number;   // in USDC (not fixed-point)
  emaMad: number;      // in USDC
  lastTimestamp: number;
  currentEpoch: number;
  epochVolume: number;  // in USDC
}

export interface RiskBreakdown {
  compositeScore: number;     // 0-100
  isSafe: boolean;
  circuitBreaker: boolean;
  dimensions: {
    newVendor: { score: number; weight: number; detail: string };
    velocity: { score: number; weight: number; detail: string };
    volume: { score: number; weight: number; detail: string };
    deviation: { score: number; weight: number; detail: string };
  };
  recommendation: string;
}

// ─── Constants (mirrors Rust) ───
const ALPHA = 0.1;
const ONE_MINUS_ALPHA = 0.9;
const MAD_MULTIPLIER = 3.0;
const MIN_CV = 0.10;
const RISK_THRESHOLD = 70;
const VELOCITY_WINDOW = 300; // 5 minutes
const SECONDS_PER_DAY = 86400;
const DEFAULT_DAILY_CAP = 100_000; // $100k USDC
const NEW_VENDOR_THRESHOLD = 5;

const WEIGHT_NEW_VENDOR = 30;
const WEIGHT_VELOCITY = 20;
const WEIGHT_VOLUME = 25;
const WEIGHT_DEVIATION = 25;

/**
 * Evaluate risk for a payment — mirrors the Rust contract exactly.
 */
export function evaluateRisk(
  stats: VendorStats,
  amount: number,
  timestamp: number
): RiskBreakdown {
  const { txCount, emaAmount, emaMad, lastTimestamp, currentEpoch, epochVolume } = stats;

  // ── Dimension 1: New Vendor Risk (0-30) ──
  let newVendorScore: number;
  let newVendorDetail: string;

  if (txCount === 0) {
    newVendorScore = WEIGHT_NEW_VENDOR;
    newVendorDetail = "First transaction from unknown vendor";
  } else if (txCount < NEW_VENDOR_THRESHOLD) {
    newVendorScore = Math.round(
      ((NEW_VENDOR_THRESHOLD - txCount) / NEW_VENDOR_THRESHOLD) * WEIGHT_NEW_VENDOR
    );
    newVendorDetail = `${txCount}/${NEW_VENDOR_THRESHOLD} transactions — building trust`;
  } else {
    newVendorScore = 0;
    newVendorDetail = `Established vendor (${txCount} transactions)`;
  }

  // ── Dimension 2: Velocity Risk (0-20) ──
  let velocityScore: number;
  let velocityDetail: string;

  if (txCount === 0 || lastTimestamp === 0) {
    velocityScore = 0;
    velocityDetail = "First transaction — no velocity signal";
  } else if (timestamp > lastTimestamp) {
    const gap = timestamp - lastTimestamp;
    if (gap < VELOCITY_WINDOW) {
      velocityScore = WEIGHT_VELOCITY;
      velocityDetail = `${Math.round(gap)}s since last payment (< 5min threshold)`;
    } else if (gap < VELOCITY_WINDOW * 2) {
      velocityScore = Math.round(WEIGHT_VELOCITY / 2);
      velocityDetail = `${Math.round(gap / 60)}min since last payment (5-10min range)`;
    } else {
      velocityScore = 0;
      const gapHours = gap / 3600;
      velocityDetail = gapHours >= 24
        ? `${Math.round(gapHours / 24)}d since last payment`
        : `${Math.round(gapHours)}h since last payment`;
    }
  } else {
    velocityScore = 0;
    velocityDetail = "Normal timing";
  }

  // ── Dimension 3: Volume Risk (0-25) ──
  const epoch = timestamp > 0 ? Math.floor(timestamp / SECONDS_PER_DAY) : 0;
  const activeVolume =
    epoch > currentEpoch && currentEpoch > 0
      ? amount
      : epochVolume + amount;

  let volumeScore: number;
  let volumeDetail: string;

  if (activeVolume > DEFAULT_DAILY_CAP) {
    volumeScore = WEIGHT_VOLUME;
    volumeDetail = `$${formatNum(activeVolume)} exceeds $${formatNum(DEFAULT_DAILY_CAP)} daily cap`;
  } else if (DEFAULT_DAILY_CAP > 0) {
    const ratio = activeVolume / DEFAULT_DAILY_CAP;
    const ratioSq = ratio * ratio;
    volumeScore = Math.min(Math.round(ratioSq * WEIGHT_VOLUME), WEIGHT_VOLUME);
    const pct = Math.round(ratio * 100);
    volumeDetail = `$${formatNum(activeVolume)} of $${formatNum(DEFAULT_DAILY_CAP)} daily cap (${pct}%)`;
  } else {
    volumeScore = 0;
    volumeDetail = "No daily cap configured";
  }

  // ── Dimension 4: Deviation Risk (0-25) ──
  let deviationScore: number;
  let deviationDetail: string;
  let circuitBreaker = false;

  if (txCount < 2) {
    deviationScore = 0;
    deviationDetail = "Insufficient history for deviation analysis";
  } else {
    const deviation = Math.abs(amount - emaAmount);
    const minMad = emaAmount * MIN_CV;
    const effectiveMad = Math.max(emaMad, minMad);

    if (effectiveMad === 0) {
      deviationScore = 0;
      deviationDetail = "Zero baseline — cannot compute deviation";
    } else {
      const madRatio = deviation / effectiveMad;

      // Circuit breaker: >10× MAD from established vendor
      const tenMad = (MAD_MULTIPLIER * 10) / 3;
      if (madRatio > tenMad && txCount >= NEW_VENDOR_THRESHOLD) {
        circuitBreaker = true;
        deviationScore = WEIGHT_DEVIATION;
        deviationDetail = `CIRCUIT BREAKER: ${madRatio.toFixed(1)}× MAD (>${tenMad.toFixed(0)}× threshold)`;
      } else if (madRatio <= 1) {
        deviationScore = 0;
        deviationDetail = `${madRatio.toFixed(2)}× MAD — within normal range`;
      } else if (madRatio >= MAD_MULTIPLIER) {
        deviationScore = WEIGHT_DEVIATION;
        deviationDetail = `${madRatio.toFixed(1)}× MAD — significant anomaly (>${MAD_MULTIPLIER}× threshold)`;
      } else {
        const excess = madRatio - 1;
        const range = MAD_MULTIPLIER - 1;
        deviationScore = Math.min(Math.round((excess / range) * WEIGHT_DEVIATION), WEIGHT_DEVIATION);
        deviationDetail = `${madRatio.toFixed(2)}× MAD — elevated (1-${MAD_MULTIPLIER}× range)`;
      }
    }
  }

  // ── Composite ──
  let compositeScore: number;
  let isSafe: boolean;

  if (circuitBreaker) {
    compositeScore = 100;
    isSafe = false;
  } else {
    compositeScore = Math.min(
      newVendorScore + velocityScore + volumeScore + deviationScore,
      100
    );
    isSafe = compositeScore <= RISK_THRESHOLD;
  }

  // ── Recommendation ──
  let recommendation: string;
  if (circuitBreaker) {
    recommendation = "BLOCK — Extreme deviation detected. Circuit breaker triggered. Route to manual review immediately.";
  } else if (compositeScore > RISK_THRESHOLD) {
    recommendation = "HOLD — Risk score exceeds threshold. Requires multisig approval before execution.";
  } else if (compositeScore > 40) {
    recommendation = "CAUTION — Elevated risk signals detected. Review recommended but auto-execution permitted.";
  } else if (compositeScore > 15) {
    recommendation = "PASS — Minor risk signals within acceptable range. Safe for auto-execution.";
  } else {
    recommendation = "CLEAR — All risk signals nominal. Auto-execution approved.";
  }

  return {
    compositeScore,
    isSafe,
    circuitBreaker,
    dimensions: {
      newVendor: { score: newVendorScore, weight: WEIGHT_NEW_VENDOR, detail: newVendorDetail },
      velocity: { score: velocityScore, weight: WEIGHT_VELOCITY, detail: velocityDetail },
      volume: { score: volumeScore, weight: WEIGHT_VOLUME, detail: volumeDetail },
      deviation: { score: deviationScore, weight: WEIGHT_DEVIATION, detail: deviationDetail },
    },
    recommendation,
  };
}

/**
 * Update vendor stats after a safe transaction (mirrors Rust EMA/MAD update).
 * Returns new stats. Does NOT mutate input.
 */
export function updateStats(
  stats: VendorStats,
  amount: number,
  timestamp: number
): VendorStats {
  const epoch = timestamp > 0 ? Math.floor(timestamp / SECONDS_PER_DAY) : 0;
  const activeVolume =
    epoch > stats.currentEpoch && stats.currentEpoch > 0
      ? amount
      : stats.epochVolume + amount;

  if (stats.txCount === 0) {
    return {
      txCount: 1,
      emaAmount: amount,
      emaMad: 0,
      lastTimestamp: timestamp,
      currentEpoch: epoch,
      epochVolume: activeVolume,
    };
  }

  const deviation = Math.abs(amount - stats.emaAmount);
  return {
    txCount: stats.txCount + 1,
    emaAmount: ALPHA * amount + ONE_MINUS_ALPHA * stats.emaAmount,
    emaMad: ALPHA * deviation + ONE_MINUS_ALPHA * stats.emaMad,
    lastTimestamp: timestamp,
    currentEpoch: epoch,
    epochVolume: activeVolume,
  };
}

/**
 * Create empty stats for a new vendor.
 */
export function emptyStats(): VendorStats {
  return {
    txCount: 0,
    emaAmount: 0,
    emaMad: 0,
    lastTimestamp: 0,
    currentEpoch: 0,
    epochVolume: 0,
  };
}

/**
 * Generate simulated vendor stats from seed data for demo purposes.
 * Produces realistic-looking stats for established vendors.
 */
export function simulateVendorStats(
  vendorAddress: string,
  avgAmount: number,
  txCount: number
): VendorStats {
  const now = Math.floor(Date.now() / 1000);
  const variance = avgAmount * 0.05; // 5% natural variation
  return {
    txCount,
    emaAmount: avgAmount + (hashCode(vendorAddress) % 100 - 50) * (avgAmount / 1000),
    emaMad: variance + (hashCode(vendorAddress + "mad") % 50) * (variance / 100),
    lastTimestamp: now - 86400 * (1 + (hashCode(vendorAddress + "ts") % 5)),
    currentEpoch: Math.floor(now / 86400),
    epochVolume: avgAmount * (0.3 + (hashCode(vendorAddress + "vol") % 70) / 100),
  };
}

// Helpers
function formatNum(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : n.toFixed(0);
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
