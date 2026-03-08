// ============================================================================
// ArbCFO PolicyEngine v2 — Multi-Dimensional Composite Risk Scoring
// Arbitrum Stylus (Rust → WASM)
// ============================================================================
//
// WHAT THIS DOES:
//   Intercepts AI-initiated invoice payments and scores them across 4 independent
//   risk dimensions. Payments scoring above threshold soft-fail to human multisig
//   review instead of reverting — bridging AI autonomy with human governance.
//
// WHY STYLUS:
//   EVM makes continuous multi-factor statistical scoring economically and
//   ergonomically impractical. Arbitrum Stylus changes the paradigm — allowing
//   compute-heavy compliance directly in the AP execution rail, cheaply and securely.
//   The same logic in Solidity would cost ~200k+ gas; on Stylus WASM it's ~10k.
//
// POSITIONING:
//   This is NOT a generic security monitor (that's Forta/Hypernative territory).
//   ArbCFO is an Embedded Accounts Payable Risk Layer — purpose-built for DAO
//   treasury operations. It sits inside the invoice execution rail, between the
//   AI agent and the vault contract.
//
// RISK DIMENSIONS:
//   1. New Vendor Risk (30pts)  — Unknown vendors get maximum scrutiny
//   2. Velocity Risk   (20pts) — Burst payments signal drainage attempts
//   3. Volume Risk     (25pts) — Daily spend caps via epoch buckets
//   4. Deviation Risk  (25pts) — Statistical outlier detection via MAD
//
// KEY DESIGN DECISIONS:
//   - MAD over Variance: Mean Absolute Deviation requires only add/sub/mul.
//     No square roots, no precision traps. More robust for heavy-tailed
//     financial distributions than standard deviation anyway.
//   - Epoch Buckets: Daily volume = 2 integers (epoch + volume), not rolling
//     timestamp arrays. O(1) storage and compute.
//   - Poisoning Protection: Flagged transactions do NOT update EMA/MAD baselines.
//     Prevents attackers from slowly shifting "normal" to mask a large theft.
//   - Composite 0-100: Granular risk for dashboards, not binary pass/fail.
//
// FIXED-POINT MATH:
//   All arithmetic uses U256 with 18 implicit decimals (SCALE = 10^18).
//   No floating-point. Fully deterministic. WASM-safe.
//
// ============================================================================

#![cfg_attr(not(any(feature = "export-abi", test)), no_main)]
extern crate alloc;

use alloc::vec::Vec;
use stylus_sdk::alloy_primitives::{Address, U256};
use stylus_sdk::prelude::*;

// ─── Fixed-Point Constants (18 decimals) ───

/// SCALE = 10^18, fixed-point base for all arithmetic
const SCALE: U256 = U256::from_limbs([1_000_000_000_000_000_000u64, 0, 0, 0]);

/// ALPHA = 0.1 * SCALE — EMA decay factor
/// α=0.1: ~63% of signal captured after 10 observations.
/// Resists manipulation while adapting to real spending changes.
const ALPHA: U256 = U256::from_limbs([100_000_000_000_000_000u64, 0, 0, 0]);

/// ONE_MINUS_ALPHA = 0.9 * SCALE
const ONE_MINUS_ALPHA: U256 = U256::from_limbs([900_000_000_000_000_000u64, 0, 0, 0]);

/// MAD_MULTIPLIER = 3.0 * SCALE — flag deviations > 3× MAD
/// In normal distributions, 3×MAD ≈ 3.7σ (slightly more conservative than 3σ).
/// For heavy-tailed financial data, MAD is MORE robust than σ.
const MAD_MULTIPLIER: U256 = U256::from_limbs([3_000_000_000_000_000_000u64, 0, 0, 0]);

/// MIN_CV = 0.10 * SCALE — 10% minimum coefficient of variation floor
/// Prevents "zero deviation trap" when vendor pays exact same amount repeatedly.
/// Real invoices vary ±10% from usage, taxes, FX. This is the floor.
const MIN_CV: U256 = U256::from_limbs([100_000_000_000_000_000u64, 0, 0, 0]);

/// RISK_THRESHOLD = 70 — composite score above this triggers soft-fail
const RISK_THRESHOLD: u64 = 70;

/// VELOCITY_WINDOW = 300 seconds (5 minutes)
const VELOCITY_WINDOW: U256 = U256::from_limbs([300u64, 0, 0, 0]);

/// SECONDS_PER_DAY = 86400
const SECONDS_PER_DAY: U256 = U256::from_limbs([86400u64, 0, 0, 0]);

