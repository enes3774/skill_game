import { DatabaseService } from '../database/DatabaseService';

interface PlayerInput {
  mouseX: number;
  mouseY: number;
  split: boolean;
  eject: boolean;
  timestamp: number;
}

interface PlayerBehavior {
  inputs: PlayerInput[];
  mouseMovements: { x: number; y: number; timestamp: number }[];
  reactionTimes: number[];
  startTime: number;
  totalInputs: number;
}

interface BotDetectionMetrics {
  avgReactionTime: number;
  mouseSmoothness: number;
  inputVariance: number;
  sessionDuration: number;
  inputFrequency: number;
}

interface BotDetectionResult {
  suspicionScore: number;
  isLikelyBot: boolean;
  metrics: BotDetectionMetrics;
  reasons: string[];
}

export class BotDetector {
  private playerStats = new Map<string, PlayerBehavior>();
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;

    // Cleanup old stats every 5 minutes
    setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Track player input and analyze behavior
   */
  async trackInput(playerId: string, input: PlayerInput): Promise<BotDetectionResult> {
    let stats = this.playerStats.get(playerId);

    if (!stats) {
      stats = {
        inputs: [],
        mouseMovements: [],
        reactionTimes: [],
        startTime: Date.now(),
        totalInputs: 0
      };
      this.playerStats.set(playerId, stats);
    }

    // Track input
    stats.inputs.push(input);
    stats.totalInputs++;

    // Track mouse movement
    stats.mouseMovements.push({
      x: input.mouseX,
      y: input.mouseY,
      timestamp: input.timestamp
    });

    // Keep only recent data (last 1000 inputs)
    if (stats.inputs.length > 1000) {
      stats.inputs.shift();
    }
    if (stats.mouseMovements.length > 1000) {
      stats.mouseMovements.shift();
    }

    // Calculate metrics
    const metrics = this.calculateMetrics(stats);

    // Calculate suspicion score
    const result = this.analyzeBehavior(metrics);

    // Log suspicious activity
    if (result.suspicionScore > 40) {
      await this.db.logSuspiciousActivity(playerId, 'bot_detection', {
        score: result.suspicionScore,
        metrics,
        reasons: result.reasons
      }, this.getSeverity(result.suspicionScore));
    }

    return result;
  }

  /**
   * Calculate behavior metrics
   */
  private calculateMetrics(stats: PlayerBehavior): BotDetectionMetrics {
    return {
      avgReactionTime: this.calculateAvgReactionTime(stats),
      mouseSmoothness: this.calculateMouseSmoothness(stats),
      inputVariance: this.calculateInputVariance(stats),
      sessionDuration: Date.now() - stats.startTime,
      inputFrequency: this.calculateInputFrequency(stats)
    };
  }

  /**
   * Analyze metrics and calculate suspicion score
   */
  private analyzeBehavior(metrics: BotDetectionMetrics): BotDetectionResult {
    let score = 0;
    const reasons: string[] = [];

    // Superhuman reaction time (< 50ms is suspicious)
    if (metrics.avgReactionTime < 50 && metrics.avgReactionTime > 0) {
      score += 20;
      reasons.push(`Superhuman reaction time: ${metrics.avgReactionTime.toFixed(2)}ms`);
    }

    // Perfect mouse movements (> 0.95 smoothness)
    if (metrics.mouseSmoothness > 0.95) {
      score += 20;
      reasons.push(`Unnaturally smooth mouse: ${metrics.mouseSmoothness.toFixed(3)}`);
    }

    // Inhuman consistency (< 0.1 variance)
    if (metrics.inputVariance < 0.1) {
      score += 15;
      reasons.push(`Too consistent inputs: ${metrics.inputVariance.toFixed(3)}`);
    }

    // Playing for many hours without break (> 4 hours)
    if (metrics.sessionDuration > 14400000) {
      score += 15;
      reasons.push(`Long session: ${(metrics.sessionDuration / 3600000).toFixed(1)}h`);
    }

    // Perfect input frequency (exactly 60 FPS for extended period)
    const expectedFrequency = 60;
    const frequencyDiff = Math.abs(metrics.inputFrequency - expectedFrequency);
    if (frequencyDiff < 0.5 && metrics.sessionDuration > 60000) {
      score += 10;
      reasons.push(`Perfect input frequency: ${metrics.inputFrequency.toFixed(2)} FPS`);
    }

    // Impossible mouse speed (teleporting)
    // This would be detected in calculateMouseSmoothness

    return {
      suspicionScore: score,
      isLikelyBot: score > 40,
      metrics,
      reasons
    };
  }

