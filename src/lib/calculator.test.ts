import { calculatePositionSize, INSTRUMENTS } from './calculator';

// Mock the global fetch for API calls
global.fetch = jest.fn();

describe('calculatePositionSize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('lot size rounding down rule', () => {
    it('should round lot size DOWN to nearest 0.01', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'EUR/USD',
        direction: 'buy',
        entryPrice: 1.1000,
        stopLossPrice: 1.0950,
        riskUsd: 100,
      });

      // EUR/USD: 50 pips * $10/pip = $500 per lot
      // Raw lot size = $100 / $500 = 0.2 lots
      // After floating point rounding: exactly 0.2 lots
      expect(result.recommendedLotSize).toBe(0.2);
      expect(result.actualRiskUsd).toBeLessThanOrEqual(100);
    });

    it('should round DOWN when lot size is not exact 0.01 multiple', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'EUR/USD',
        direction: 'buy',
        entryPrice: 1.1000,
        stopLossPrice: 1.0990,
        riskUsd: 15,
      });

      // EUR/USD: 10 pips * $10/pip = $100 per lot
      // Raw lot size = $15 / $100 = 0.15 lots
      // After floating point rounding: exactly 0.15 lots
      expect(result.recommendedLotSize).toBe(0.15);
      expect(result.actualRiskUsd).toBeLessThanOrEqual(15);
    });

    it('should never round UP to avoid exceeding risk', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'EUR/USD',
        direction: 'buy',
        entryPrice: 1.1000,
        stopLossPrice: 1.0950,
        riskUsd: 95,
      });

      // EUR/USD: 50 pips * $10/pip = $500 per lot
      // Raw lot size = $95 / $500 = 0.19 lots
      // After floating point rounding: exactly 0.19 lots
      expect(result.recommendedLotSize).toBe(0.19);
      expect(result.actualRiskUsd).toBeLessThanOrEqual(95);
    });

    it('should handle very small lot sizes', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'EUR/USD',
        direction: 'buy',
        entryPrice: 1.1000,
        stopLossPrice: 1.0995,
        riskUsd: 5,
      });

      // EUR/USD: 5 pips * $10/pip = $50 per lot
      // Raw lot size = $5 / $50 = 0.1 lots
      // After floating point rounding: exactly 0.1 lots
      expect(result.recommendedLotSize).toBe(0.1);
      expect(result.actualRiskUsd).toBeLessThanOrEqual(5);
    });
  });

  describe('pip value calculations for each pair', () => {
    it('should calculate EUR/USD correctly (4th decimal, $10 per pip)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'EUR/USD',
        direction: 'buy',
        entryPrice: 1.1000,
        stopLossPrice: 1.0950,
        riskUsd: 100,
      });

      expect(result.stopDistancePips).toBeCloseTo(50); // 0.0050 * 10000 = 50 pips
      expect(result.recommendedLotSize).toBe(0.2);
      expect(result.actualRiskUsd).toBeCloseTo(100); // 0.2 * 50 * 10 = 100
      expect(result.hasApproximatePipValue).toBe(false);
    });

    it('should calculate GBP/USD correctly (4th decimal, $10 per pip)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'GBP/USD',
        direction: 'sell',
        entryPrice: 1.3000,
        stopLossPrice: 1.3050,
        riskUsd: 100,
      });

      expect(result.stopDistancePips).toBeCloseTo(50);
      expect(result.recommendedLotSize).toBe(0.2);
      expect(result.actualRiskUsd).toBeCloseTo(100);
      expect(result.hasApproximatePipValue).toBe(false);
    });

    it('should calculate AUD/USD correctly (4th decimal, $10 per pip)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'AUD/USD',
        direction: 'buy',
        entryPrice: 0.8000,
        stopLossPrice: 0.7950,
        riskUsd: 100,
      });

      expect(result.stopDistancePips).toBeCloseTo(50);
      expect(result.recommendedLotSize).toBe(0.2);
      expect(result.actualRiskUsd).toBeCloseTo(100);
      expect(result.hasApproximatePipValue).toBe(false);
    });

    it('should calculate NZD/USD correctly (4th decimal, $10 per pip)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'NZD/USD',
        direction: 'buy',
        entryPrice: 0.6500,
        stopLossPrice: 0.6450,
        riskUsd: 100,
      });

      expect(result.stopDistancePips).toBeCloseTo(50);
      expect(result.recommendedLotSize).toBe(0.2);
      expect(result.actualRiskUsd).toBeCloseTo(100);
      expect(result.hasApproximatePipValue).toBe(false);
    });

    it('should calculate USD/CAD correctly with live rate', async () => {
      // Mock USD/CAD rate of 1.36
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: { CAD: 1.36 } }),
      });

      const result = await calculatePositionSize({
        pair: 'USD/CAD',
        direction: 'buy',
        entryPrice: 1.3600,
        stopLossPrice: 1.3550,
        riskUsd: 100,
      });

      expect(result.stopDistancePips).toBeCloseTo(50);
      // pip value = $10 / 1.36 = $7.35 per pip
      // 50 pips * $7.35/pip = $367.65 per lot
      // Raw lot size = $100 / $367.65 = 0.272 lots
      // Round down to 0.27 lots
      expect(result.recommendedLotSize).toBeCloseTo(0.27);
      expect(result.actualRiskUsd).toBeLessThanOrEqual(100);
      expect(result.hasApproximatePipValue).toBe(false);
      expect(result.rateUsed).toBe(1.36);
      expect(result.rateUsedDisplay).toBe('USD/CAD = 1.36');
    });

    it('should calculate USD/CHF correctly with live rate', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: { CHF: 0.90 } }),
      });

      const result = await calculatePositionSize({
        pair: 'USD/CHF',
        direction: 'buy',
        entryPrice: 0.9000,
        stopLossPrice: 0.8950,
        riskUsd: 100,
      });

      expect(result.stopDistancePips).toBeCloseTo(50);
      expect(result.recommendedLotSize).toBeCloseTo(0.18);
      expect(result.actualRiskUsd).toBeLessThanOrEqual(100);
      expect(result.hasApproximatePipValue).toBe(false);
      expect(result.rateUsed).toBe(0.90);
      expect(result.rateUsedDisplay).toBe('USD/CHF = 0.90');
    });

    it('should calculate USD/JPY correctly with live rate', async () => {
      // Mock USD/JPY rate of 147.0
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: { JPY: 147.0 } }),
      });

      const result = await calculatePositionSize({
        pair: 'USD/JPY',
        direction: 'buy',
        entryPrice: 150.00,
        stopLossPrice: 149.50,
        riskUsd: 100,
      });

      expect(result.stopDistancePips).toBe(50); // 0.50 * 100 = 50 pips
      // pip value = (0.01 / 147.0) * 100000 = $6.80 per pip
      // 50 pips * $6.80/pip = $340 per lot
      // Raw lot size = $100 / $340 = 0.294 lots
      // Round down to 0.29 lots
      expect(result.recommendedLotSize).toBeCloseTo(0.29);
      expect(result.actualRiskUsd).toBeLessThanOrEqual(100);
      expect(result.hasApproximatePipValue).toBe(false);
      expect(result.rateUsed).toBe(147.0);
      expect(result.rateUsedDisplay).toBe('USD/JPY = 147.00');
    });

    it('should calculate GBP/JPY correctly with live rate', async () => {
      // Mock USD/JPY rate of 147.0 (used for GBP/JPY as well)
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: { JPY: 147.0 } }),
      });

      const result = await calculatePositionSize({
        pair: 'GBP/JPY',
        direction: 'sell',
        entryPrice: 190.00,
        stopLossPrice: 190.50,
        riskUsd: 100,
      });

      expect(result.stopDistancePips).toBe(50);
      expect(result.recommendedLotSize).toBeCloseTo(0.29);
      expect(result.actualRiskUsd).toBeLessThanOrEqual(100);
      expect(result.hasApproximatePipValue).toBe(false);
      expect(result.rateUsed).toBe(147.0);
      expect(result.rateUsedDisplay).toBe('USD/JPY = 147.00');
    });

    it('should calculate XAU/USD correctly (2nd decimal, $10 per pip)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'XAU/USD',
        direction: 'buy',
        entryPrice: 2000.00,
        stopLossPrice: 1995.00,
        riskUsd: 100,
      });

      expect(result.stopDistancePips).toBe(500); // 5.00 * 100 = 500 pips (since 2nd decimal)
      // 500 pips * $10/pip = $5000 per lot
      // Raw lot size = $100 / $5000 = 0.02 lots
      // After floating point rounding: exactly 0.02 lots
      expect(result.recommendedLotSize).toBe(0.02);
      expect(result.actualRiskUsd).toBeLessThanOrEqual(100);
      expect(result.hasApproximatePipValue).toBe(false);
    });
  });

  describe('reward ratio calculations', () => {
    it('should calculate TP price for buy direction', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'EUR/USD',
        direction: 'buy',
        entryPrice: 1.1000,
        stopLossPrice: 1.0950,
        riskUsd: 100,
        rewardRatio: 2,
      });

      expect(result.suggestedTpPrice).toBeCloseTo(1.1100); // Entry + (50 pips * 2) = 1.1000 + 0.0100
      expect(result.rewardUsd).toBeCloseTo(200); // 0.2 * 100 pips * 10 = 200
    });

    it('should calculate TP price for sell direction', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'EUR/USD',
        direction: 'sell',
        entryPrice: 1.1000,
        stopLossPrice: 1.1050,
        riskUsd: 100,
        rewardRatio: 2,
      });

      expect(result.suggestedTpPrice).toBeCloseTo(1.0900); // Entry - (50 pips * 2) = 1.1000 - 0.0100
      expect(result.rewardUsd).toBeCloseTo(200);
    });

    it('should handle 1:1 reward ratio', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'EUR/USD',
        direction: 'buy',
        entryPrice: 1.1000,
        stopLossPrice: 1.0950,
        riskUsd: 100,
        rewardRatio: 1,
      });

      expect(result.suggestedTpPrice).toBeCloseTo(1.1050); // Entry + 50 pips
      expect(result.rewardUsd).toBeCloseTo(100); // 0.2 * 50 pips * 10 = 100
    });

    it('should not calculate TP when reward ratio is not provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'EUR/USD',
        direction: 'buy',
        entryPrice: 1.1000,
        stopLossPrice: 1.0950,
        riskUsd: 100,
      });

      expect(result.suggestedTpPrice).toBeUndefined();
      expect(result.rewardUsd).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should throw error for invalid instrument', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      await expect(calculatePositionSize({
        pair: 'INVALID/PAIR',
        direction: 'buy',
        entryPrice: 1.1000,
        stopLossPrice: 1.0950,
        riskUsd: 100,
      })).rejects.toThrow('Invalid instrument');
    });

    it('should handle zero stop distance (same entry and stop)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'EUR/USD',
        direction: 'buy',
        entryPrice: 1.1000,
        stopLossPrice: 1.1000,
        riskUsd: 100,
      });
      // Should handle gracefully with zero stop distance
      expect(result.stopDistancePips).toBe(0);
      expect(result.recommendedLotSize).toBe(0);
    });

    it('should handle negative risk (invalid input)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'EUR/USD',
        direction: 'buy',
        entryPrice: 1.1000,
        stopLossPrice: 1.0950,
        riskUsd: -100,
      });

      // Should calculate but produce negative lot size
      expect(result.recommendedLotSize).toBeLessThanOrEqual(0);
    });
  });
});