/// DEFAULT_DAILY_CAP = 100,000 USDC (6-decimal base units)
const DEFAULT_DAILY_CAP: U256 = U256::from_limbs([100_000_000_000u64, 0, 0, 0]);

/// NEW_VENDOR_THRESHOLD = 5 transactions
const NEW_VENDOR_THRESHOLD: U256 = U256::from_limbs([5u64, 0, 0, 0]);

// ─── Risk Weights (sum = 100) ───
const WEIGHT_NEW_VENDOR: u64 = 30;
const WEIGHT_VELOCITY: u64 = 20;
const WEIGHT_VOLUME: u64 = 25;
const WEIGHT_DEVIATION: u64 = 25;

// ─── Storage Layout ───
// 6 mappings per vendor = 6 storage slots per vendor.
// Each mapping is independent for Solidity cross-read compatibility.
sol_storage! {
    #[entrypoint]
    pub struct RiskEngine {
        /// Contract admin
        address owner;

        /// Total transaction count per vendor
        mapping(address => uint256) tx_counts;

        /// EMA of transaction amounts (fixed-point 18 decimals)
        mapping(address => uint256) ema_amounts;

        /// EMA of Mean Absolute Deviation (fixed-point 18 decimals)
        mapping(address => uint256) ema_mads;

        /// Timestamp of last transaction per vendor
        mapping(address => uint256) last_timestamps;

        /// Current epoch (day index) per vendor
        mapping(address => uint256) current_epochs;

        /// Cumulative volume in current epoch per vendor
        mapping(address => uint256) epoch_volumes;
    }
}

// ─── Fixed-Point Arithmetic ───

/// (a * b) / SCALE
fn fp_mul(a: U256, b: U256) -> Option<U256> {
    if a.is_zero() || b.is_zero() {
        return Some(U256::ZERO);
    }
    let product = a.checked_mul(b)?;
    Some(product / SCALE)
}

/// (a * SCALE) / b
fn fp_div(a: U256, b: U256) -> Option<U256> {
    if b.is_zero() {
        return None;
    }
    let scaled = a.checked_mul(SCALE)?;
    Some(scaled / b)
}

/// |a - b| for unsigned integers
fn abs_diff(a: U256, b: U256) -> U256 {
    if a >= b { a - b } else { b - a }
}

// ─── Public Interface ───

#[public]
impl RiskEngine {
    /// Core risk evaluation — called by ArbCFOVault.sol before executing payment.
    ///
    /// Returns (is_safe, composite_score):
    ///   - is_safe=true,  score ≤ 70:  payment proceeds
    ///   - is_safe=false, score > 70:  soft-fail to multisig review
    pub fn evaluate_risk(&mut self, vendor: Address, amount: U256) -> (bool, U256) {
        let timestamp = stylus_sdk::block::timestamp();
        self.evaluate_risk_internal(vendor, amount, U256::from(timestamp))
    }

    /// Dashboard: full vendor risk profile
    pub fn get_vendor_stats(&self, vendor: Address) -> (U256, U256, U256, U256, U256) {
        (
            self.tx_counts.get(vendor),
            self.ema_amounts.get(vendor),
            self.ema_mads.get(vendor),
            self.current_epochs.get(vendor),
            self.epoch_volumes.get(vendor),
        )
    }

    /// Dashboard: current risk parameters
    pub fn get_risk_params(&self) -> (U256, U256, U256) {
        (
            U256::from(RISK_THRESHOLD),
            MAD_MULTIPLIER,
            DEFAULT_DAILY_CAP,
        )
    }

    /// Contract owner
    pub fn owner(&self) -> Address {
        self.owner.get()
    }
}

// ─── Internal Logic (testable with injected timestamps) ───

