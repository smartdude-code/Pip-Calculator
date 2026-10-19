export interface Instrument {
  pair: string;
  pipDecimalPlace: number;
  pipValuePerLot: number;
  hasApproximatePipValue: boolean;
  requiresLiveRate: boolean;
  ratePair?: string; // The currency pair to fetch from the API
}

export const INSTRUMENTS: Instrument[] = [
  { pair: 'EUR/USD', pipDecimalPlace: 4, pipValuePerLot: 10, hasApproximatePipValue: false, requiresLiveRate: false },
  { pair: 'EUR/GBP', pipDecimalPlace: 4, pipValuePerLot: 10, hasApproximatePipValue: false, requiresLiveRate: true, ratePair: 'GBP-USD' },
  { pair: 'GBP/USD', pipDecimalPlace: 4, pipValuePerLot: 10, hasApproximatePipValue: false, requiresLiveRate: false },
  { pair: 'AUD/USD', pipDecimalPlace: 4, pipValuePerLot: 10, hasApproximatePipValue: false, requiresLiveRate: false },
  { pair: 'NZD/USD', pipDecimalPlace: 4, pipValuePerLot: 10, hasApproximatePipValue: false, requiresLiveRate: false },
  { pair: 'USD/CAD', pipDecimalPlace: 4, pipValuePerLot: 7.40, hasApproximatePipValue: false, requiresLiveRate: true, ratePair: 'USD-CAD' },
  { pair: 'USD/CHF', pipDecimalPlace: 4, pipValuePerLot: 10, hasApproximatePipValue: false, requiresLiveRate: true, ratePair: 'USD-CHF' },
  { pair: 'USD/JPY', pipDecimalPlace: 2, pipValuePerLot: 7.50, hasApproximatePipValue: false, requiresLiveRate: true, ratePair: 'USD-JPY' },
  { pair: 'GBP/JPY', pipDecimalPlace: 2, pipValuePerLot: 7.50, hasApproximatePipValue: false, requiresLiveRate: true, ratePair: 'USD-JPY' },
  { pair: 'XAU/USD', pipDecimalPlace: 2, pipValuePerLot: 10, hasApproximatePipValue: false, requiresLiveRate: false },
];

export interface CalculatorInput {
  pair: string;
  direction: 'buy' | 'sell';
  entryPrice: number;
  stopLossPrice: number;
  riskUsd: number;
  rewardRatio?: number;
}

export interface CalculatorOutput {
  stopDistancePips: number;
  recommendedLotSize: number;
  actualRiskUsd: number;
  suggestedTpPrice?: number;
  rewardUsd?: number;
  hasApproximatePipValue: boolean;
  instrument: Instrument;
  rateUsed?: number;
  rateUsedDisplay?: string;
}

export function formatLotSize(lotSize: number): string {
  return lotSize.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 10,
  });
}

// Rate cache to avoid repeated API calls
let rateCache: Record<string, { rate: number; timestamp: number }> = {};
const CACHE_DURATION = parseInt(process.env.EXCHANGE_RATE_CACHE_DURATION || '300000'); // 5 minutes default

async function getExchangeRate(from: string, to: string): Promise<number> {
  const cacheKey = `${from}-${to}`;
  const cached = rateCache[cacheKey];
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.rate;
  }

  try {
    // Try ExchangeRate-API first (free, no key required)
    const apiUrl = process.env.EXCHANGE_RATE_API_URL || 'https://open.er-api.com/v6/latest';
    const response = await fetch(`${apiUrl}/${from}`);
    const data = await response.json();
    
    if (data.rates && data.rates[to]) {
      const rate = data.rates[to];
      rateCache[cacheKey] = { rate, timestamp: Date.now() };
      return rate;
    }
    
    throw new Error('Rate not found in response');
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    // Return fallback rate if API fails
    if (from === 'USD' && to === 'CAD') return parseFloat(process.env.FALLBACK_USD_CAD || '1.36');
    if (from === 'USD' && to === 'JPY') return parseFloat(process.env.FALLBACK_USD_JPY || '147.0');
    if (from === 'GBP' && to === 'USD') return parseFloat(process.env.FALLBACK_GBP_USD || '1.27');
    throw error;
  }
}