  /**
   * Calculate average reaction time
   */
  private calculateAvgReactionTime(stats: PlayerBehavior): number {
    if (stats.reactionTimes.length === 0) return 0;

    const sum = stats.reactionTimes.reduce((a, b) => a + b, 0);
    return sum / stats.reactionTimes.length;
  }

  /**
   * Calculate mouse movement smoothness
   * Returns 0-1, where 1 is perfectly smooth (suspicious)
   */
  private calculateMouseSmoothness(stats: PlayerBehavior): number {
    const movements = stats.mouseMovements;
    if (movements.length < 10) return 0;

    let smoothCount = 0;
    let totalSegments = 0;

    for (let i = 2; i < movements.length; i++) {
      const p1 = movements[i - 2];
      const p2 = movements[i - 1];
      const p3 = movements[i];

      // Calculate angles
      const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);

      // Calculate angle difference
      let diff = Math.abs(angle1 - angle2);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;

      // Very small angle changes = smooth movement
      if (diff < 0.05) smoothCount++;

      // Check for impossible speeds (teleporting)
      const distance = Math.sqrt(
        Math.pow(p3.x - p2.x, 2) + Math.pow(p3.y - p2.y, 2)
      );
      const timeDiff = p3.timestamp - p2.timestamp;
      const speed = distance / (timeDiff || 1);

      if (speed > 10000) {
        // Impossible mouse speed - likely bot
        smoothCount += 10;
      }

      totalSegments++;
    }

    return totalSegments > 0 ? smoothCount / totalSegments : 0;
  }

  /**
   * Calculate input variance (how consistent the inputs are)
   * Returns 0-1, where 0 is perfectly consistent (suspicious)
   */
  private calculateInputVariance(stats: PlayerBehavior): number {
    if (stats.inputs.length < 10) return 1;

    // Calculate variance in input timing
    const timeDiffs: number[] = [];
    for (let i = 1; i < stats.inputs.length; i++) {
      timeDiffs.push(stats.inputs[i].timestamp - stats.inputs[i - 1].timestamp);
    }

    const mean = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
    const squareDiffs = timeDiffs.map(x => Math.pow(x - mean, 2));
    const variance = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    const stdDev = Math.sqrt(variance);

    // Normalize to 0-1 range
    // Low standard deviation = low variance = suspicious
    return Math.min(stdDev / 100, 1);
  }

  /**
   * Calculate input frequency (inputs per second)
   */
  private calculateInputFrequency(stats: PlayerBehavior): number {
    if (stats.inputs.length < 2) return 0;

    const duration = Date.now() - stats.startTime;
    const seconds = duration / 1000;
    return stats.totalInputs / seconds;
  }

  /**
   * Get severity level based on suspicion score
   */
  private getSeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 70) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  /**
   * Clean up old player stats
   */
  private cleanup() {
    const now = Date.now();
    for (const [playerId, stats] of this.playerStats.entries()) {
      // Remove stats older than 1 hour
      if (now - stats.startTime > 3600000) {
        this.playerStats.delete(playerId);
      }
    }
  }

  /**
   * Get stats for a player (for debugging/admin)
   */
  getPlayerStats(playerId: string): PlayerBehavior | null {
    return this.playerStats.get(playerId) || null;
  }
}