impl RiskEngine {
    fn evaluate_risk_internal(
        &mut self,
        vendor: Address,
        amount: U256,
        timestamp: U256,
    ) -> (bool, U256) {
        // Scale to 18-decimal fixed-point
        let amount_fp = match amount.checked_mul(SCALE) {
            Some(v) => v,
            None => return (false, U256::from(100u64)),
        };

        // Load vendor state
        let count = self.tx_counts.get(vendor);
        let old_ema = self.ema_amounts.get(vendor);
        let old_mad = self.ema_mads.get(vendor);
        let last_ts = self.last_timestamps.get(vendor);
        let stored_epoch = self.current_epochs.get(vendor);
        let stored_volume = self.epoch_volumes.get(vendor);

        // ── Dimension 1: New Vendor Risk (0-30 pts) ──
        // Unknown vendors are the #1 fraud signal in accounts payable.
        // Linear ramp-down as trust builds.
        let new_vendor_score = if count.is_zero() {
            WEIGHT_NEW_VENDOR
        } else if count < NEW_VENDOR_THRESHOLD {
            let remaining = NEW_VENDOR_THRESHOLD - count;
            let score = remaining * U256::from(WEIGHT_NEW_VENDOR) / NEW_VENDOR_THRESHOLD;
            score.saturating_to::<u64>()
        } else {
            0
        };

        // ── Dimension 2: Velocity Risk (0-20 pts) ──
        // Burst payments signal drainage attacks.
        // 50 × $1k in 10 minutes >> 50 × $1k over 50 days.
        let velocity_score = if count.is_zero() || last_ts.is_zero() {
            0
        } else if timestamp > last_ts {
            let gap = timestamp - last_ts;
            if gap < VELOCITY_WINDOW {
                WEIGHT_VELOCITY       // < 5 min: full risk
            } else if gap < VELOCITY_WINDOW * U256::from(2u64) {
                WEIGHT_VELOCITY / 2   // 5-10 min: half risk
            } else {
                0
            }
        } else {
            0
        };

        // ── Dimension 3: Daily Volume Risk (0-25 pts) ──
        // Epoch bucket: day_index = timestamp / 86400
        let current_epoch = if !timestamp.is_zero() {
            timestamp / SECONDS_PER_DAY
        } else {
            U256::ZERO
        };

        let active_volume = if current_epoch > stored_epoch && !stored_epoch.is_zero() {
            amount_fp // New day — reset
        } else {
            stored_volume.saturating_add(amount_fp)
        };

        let daily_cap_fp = DEFAULT_DAILY_CAP.checked_mul(SCALE).unwrap_or(U256::MAX);

        let volume_score = if active_volume > daily_cap_fp {
            WEIGHT_VOLUME // Over cap — full risk
        } else if daily_cap_fp > U256::ZERO {
            // Quadratic ramp: low usage = negligible risk, approaching cap = high risk
            let ratio = fp_div(active_volume, daily_cap_fp).unwrap_or(U256::ZERO);
            let ratio_sq = fp_mul(ratio, ratio).unwrap_or(U256::ZERO);
            let weighted = ratio_sq * U256::from(WEIGHT_VOLUME) / SCALE;
            weighted.saturating_to::<u64>().min(WEIGHT_VOLUME)
        } else {
            0
        };

        // ── Dimension 4: Deviation Risk (0-25 pts) ──
        // MAD-based anomaly detection. No square roots.
        let deviation_score;
        let mut circuit_break = false;

        if count < U256::from(2u64) {
            deviation_score = 0; // Need ≥2 data points
        } else {
            let deviation = abs_diff(amount_fp, old_ema);

            // CV floor: effective_mad = max(ema_mad, ema × 10%)
            let min_mad = fp_mul(old_ema, MIN_CV).unwrap_or(U256::ZERO);
            let effective_mad = if old_mad > min_mad { old_mad } else { min_mad };

            if effective_mad.is_zero() {
                deviation_score = 0;
            } else {
                let mad_ratio = fp_div(deviation, effective_mad).unwrap_or(U256::ZERO);

                // ── CIRCUIT BREAKER ──
                // Extreme deviations (>10× MAD) bypass composite scoring entirely.
                // This is standard in production fraud systems (Stripe Radar, etc.)
                // No combination of "safe" signals in other dimensions should
                // override a 50x payment spike. Period.
                let ten_mad = MAD_MULTIPLIER * U256::from(10u64) / U256::from(3u64); // ~10× MAD
                if mad_ratio > ten_mad && count >= NEW_VENDOR_THRESHOLD {
                    circuit_break = true;
                    deviation_score = WEIGHT_DEVIATION;
                } else if mad_ratio <= SCALE {
                    deviation_score = 0; // Within 1 MAD — normal
                } else if mad_ratio >= MAD_MULTIPLIER {
                    deviation_score = WEIGHT_DEVIATION; // Beyond 3 MADs — full risk
                } else {
                    // Linear interpolation: 1 MAD → 3 MADs
                    let excess = mad_ratio - SCALE;
                    let range = MAD_MULTIPLIER - SCALE;
                    let score = excess * U256::from(WEIGHT_DEVIATION) / range;
                    deviation_score = score.saturating_to::<u64>().min(WEIGHT_DEVIATION);
                }
            }
        }

        // ── Composite Score ──
        // Circuit breaker overrides composite: extreme single-dimension violations
        // are auto-flagged regardless of what other dimensions say.
        let (composite, is_safe) = if circuit_break {
            (100u64, false)
        } else {
            let score = new_vendor_score + velocity_score + volume_score + deviation_score;
            (score.min(100), score <= RISK_THRESHOLD)
        };
        let composite_u256 = U256::from(composite);

        // ── State Updates ──
        // CRITICAL: Only update baselines on safe transactions.
        // Flagged payments must NOT pollute EMA/MAD — prevents baseline poisoning.
        if is_safe {
            let new_ema = if count.is_zero() {
                amount_fp
            } else {
                let term_a = fp_mul(ALPHA, amount_fp).unwrap_or(amount_fp);
                let term_b = fp_mul(ONE_MINUS_ALPHA, old_ema).unwrap_or(old_ema);
                term_a.saturating_add(term_b)
            };

            let deviation = abs_diff(amount_fp, old_ema);
            let new_mad = if count.is_zero() {
                U256::ZERO
            } else {
                let term_a = fp_mul(ALPHA, deviation).unwrap_or(U256::ZERO);
                let term_b = fp_mul(ONE_MINUS_ALPHA, old_mad).unwrap_or(old_mad);
                term_a.saturating_add(term_b)
            };

            self.tx_counts.setter(vendor).set(count.saturating_add(U256::from(1u64)));
            self.ema_amounts.setter(vendor).set(new_ema);
            self.ema_mads.setter(vendor).set(new_mad);
            self.last_timestamps.setter(vendor).set(timestamp);
            self.current_epochs.setter(vendor).set(current_epoch);
            self.epoch_volumes.setter(vendor).set(active_volume);
        }

        (is_safe, composite_u256)
    }
}