export async function calculatePositionSize(input: CalculatorInput): Promise<CalculatorOutput> {
  const instrument = INSTRUMENTS.find(i => i.pair === input.pair);
  if (!instrument) {
    throw new Error(`Invalid instrument: ${input.pair}`);
  }

  // Calculate pip value dynamically for pairs that require live rates
  let pipValuePerLot = instrument.pipValuePerLot;
  let rateUsed: number | undefined;
  let rateUsedDisplay: string | undefined;

  if (instrument.requiresLiveRate && instrument.ratePair) {
    const [from, to] = instrument.ratePair.split('-');
    
    if (input.pair === 'EUR/GBP') {
      // EUR/GBP: pip value in USD = £10 × current GBP/USD rate
      const gbpUsdRate = await getExchangeRate('GBP', 'USD');
      pipValuePerLot = 10 * gbpUsdRate;
      rateUsed = gbpUsdRate;
      rateUsedDisplay = `GBP/USD = ${gbpUsdRate.toFixed(2)}`;
    } else if (input.pair === 'USD/CAD') {
      // USD/CAD: pip value (USD) = $10 ÷ current USD/CAD rate
      const usdCadRate = await getExchangeRate('USD', 'CAD');
      pipValuePerLot = 10 / usdCadRate;
      rateUsed = usdCadRate;
      rateUsedDisplay = `USD/CAD = ${usdCadRate.toFixed(2)}`;
    } else if (input.pair === 'USD/CHF') {
      // USD/CHF: pip value (USD) = $10 ÷ current USD/CHF rate
      const usdChfRate = await getExchangeRate('USD', 'CHF');
      pipValuePerLot = 10 / usdChfRate;
      rateUsed = usdChfRate;
      rateUsedDisplay = `USD/CHF = ${usdChfRate.toFixed(2)}`;
    } else if (input.pair === 'USD/JPY') {
      // USD/JPY: pip value (USD) = (0.01 ÷ current USD/JPY rate) × 100,000
      const usdJpyRate = await getExchangeRate('USD', 'JPY');
      pipValuePerLot = (0.01 / usdJpyRate) * 100000;
      rateUsed = usdJpyRate;
      rateUsedDisplay = `USD/JPY = ${usdJpyRate.toFixed(2)}`;
    } else if (input.pair === 'GBP/JPY') {
      // GBP/JPY: pip value (USD) = (0.01 ÷ current USD/JPY rate) × 100,000
      // Note: We need USD/JPY rate for GBP/JPY as well since we're calculating USD value
      const usdJpyRate = await getExchangeRate('USD', 'JPY');
      pipValuePerLot = (0.01 / usdJpyRate) * 100000;
      rateUsed = usdJpyRate;
      rateUsedDisplay = `USD/JPY = ${usdJpyRate.toFixed(2)}`;
    }
  }

  // Calculate stop distance in pips
  const priceDifference = Math.abs(input.entryPrice - input.stopLossPrice);
  const pipMultiplier = Math.pow(10, instrument.pipDecimalPlace);
  const stopDistancePips = Math.round(priceDifference * pipMultiplier * 100) / 100;

  // Handle zero stop distance
  if (stopDistancePips === 0) {
    return {
      stopDistancePips: 0,
      recommendedLotSize: 0,
      actualRiskUsd: 0,
      hasApproximatePipValue: instrument.hasApproximatePipValue,
      instrument,
      rateUsed,
      rateUsedDisplay,
    };
  }

  // Calculate raw lot size
  const rawLotSize = input.riskUsd / (stopDistancePips * pipValuePerLot);
  const recommendedLotSize = Math.max(0, rawLotSize);
  const actualRiskUsd = recommendedLotSize > 0 ? input.riskUsd : 0;

  // Calculate TP and reward if reward ratio is provided
  let suggestedTpPrice: number | undefined;
  let rewardUsd: number | undefined;

  if (input.rewardRatio && input.rewardRatio > 0) {
    const targetDistancePips = stopDistancePips * input.rewardRatio;
    const targetPriceDifference = targetDistancePips / pipMultiplier;

    if (input.direction === 'buy') {
      suggestedTpPrice = input.entryPrice + targetPriceDifference;
    } else {
      suggestedTpPrice = input.entryPrice - targetPriceDifference;
    }

    rewardUsd = recommendedLotSize * targetDistancePips * pipValuePerLot;
  }

  return {
    stopDistancePips,
    recommendedLotSize,
    actualRiskUsd,
    suggestedTpPrice,
    rewardUsd,
    hasApproximatePipValue: instrument.hasApproximatePipValue,
    instrument,
    rateUsed,
    rateUsedDisplay,
  };
}