describe('INSTRUMENTS constant', () => {
  it('should have nine instruments including the seven major FX pairs', () => {
    expect(INSTRUMENTS.length).toBe(9);
  });

  it('should have required instruments', () => {
    const pairs = INSTRUMENTS.map(i => i.pair);
    expect(pairs).toContain('EUR/USD');
    expect(pairs).toContain('GBP/USD');
    expect(pairs).toContain('AUD/USD');
    expect(pairs).toContain('NZD/USD');
    expect(pairs).toContain('USD/CAD');
    expect(pairs).toContain('USD/CHF');
    expect(pairs).toContain('USD/JPY');
    expect(pairs).toContain('GBP/JPY');
    expect(pairs).toContain('XAU/USD');
  });

  it('should mark USD/CAD, USD/CHF, USD/JPY, GBP/JPY as requiring live rates', () => {
    const usdCad = INSTRUMENTS.find(i => i.pair === 'USD/CAD');
    const usdChf = INSTRUMENTS.find(i => i.pair === 'USD/CHF');
    const usdJpy = INSTRUMENTS.find(i => i.pair === 'USD/JPY');
    const gbpJpy = INSTRUMENTS.find(i => i.pair === 'GBP/JPY');

    expect(usdCad?.requiresLiveRate).toBe(true);
    expect(usdChf?.requiresLiveRate).toBe(true);
    expect(usdJpy?.requiresLiveRate).toBe(true);
    expect(gbpJpy?.requiresLiveRate).toBe(true);
  });

  it('should not mark EUR/USD, GBP/USD, AUD/USD, NZD/USD, XAU/USD as requiring live rates', () => {
    const eurusd = INSTRUMENTS.find(i => i.pair === 'EUR/USD');
    const gbpusd = INSTRUMENTS.find(i => i.pair === 'GBP/USD');
    const audusd = INSTRUMENTS.find(i => i.pair === 'AUD/USD');
    const nzdusd = INSTRUMENTS.find(i => i.pair === 'NZD/USD');
    const xauusd = INSTRUMENTS.find(i => i.pair === 'XAU/USD');

    expect(eurusd?.requiresLiveRate).toBe(false);
    expect(gbpusd?.requiresLiveRate).toBe(false);
    expect(audusd?.requiresLiveRate).toBe(false);
    expect(nzdusd?.requiresLiveRate).toBe(false);
    expect(xauusd?.requiresLiveRate).toBe(false);
  });
});