/**
 * PURE THRESHOLD-BASED MOTION CLASSIFIER
 * No ML model dependency - fast and reliable threshold detection
 * 
 * RULES:
 * - Artificial: Spiky, inconsistent movement (intentional/spoofing)
 * - Genuine: Smooth, consistent movement (natural human motion)
 */

class MotionPatternAnalyzer {
  /**
   * Classify motion sequence using PURE THRESHOLDS (no ML)
   * @param {Array<number>} motionSequence - Array of accelerometer magnitude values
   * @returns {Object} Classification result with confidence
   */
  static async analyzePattern(motionSequence) {
    const classification = this._thresholdAnalysis(motionSequence);
    return {
      ...classification,
      source: 'threshold_based'
    };
  }

  /**
   * Analyze a single motion value
   * @param {number} motionValue - Single accelerometer magnitude value
   * @returns {Object} Classification result
   */
  static async analyzeSingleMotion(motionValue) {
    return this._thresholdAnalysis([motionValue]);
  }


  /**
   * Pure threshold-based classification
   * @private
   */
  static _thresholdAnalysis(motionSequence) {
    const arr = motionSequence.map(v => parseFloat(v)).filter(v => Number.isFinite(v));
    
    // Default: not enough data = genuine
    if (arr.length === 0) {
      return {
        prediction: 0,
        label: 'Genuine',
        confidence: 0.6,
        genuine_probability: 0.6,
        artificial_probability: 0.4
      };
    }

    // ===== CALCULATE FEATURES =====
    const mean = arr.reduce((a, b) => a + b) / arr.length;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    const std = Math.sqrt(variance);
    const maxVal = Math.max(...arr);
    const minVal = Math.min(...arr);
    const range = maxVal - minVal;

    // ===== DIFFERENCES BETWEEN CONSECUTIVE VALUES =====
    const diffs = [];
    for (let i = 1; i < arr.length; i++) {
      diffs.push(Math.abs(arr[i] - arr[i - 1]));
    }
    const avgDiff = diffs.length > 0 ? diffs.reduce((a, b) => a + b) / diffs.length : 0;
    const maxDiff = diffs.length > 0 ? Math.max(...diffs) : 0;

    // ===== DIRECTION REVERSALS (ZIG-ZAG) =====
    let directionReversals = 0;
    for (let i = 2; i < arr.length; i++) {
      const d1 = arr[i - 1] - arr[i - 2];
      const d2 = arr[i] - arr[i - 1];
      if (d1 !== 0 && d2 !== 0 && Math.sign(d1) !== Math.sign(d2)) {
        directionReversals += 1;
      }
    }
    const directionChangeRatio = arr.length > 2 ? directionReversals / (arr.length - 2) : 0;

    // ===== NORMALIZED METRICS =====
    const coefficientOfVariation = mean > 0 ? std / mean : 0;
    const rangeAsPercentOfMean = mean > 0 ? (range / mean) * 100 : 0;
    const avgDiffAsPercentOfMean = mean > 0 ? (avgDiff / mean) * 100 : 0;
    const maxDiffAsPercentOfMean = mean > 0 ? (maxDiff / mean) * 100 : 0;

    // Treat very small motion as stationary noise rather than spoofing.
    const isLowMotion =
      rangeAsPercentOfMean < 8 &&
      maxDiffAsPercentOfMean < 6 &&
      avgDiffAsPercentOfMean < 4 &&
      coefficientOfVariation < 0.03;

    if (isLowMotion) {
      return {
        prediction: 0,
        label: 'Genuine',
        confidence: 0.78,
        genuine_probability: 0.78,
        artificial_probability: 0.22,
        features: {
          mean_magnitude: Math.round(mean * 100) / 100,
          std_deviation: Math.round(std * 100) / 100,
          max_value: maxVal,
          min_value: minVal,
          range: Math.round(range * 100) / 100,
          avg_diff: Math.round(avgDiff * 100) / 100,
          max_diff: Math.round(maxDiff * 100) / 100,
          coefficient_of_variation: Math.round(coefficientOfVariation * 1000) / 1000,
          direction_change_ratio: Math.round(directionChangeRatio * 100) / 100,
          range_percent_of_mean: Math.round(rangeAsPercentOfMean),
          max_diff_percent_of_mean: Math.round(maxDiffAsPercentOfMean),
          avg_diff_percent_of_mean: Math.round(avgDiffAsPercentOfMean),
          artificial_score: -0.28,
          final_score: 0.22,
          threshold_decision_rule: 'Low-motion guard: tiny noise is Genuine, not Artificial'
        }
      };
    }

    // ===== THRESHOLD-BASED SCORING =====
    let artificialScore = 0;

    // 🔴 THRESHOLD 1: Direction Reversals (Zig-Zag Detection)
    // Genuine motion: smooth, few reversals (ratio < 0.3)
    // Artificial motion: spiky, many reversals (ratio > 0.5)
    if (rangeAsPercentOfMean >= 10 || maxDiffAsPercentOfMean >= 8) {
      if (directionChangeRatio > 0.70) artificialScore += 0.90;      // Extreme zig-zag
      else if (directionChangeRatio > 0.55) artificialScore += 0.75; // High zig-zag
      else if (directionChangeRatio > 0.40) artificialScore += 0.50; // Medium zig-zag
      else if (directionChangeRatio < 0.15) artificialScore -= 0.20; // Very smooth = genuine bonus
    }

    // 🔴 THRESHOLD 2: Variability (Standard Deviation)
    // Device range is 9-15, so we use relative metrics
    if (coefficientOfVariation > 0.25) artificialScore += 0.80;     // High variability
    else if (coefficientOfVariation > 0.15) artificialScore += 0.50; // Medium variability
    else if (coefficientOfVariation < 0.08) artificialScore -= 0.15;  // Very consistent = genuine bonus

    // 🔴 THRESHOLD 3: Max Single Jump
    // Artificial motion has sudden big jumps, genuine is gradual
    if (maxDiffAsPercentOfMean > 40) artificialScore += 0.85;     // Huge jump
    else if (maxDiffAsPercentOfMean > 25) artificialScore += 0.60; // Large jump
    else if (maxDiffAsPercentOfMean > 15) artificialScore += 0.35; // Medium jump
    else if (maxDiffAsPercentOfMean < 8) artificialScore -= 0.15;   // Tiny jump = genuine bonus

    // 🔴 THRESHOLD 4: Average Change Rate
    // Artificial: rapid changes, Genuine: slow, steady changes
    if (avgDiffAsPercentOfMean > 30) artificialScore += 0.70;     // Very rapid
    else if (avgDiffAsPercentOfMean > 20) artificialScore += 0.50; // Rapid
    else if (avgDiffAsPercentOfMean > 12) artificialScore += 0.30; // Moderate
    else if (avgDiffAsPercentOfMean < 6) artificialScore -= 0.15;   // Very slow = genuine bonus

    // 🔴 THRESHOLD 5: Range Relative to Mean
    // Genuine motion stays within a range; artificial jumps around
    if (rangeAsPercentOfMean > 100) artificialScore += 0.65;      // Huge range
    else if (rangeAsPercentOfMean > 60) artificialScore += 0.45;   // Large range
    else if (rangeAsPercentOfMean > 35) artificialScore += 0.25;   // Moderate range
    else if (rangeAsPercentOfMean < 20) artificialScore -= 0.10;   // Small range = genuine bonus

    // ===== DECISION THRESHOLDS =====
    // Clamp score between 0 and 1
    let finalScore = Math.max(0, Math.min(1, 0.5 + artificialScore));
    
    // DECISION RULE:
    // >= 0.60 = ARTIFICIAL (intentional/spoof)
    // < 0.60  = GENUINE (natural motion)
    const isArtificial = finalScore >= 0.60;

    // Confidence: how confident are we in this classification?
    // Closer to 0 or 1 = more confident
    const confidenceDistance = Math.abs(finalScore - 0.5);
    const confidence = 0.50 + (confidenceDistance * 0.50); // Maps [0,1] to [0.5,1]

    return {
      prediction: isArtificial ? 1 : 0,
      label: isArtificial ? 'Artificial' : 'Genuine',
      confidence: Math.round(confidence * 100) / 100,
      genuine_probability: isArtificial ? 1 - confidence : confidence,
      artificial_probability: isArtificial ? confidence : 1 - confidence,
      features: {
        mean_magnitude: Math.round(mean * 100) / 100,
        std_deviation: Math.round(std * 100) / 100,
        max_value: maxVal,
        min_value: minVal,
        range: Math.round(range * 100) / 100,
        avg_diff: Math.round(avgDiff * 100) / 100,
        max_diff: Math.round(maxDiff * 100) / 100,
        coefficient_of_variation: Math.round(coefficientOfVariation * 1000) / 1000,
        direction_change_ratio: Math.round(directionChangeRatio * 100) / 100,
        range_percent_of_mean: Math.round(rangeAsPercentOfMean),
        max_diff_percent_of_mean: Math.round(maxDiffAsPercentOfMean),
        avg_diff_percent_of_mean: Math.round(avgDiffAsPercentOfMean),
        artificial_score: Math.round(artificialScore * 100) / 100,
        final_score: Math.round(finalScore * 100) / 100,
        threshold_decision_rule: 'finalScore >= 0.60 → Artificial, else Genuine'
      }
    };
  }


  /**
   * Health check (threshold-based classifier always healthy)
   */
  static async checkHealth() {
    return {
      status: 'healthy',
      method: 'threshold_based',
      message: 'Threshold classifier ready - no ML dependency'
    };
  }
}

module.exports = MotionPatternAnalyzer;
