import { calculatePositionSize, formatLotSize, INSTRUMENTS } from './calculator';

// Mock the global fetch for API calls
global.fetch = jest.fn();

describe('calculatePositionSize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exact risk lot size calculation', () => {
    it('should calculate the lot size needed to use the full risk amount', async () => {
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
      expect(result.recommendedLotSize).toBe(0.2);
      expect(result.actualRiskUsd).toBe(100);
    });

    it('should preserve lot size precision beyond two decimal places', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'EUR/USD',
        direction: 'buy',
        entryPrice: 1.1000,
        stopLossPrice: 1.0990,
        riskUsd: 15.25,
      });

      // EUR/USD: 10 pips * $10/pip = $100 per lot; $15.25 risk needs 0.1525 lots.
      expect(result.recommendedLotSize).toBe(0.1525);
      expect(result.actualRiskUsd).toBe(15.25);
    });

    it('should use the full requested risk for a fractional lot size', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: {} }),
      });

      const result = await calculatePositionSize({
        pair: 'EUR/USD',
        direction: 'buy',
        entryPrice: 1.1000,
        stopLossPrice: 1.0991,
        riskUsd: 13.37,
      });

      expect(result.recommendedLotSize).toBeCloseTo(13.37 / 90, 10);
      expect(result.recommendedLotSize).not.toBe(Math.floor((13.37 / 90) * 100) / 100);
      expect(result.actualRiskUsd).toBe(13.37);
    });

    it('should use the exact lot size when risk is a precise hundredth multiple', async () => {
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
      expect(result.recommendedLotSize).toBe(0.19);
      expect(result.actualRiskUsd).toBe(95);
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
      expect(result.recommendedLotSize).toBe(0.1);
      expect(result.actualRiskUsd).toBe(5);
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

    it('should calculate EUR/GBP correctly using the live GBP/USD rate', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ rates: { USD: 1.25 } }),
      });

      const result = await calculatePositionSize({
        pair: 'EUR/GBP',
        direction: 'buy',
        entryPrice: 0.8500,
        stopLossPrice: 0.8450,
        riskUsd: 100,
      });

      expect(result.stopDistancePips).toBe(50);
      expect(result.recommendedLotSize).toBeCloseTo(0.16);
      expect(result.actualRiskUsd).toBe(100);
      expect(result.rateUsed).toBe(1.25);
      expect(result.rateUsedDisplay).toBe('GBP/USD = 1.25');
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
      // pip value = $10 / 1.36 per pip
      expect(result.recommendedLotSize).toBeCloseTo(100 / (50 * (10 / 1.36)), 10);
      expect(result.actualRiskUsd).toBe(100);
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
      expect(result.actualRiskUsd).toBe(100);
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
      expect(result.recommendedLotSize).toBeCloseTo(0.294, 3);
      expect(result.actualRiskUsd).toBe(100);
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
      expect(result.recommendedLotSize).toBeCloseTo(0.294, 3);
      expect(result.actualRiskUsd).toBe(100);
      expect(result.hasApproximatePipValue).toBe(false);
      expect(result.rateUsed).toBe(147.0);
      expect(result.rateUsedDisplay).toBe('USD/JPY = 147.00');
    });

    it.each(['EUR/JPY', 'AUD/JPY', 'NZD/JPY', 'CHF/JPY', 'CAD/JPY'])(
      'should calculate %s correctly with the live USD/JPY rate',
      async (pair) => {
        (global.fetch as jest.Mock).mockResolvedValue({
          json: async () => ({ rates: { JPY: 147.0 } }),
        });

        const result = await calculatePositionSize({
          pair,
          direction: 'buy',
          entryPrice: 150.00,
          stopLossPrice: 149.50,
          riskUsd: 100,
        });

        expect(result.stopDistancePips).toBe(50);
        expect(result.recommendedLotSize).toBeCloseTo(0.294, 3);
        expect(result.actualRiskUsd).toBe(100);
        expect(result.rateUsed).toBe(147.0);
        expect(result.rateUsedDisplay).toBe('USD/JPY = 147.00');
      }
    );

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
      expect(result.recommendedLotSize).toBe(0.02);
      expect(result.actualRiskUsd).toBe(100);
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

describe('formatLotSize', () => {
  it('shows enough precision for fractional lot sizes', () => {
    expect(formatLotSize(13.37 / 90)).toBe('0.1485555556');
  });

  it('keeps two decimal places when the lot size is exact to hundredths', () => {
    expect(formatLotSize(0.2)).toBe('0.20');
  });
});

describe('INSTRUMENTS constant', () => {
  it('should include the FX pairs and gold instrument', () => {
    expect(INSTRUMENTS.length).toBe(15);
  });

  it('should have required instruments', () => {
    const pairs = INSTRUMENTS.map(i => i.pair);
    expect(pairs).toContain('EUR/USD');
    expect(pairs).toContain('EUR/GBP');
    expect(pairs).toContain('GBP/USD');
    expect(pairs).toContain('AUD/USD');
    expect(pairs).toContain('NZD/USD');
    expect(pairs).toContain('USD/CAD');
    expect(pairs).toContain('USD/CHF');
    expect(pairs).toContain('USD/JPY');
    expect(pairs).toContain('GBP/JPY');
    expect(pairs).toContain('EUR/JPY');
    expect(pairs).toContain('AUD/JPY');
    expect(pairs).toContain('NZD/JPY');
    expect(pairs).toContain('CHF/JPY');
    expect(pairs).toContain('CAD/JPY');
    expect(pairs).toContain('XAU/USD');
  });

  it('should mark pairs that need live rates accordingly', () => {
    const eurGbp = INSTRUMENTS.find(i => i.pair === 'EUR/GBP');
    const usdCad = INSTRUMENTS.find(i => i.pair === 'USD/CAD');
    const usdChf = INSTRUMENTS.find(i => i.pair === 'USD/CHF');

    expect(eurGbp?.requiresLiveRate).toBe(true);
    expect(usdCad?.requiresLiveRate).toBe(true);
    expect(usdChf?.requiresLiveRate).toBe(true);
    for (const pair of ['USD/JPY', 'GBP/JPY', 'EUR/JPY', 'AUD/JPY', 'NZD/JPY', 'CHF/JPY', 'CAD/JPY']) {
      expect(INSTRUMENTS.find(i => i.pair === pair)?.requiresLiveRate).toBe(true);
    }
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