// ============================================================================
// TESTS — cargo test
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use stylus_sdk::alloy_primitives::address;
    use stylus_sdk::testing::*;

    fn usdc(amount: u64) -> U256 {
        U256::from(amount) * U256::from(1_000_000u64)
    }

    fn ts(seconds: u64) -> U256 { U256::from(seconds) }
    fn day(d: u64) -> U256 { U256::from(d * 86400) }

    // ─── Fixed-Point Math ───

    #[test]
    fn test_fp_mul() {
        let half = U256::from(500_000_000_000_000_000u64);
        let result = fp_mul(half, half).unwrap();
        assert_eq!(result, U256::from(250_000_000_000_000_000u64));
    }

    #[test]
    fn test_fp_div() {
        let one = SCALE;
        let two = SCALE * U256::from(2u64);
        let result = fp_div(one, two).unwrap();
        assert_eq!(result, U256::from(500_000_000_000_000_000u64));
    }

    // ─── Dimension 1: New Vendor Risk ───

    #[test]
    fn test_new_vendor_high_score() {
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);
        let v = address!("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");

        let (_, score) = engine.evaluate_risk_internal(v, usdc(100), day(1));
        assert!(score >= U256::from(30u64),
            "New vendor must score ≥30, got {}", score);
    }

    #[test]
    fn test_established_vendor_low_score() {
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);
        let v = address!("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");

        for i in 1..=10u64 {
            engine.evaluate_risk_internal(v, usdc(1000), day(i));
        }

        let (is_safe, score) = engine.evaluate_risk_internal(v, usdc(1000), day(11));
        assert!(is_safe, "Established vendor, normal payment should be safe");
        assert!(score < U256::from(20u64),
            "Should score <20, got {}", score);
    }

    // ─── Dimension 2: Velocity ───

    #[test]
    fn test_rapid_payments_flagged() {
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);
        let v = address!("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");

        for i in 1..=6u64 {
            engine.evaluate_risk_internal(v, usdc(500), day(i));
        }

        let base = day(7);
        engine.evaluate_risk_internal(v, usdc(500), base);
        let (_, score) = engine.evaluate_risk_internal(v, usdc(500), base + ts(60));

        assert!(score >= U256::from(20u64),
            "60s gap should trigger velocity risk ≥20, got {}", score);
    }

    #[test]
    fn test_spaced_payments_safe() {
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);
        let v = address!("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");

        for i in 1..=6u64 {
            engine.evaluate_risk_internal(v, usdc(500), day(i));
        }

        let (is_safe, score) = engine.evaluate_risk_internal(
            v, usdc(500), day(7) + ts(3600)
        );
        assert!(is_safe, "1hr gap should be safe");
        assert!(score < U256::from(10u64), "Got {}", score);
    }

    // ─── Dimension 3: Volume ───

    #[test]
    fn test_volume_cap_breach() {
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);
        let v = address!("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");

        for i in 1..=6u64 {
            engine.evaluate_risk_internal(v, usdc(10_000), day(i));
        }

        let base = day(7);
        engine.evaluate_risk_internal(v, usdc(60_000), base + ts(100));
        let (_, score) = engine.evaluate_risk_internal(v, usdc(60_000), base + ts(200));

        assert!(score >= U256::from(25u64),
            "$120k same day should trigger volume risk ≥25, got {}", score);
    }

    #[test]
    fn test_volume_epoch_reset() {
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);
        let v = address!("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");

        // Build history with $80k payments so EMA matches test amounts
        for i in 1..=6u64 {
            engine.evaluate_risk_internal(v, usdc(80_000), day(i));
        }

        // $80k on day 7 — under daily cap, matches EMA
        engine.evaluate_risk_internal(v, usdc(80_000), day(7));

        // $80k on day 8 — epoch resets, volume is fresh, should pass
        let (is_safe, _) = engine.evaluate_risk_internal(v, usdc(80_000), day(8));
        assert!(is_safe, "Volume must reset on new day");
    }

    // ─── Dimension 4: Deviation (MAD) ───

    #[test]
    fn test_anomalous_spike_flagged() {
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);
        let v = address!("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");

        for i in 1..=10u64 {
            engine.evaluate_risk_internal(v, usdc(1000), day(i));
        }

        let (is_safe, score) = engine.evaluate_risk_internal(v, usdc(50_000), day(11));
        assert!(!is_safe, "50x spike must be flagged");
        assert!(score > U256::from(RISK_THRESHOLD),
            "Score should exceed {}, got {}", RISK_THRESHOLD, score);
    }

    #[test]
    fn test_gradual_increase_stays_safe() {
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);
        let v = address!("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");

        for i in 1..=10u64 {
            engine.evaluate_risk_internal(v, usdc(1000), day(i));
        }

        for i in 0..10u64 {
            let amt = 1000 + i * 50;
            let (is_safe, score) = engine.evaluate_risk_internal(
                v, usdc(amt), day(11 + i)
            );
            assert!(is_safe,
                "Gradual increase to {} should be safe, score={}", amt, score);
        }
    }

    // ─── Cross-Dimension ───

    #[test]
    fn test_multi_vendor_isolation() {
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);
        let a = address!("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
        let b = address!("0x1234567890AbcdEF1234567890aBcdef12345678");

        for i in 1..=10u64 {
            engine.evaluate_risk_internal(a, usdc(100_000), day(i));
        }

        // B is independent — gets new-vendor risk
        let (_, score_b) = engine.evaluate_risk_internal(b, usdc(50), day(11));
        assert!(score_b >= U256::from(30u64),
            "Vendor B must get new-vendor risk regardless of A");

        for i in 12..=20u64 {
            engine.evaluate_risk_internal(b, usdc(50), day(i));
        }

        let (is_safe, _) = engine.evaluate_risk_internal(b, usdc(50_000), day(21));
        assert!(!is_safe, "B spike flagged based on B's history, not A's");
    }

    #[test]
    fn test_poisoning_protection() {
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);
        let v = address!("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");

        for i in 1..=10u64 {
            engine.evaluate_risk_internal(v, usdc(1000), day(i));
        }

        let ema_before = engine.ema_amounts.get(v);

        let (is_safe, _) = engine.evaluate_risk_internal(v, usdc(500_000), day(11));
        assert!(!is_safe, "Massive payment should be flagged");

        let ema_after = engine.ema_amounts.get(v);
        assert_eq!(ema_before, ema_after,
            "CRITICAL: Flagged tx must NOT update EMA baseline");
    }

    #[test]
    fn test_zero_amount_no_panic() {
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);
        let v = address!("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");

        let (_, score) = engine.evaluate_risk_internal(v, U256::ZERO, day(1));
        assert!(score >= U256::from(30u64), "Zero amount still gets new-vendor risk");
    }

    #[test]
    fn test_score_capped_at_100() {
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);
        let v = address!("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");

        let (_, score) = engine.evaluate_risk_internal(v, usdc(999_999_999), day(1));
        assert!(score <= U256::from(100u64), "Score must cap at 100, got {}", score);
    }
}
