'use client';

import { useState, useEffect } from 'react';
import { calculatePositionSize, INSTRUMENTS, CalculatorInput, CalculatorOutput } from '@/lib/calculator';
import { Trade } from '@/lib/db';
import { calculateTradeStats } from '@/lib/stats';

export default function Home() {
  const [formData, setFormData] = useState<CalculatorInput>({
    pair: 'EUR/USD',
    direction: 'buy',
    entryPrice: 0,
    stopLossPrice: 0,
    riskUsd: 0,
    rewardRatio: undefined,
  });

  const [result, setResult] = useState<CalculatorOutput | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filters, setFilters] = useState({
    pair: '',
    outcome: '',
    startDate: '',
    endDate: '',
  });
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const instrument = INSTRUMENTS.find(i => i.pair === formData.pair);

  useEffect(() => {
    loadTrades();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [trades, filters]);

  const loadTrades = async () => {
    try {
      const response = await fetch('/api/trades');
      const data = await response.json();
      setTrades(data);
    } catch (error) {
      console.error('Error loading trades:', error);
    }
  };

  const calculateStats = () => {
    setStats(calculateTradeStats(trades, filters));
  };

  const handleCalculate = async () => {
    setError('');
    
    if (formData.entryPrice <= 0) {
      setError('Please enter a valid Entry Price');
      return;
    }
    if (formData.stopLossPrice <= 0) {
      setError('Please enter a valid Stop-Loss Price');
      return;
    }
    if (formData.riskUsd <= 0) {
      setError('Please enter a valid Risk Amount');
      return;
    }
    if (formData.entryPrice === formData.stopLossPrice) {
      setError('Entry Price and Stop-Loss Price cannot be the same');
      return;
    }
    
    setCalculating(true);
    try {
      const calculationResult = await calculatePositionSize(formData);
      setResult(calculationResult);
      setSaved(false);
    } catch (error) {
      console.error('Calculation error:', error);
      setError('Calculation failed. Please try again.');
    } finally {
      setCalculating(false);
    }
  };

  const handleSaveTrade = async () => {
    if (!result || isSaving) return;

    setIsSaving(true);

    try {
      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair: formData.pair,
          direction: formData.direction,
          entry_price: formData.entryPrice,
          stop_loss_price: formData.stopLossPrice,
          lot_size: result.recommendedLotSize,
          risk_usd: result.actualRiskUsd,
          tp_price: result.suggestedTpPrice,
          reward_usd: result.rewardUsd,
          notes: notes || null,
          rate_used: result.rateUsed,
          rate_used_display: result.rateUsedDisplay,
        }),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        loadTrades();
        setNotes('');
        setShowNotes(false);
      } else {
        console.error('Save failed:', response.status);
        const errorData = await response.json();
        console.error('Error data:', errorData);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateTrade = async (trade: Trade) => {
    try {
      const response = await fetch(`/api/trades/${trade.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: trade.outcome,
        }),
      });

      if (response.ok) {
        loadTrades();
        setEditingTrade(null);
      }
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  const getFilteredTrades = () => {
    let filtered = [...trades];

    if (filters.pair) {
      filtered = filtered.filter(t => t.pair === filters.pair);
    }

    if (filters.outcome) {
      filtered = filtered.filter(t => t.outcome === filters.outcome);
    }

    if (filters.startDate) {
      filtered = filtered.filter(t => t.timestamp && t.timestamp >= filters.startDate);
    }

    if (filters.endDate) {
      filtered = filtered.filter(t => t.timestamp && t.timestamp <= filters.endDate);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'timestamp') {
        comparison = new Date(a.timestamp || '').getTime() - new Date(b.timestamp || '').getTime();
      } else if (sortBy === 'pair') {
        comparison = a.pair.localeCompare(b.pair);
      } else if (sortBy === 'risk_usd') {
        comparison = a.risk_usd - b.risk_usd;
      } else if (sortBy === 'lot_size') {
        comparison = a.lot_size - b.lot_size;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const filteredTrades = getFilteredTrades();
  const totalPages = Math.ceil(filteredTrades.length / 8);
  const startIndex = (currentPage - 1) * 8;
  const endIndex = startIndex + 8;
  const displayedTrades = filteredTrades.slice(startIndex, endIndex);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleDeleteTrade = async (id: number) => {
    if (!confirm('Are you sure you want to delete this trade?')) return;
    
    try {
      const response = await fetch(`/api/trades/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadTrades();
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const clearFilters = () => {
    setFilters({
      pair: '',
      outcome: '',
      startDate: '',
      endDate: '',
    });
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="bg-slate-800 border-b border-slate-600 py-4 px-6">
        <h1 className="text-2xl font-bold text-center">Sir Smart's position sizing</h1>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-500 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-4 text-blue-400">Calculator</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Pair</label>
                <select
                  value={formData.pair}
                  onChange={(e) => setFormData({ ...formData, pair: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                >
                  {INSTRUMENTS.map((inst) => (
                    <option key={inst.pair} value={inst.pair}>{inst.pair}</option>
                  ))}
                </select>
                {instrument?.requiresLiveRate && (
                  <p className="text-xs text-amber-400 mt-1">🔴 Live rate calculation</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Direction</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, direction: 'buy' })}
                    className={`flex-1 px-3 py-2 rounded-md ${
                      formData.direction === 'buy' ? 'bg-green-600 text-white' : 'bg-slate-700 text-gray-300'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, direction: 'sell' })}
                    className={`flex-1 px-3 py-2 rounded-md ${
                      formData.direction === 'sell' ? 'bg-red-600 text-white' : 'bg-slate-700 text-gray-300'
                    }`}
                  >
                    Sell
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Entry Price</label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.entryPrice || ''}
                  onChange={(e) => setFormData({ ...formData, entryPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                  placeholder="1.0850"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Stop-Loss Price</label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.stopLossPrice || ''}
                  onChange={(e) => setFormData({ ...formData, stopLossPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                  placeholder="1.0800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Risk Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.riskUsd || ''}
                  onChange={(e) => setFormData({ ...formData, riskUsd: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                  placeholder="50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Reward Ratio (optional)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.rewardRatio || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    rewardRatio: e.target.value ? parseFloat(e.target.value) : undefined 
                  })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                  placeholder="2"
                />
              </div>

              <button
                onClick={handleCalculate}
                disabled={calculating}
                className="w-full bg-amber-500 text-gray-900 py-3 px-4 rounded-md hover:bg-amber-600 transition-colors font-medium disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {calculating ? 'Calculating...' : 'Calculate'}
              </button>

              {error && (
                <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-2 rounded-md text-sm">
                  {error}
                </div>
              )}
            </div>

            {result && (
              <div className="mt-6 bg-slate-700 rounded-lg p-4 border border-slate-500">
                <h3 className="text-lg font-semibold mb-3 text-sky-400">Calculation Results</h3>
                
                {result.rateUsedDisplay && (
                  <div className="bg-sky-900 border border-sky-600 rounded-md p-2 mb-3">
                    <p className="text-xs text-sky-300">ℹ️ Calculated using live rate: {result.rateUsedDisplay}</p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1 border-b border-gray-600">
                    <span className="text-gray-300">Stop Distance</span>
                    <span className="font-semibold">{result.stopDistancePips.toFixed(1)} pips</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-1 border-b border-gray-600">
                    <span className="text-gray-300">Recommended Lot Size</span>
                    <span className="font-semibold text-amber-400">{result.recommendedLotSize.toFixed(2)} lots</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-1 border-b border-gray-600">
                    <span className="text-gray-300">Actual $ Risk</span>
                    <span className={`font-semibold ${result.actualRiskUsd > formData.riskUsd ? 'text-red-400' : 'text-green-400'}`}>
                      ${result.actualRiskUsd.toFixed(2)}
                    </span>
                  </div>
                  
                  {result.suggestedTpPrice && (
                    <>
                      <div className="flex justify-between items-center py-1 border-b border-gray-600">
                        <span className="text-gray-300">Suggested TP Price</span>
                        <span className="font-semibold text-green-400">{result.suggestedTpPrice.toFixed(4)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center py-1 border-b border-gray-600">
                        <span className="text-gray-300">$ Reward at TP</span>
                        <span className="font-semibold text-green-400">${result.rewardUsd?.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => setShowNotes(!showNotes)}
                    className="w-full bg-gray-600 text-gray-200 py-2 px-4 rounded-md hover:bg-gray-500 transition-colors"
                  >
                    {showNotes ? 'Hide Notes' : 'Add Notes & Save to Log'}
                  </button>
                  
                  {showNotes && (
                    <div className="space-y-2">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes about this trade..."
                        rows={2}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                      />
                      <button
                        onClick={handleSaveTrade}
                        disabled={saved}
                        className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                          saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {saved ? '✓ Saved' : 'Save to Log'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-500">
            <h2 className="text-xl font-semibold mb-4 text-sky-400">Trade Log</h2>

            <div className="grid grid-cols-4 gap-2 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Pair</label>
                <select
                  value={filters.pair}
                  onChange={(e) => setFilters({ ...filters, pair: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 border border-slate-500 rounded text-sm text-white"
                >
                  <option value="">All</option>
                  {INSTRUMENTS.map((inst) => (
                    <option key={inst.pair} value={inst.pair}>{inst.pair}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Outcome</label>
                <select
                  value={filters.outcome}
                  onChange={(e) => setFilters({ ...filters, outcome: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 border border-slate-500 rounded text-sm text-white"
                >
                  <option value="">All</option>
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                  <option value="breakeven">Breakeven</option>
                  <option value="open">Open</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 border border-slate-500 rounded text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 border border-slate-500 rounded text-sm text-white"
                />
              </div>
            </div>

            <button
              onClick={clearFilters}
              className="mb-4 text-sm text-sky-400 hover:text-sky-300"
            >
              Clear Filters
            </button>

            {stats && (
              <div className="grid grid-cols-4 gap-3 mb-4 bg-slate-700 p-3 rounded-lg">
                <div>
                  <div className="text-xs text-gray-400">Win Rate</div>
                  <div className="text-lg font-bold text-green-400">{stats.winRate}% ({stats.wins}/{stats.completedTrades})</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Average R</div>
                  <div className="text-lg font-bold text-sky-400">{stats.avgR}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Total $ Risked</div>
                  <div className="text-lg font-bold text-amber-400">${stats.totalRisked.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Total $ Result</div>
                  <div className={`text-lg font-bold ${stats.totalResult >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stats.totalResult >= 0 ? '+' : ''}${stats.totalResult.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-500">
                    <th 
                      onClick={() => handleSort('timestamp')}
                      className="text-left py-2 px-2 text-gray-400 font-medium cursor-pointer hover:text-white"
                    >
                      Date {sortBy === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('pair')}
                      className="text-left py-2 px-2 text-gray-400 font-medium cursor-pointer hover:text-white"
                    >
                      Pair {sortBy === 'pair' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Direction</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Entry</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Stop</th>
                    <th 
                      onClick={() => handleSort('lot_size')}
                      className="text-left py-2 px-2 text-gray-400 font-medium cursor-pointer hover:text-white"
                    >
                      Lot Size {sortBy === 'lot_size' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('risk_usd')}
                      className="text-left py-2 px-2 text-gray-400 font-medium cursor-pointer hover:text-white"
                    >
                      Risk $ {sortBy === 'risk_usd' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">TP</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Outcome</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Actions</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-4 text-center text-gray-500">No trades found.</td>
                    </tr>
                  ) : (
                    displayedTrades.map((trade) => (
                      <tr key={trade.id} className="border-b border-slate-600 hover:bg-slate-700">
                        <td className="py-2 px-2 text-gray-300">
                          {trade.timestamp ? new Date(trade.timestamp).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-2 px-2 text-gray-300">{trade.pair}</td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            trade.direction === 'buy' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                          }`}>
                            {trade.direction.charAt(0).toUpperCase() + trade.direction.slice(1)}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-gray-300">{trade.entry_price.toFixed(4)}</td>
                        <td className="py-2 px-2 text-gray-300">{trade.stop_loss_price.toFixed(4)}</td>
                        <td className="py-2 px-2 text-gray-300">{trade.lot_size.toFixed(2)}</td>
                        <td className="py-2 px-2 text-gray-300">${trade.risk_usd.toFixed(2)}</td>
                        <td className="py-2 px-2 text-gray-300">{trade.tp_price ? trade.tp_price.toFixed(4) : '-'}</td>
                        <td className="py-2 px-2">
                          {editingTrade?.id === trade.id ? (() => {
                            const currentTrade = editingTrade!;
                            return (
                            <select
                              value={currentTrade.outcome || ''}
                              onChange={(e) => setEditingTrade({ ...currentTrade, outcome: e.target.value as any })}
                              className="px-2 py-1 bg-slate-700 border border-slate-500 rounded text-xs text-white"
                            >
                              <option value="">Select</option>
                              <option value="win">Win</option>
                              <option value="loss">Loss</option>
                              <option value="breakeven">Breakeven</option>
                              <option value="open">Open</option>
                            </select>
                            );
                          })() : (
                            <span 
                              className={`px-2 py-1 rounded text-xs cursor-pointer hover:opacity-80 ${
                                !trade.outcome ? 'bg-slate-600 text-gray-300' :
                                trade.outcome === 'win' ? 'bg-green-900 text-green-300' :
                                trade.outcome === 'loss' ? 'bg-red-900 text-red-300' :
                                trade.outcome === 'breakeven' ? 'bg-yellow-900 text-yellow-300' :
                                'bg-sky-900 text-sky-300'
                              }`}
                              onClick={() => setEditingTrade(trade)}
                              title="Click to edit outcome"
                            >
                              {trade.outcome ? trade.outcome.charAt(0).toUpperCase() + trade.outcome.slice(1) : 'Open'}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {editingTrade?.id === trade.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => editingTrade && handleUpdateTrade(editingTrade)}
                                className="text-green-400 hover:text-green-300 text-xs"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingTrade(null)}
                                className="text-gray-400 hover:text-gray-300 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingTrade(trade)}
                                className="text-sky-400 hover:text-sky-300 text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteTrade(trade.id!)}
                                className="text-red-400 hover:text-red-300 text-xs"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-gray-400 text-xs max-w-xs truncate" title={trade.notes || ''}>
                          {trade.notes || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredTrades.length > 0 && (
              <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-sm text-gray-500">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredTrades.length)} of {filteredTrades.length} trades
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-slate-700 text-white rounded disabled:bg-slate-800 disabled:text-gray-500 text-sm"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-slate-700 text-white rounded disabled:bg-slate-800 disabled:text-gray-500 text-sm"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-slate-700 text-white rounded disabled:bg-slate-800 disabled:text-gray-500 text-sm"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-slate-700 text-white rounded disabled:bg-slate-800 disabled:text-gray-500 text-sm"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}