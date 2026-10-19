'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trade } from '@/lib/db';
import { formatLotSize, INSTRUMENTS } from '@/lib/calculator';

export default function TradeLog() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    pair: '',
    outcome: '',
    startDate: '',
    endDate: '',
  });
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadTrades();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [trades, filters, sortBy, sortOrder]);

  const loadTrades = async () => {
    try {
      const response = await fetch('/api/trades');
      const data = await response.json();
      setTrades(data);
    } catch (error) {
      console.error('Error loading trades:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
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

    setFilteredTrades(filtered);
  };

  const loadStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.pair) params.append('pair', filters.pair);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      
      const response = await fetch(`/api/stats?${params}`);
      const data = await response.json();
      setStats(data);
      setShowStats(true);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleUpdateTrade = async (trade: Trade) => {
    try {
      const response = await fetch(`/api/trades/${trade.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: trade.outcome,
          close_price: trade.close_price,
        }),
      });

      if (response.ok) {
        loadTrades();
        setEditingTrade(null);
      }
    } catch (error) {
      console.error('Error updating trade:', error);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center trade-log-page">
        <div className="text-gray-600">Loading trades...</div>
      </div>
    );
  }

  return (
    <div className="trade-log-site">
      <header className="trading-topbar">
        <Link className="brand-lockup" href="/" aria-label="Smart Trader home">
          <span className="brand-mark">S</span>
          <span>SMART<span>TRADER</span></span>
        </Link>
        <div className="workspace-indicator">TRADING WORKSPACE</div>
        <nav className="topbar-nav" aria-label="Main navigation">
          <Link href="/">Calculator</Link>
          <Link href="/log" aria-current="page">Trade log</Link>
        </nav>
      </header>

      <main className="min-h-screen bg-gray-50 py-8 px-4 trade-log-page">
        <div className="max-w-7xl mx-auto trade-log-content">
          <header className="flex justify-between items-center mb-8 trade-log-header">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Trade Log</h1>
              <p>Review your history, performance, and open positions.</p>
            </div>
          </header>

        {/* Filters */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6 trade-log-panel">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pair</label>
              <select
                value={filters.pair}
                onChange={(e) => setFilters({ ...filters, pair: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Pairs</option>
                {INSTRUMENTS.map((inst) => (
                  <option key={inst.pair} value={inst.pair}>
                    {inst.pair}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
              <select
                value={filters.outcome}
                onChange={(e) => setFilters({ ...filters, outcome: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Outcomes</option>
                <option value="win">Win</option>
                <option value="loss">Loss</option>
                <option value="breakeven">Breakeven</option>
                <option value="open">Open</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={loadStats}
              className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
            >
              Show Statistics
            </button>
            <button
              onClick={() => setFilters({ pair: '', outcome: '', startDate: '', endDate: '' })}
              className="bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </section>

        {/* Statistics */}
        {showStats && stats && (
          <section className="bg-white rounded-lg shadow-md p-6 mb-6 trade-log-panel">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Total Trades</div>
                <div className="text-2xl font-bold text-blue-600">{stats.totalTrades}</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Win Rate</div>
                <div className="text-2xl font-bold text-green-600">{stats.winRate}%</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Total Lost</div>
                <div className="text-2xl font-bold text-purple-600">${stats.totalRisked.toFixed(2)}</div>
              </div>
              <div className="bg-amber-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Net Result</div>
                <div className={`text-2xl font-bold ${stats.netResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${stats.netResult.toFixed(2)}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowStats(false)}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700"
            >
              Hide Statistics
            </button>
          </section>
        )}

        {/* Trade Table */}
        <section className="bg-white rounded-lg shadow-md overflow-hidden trade-log-panel">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort('timestamp')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Date {sortBy === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('pair')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Pair {sortBy === 'pair' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Direction
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entry
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stop
                  </th>
                  <th
                    onClick={() => handleSort('lot_size')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Lots {sortBy === 'lot_size' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('risk_usd')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Risk ($) {sortBy === 'risk_usd' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TP
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reward ($)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outcome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate Used
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTrades.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                      No trades found. {trades.length === 0 ? 'Start by calculating and saving some trades!' : 'Try adjusting your filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredTrades.map((trade) => (
                    <tr key={trade.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {trade.timestamp ? new Date(trade.timestamp).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {trade.pair}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          trade.direction === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {trade.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {trade.entry_price.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {trade.stop_loss_price.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatLotSize(trade.lot_size)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        ${trade.risk_usd.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {trade.tp_price ? trade.tp_price.toFixed(4) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {trade.reward_usd ? `$${trade.reward_usd.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {editingTrade?.id === trade.id ? (() => {
                          const currentTrade = editingTrade!;
                          return (
                          <select
                            value={currentTrade.outcome || ''}
                            onChange={(e) => setEditingTrade({ ...currentTrade, outcome: e.target.value as any })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="">Select</option>
                            <option value="win">Win</option>
                            <option value="loss">Loss</option>
                            <option value="breakeven">Breakeven</option>
                            <option value="open">Open</option>
                          </select>
                          );
                        })() : (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            !trade.outcome ? 'bg-gray-100 text-gray-800' :
                            trade.outcome === 'win' ? 'bg-green-100 text-green-800' :
                            trade.outcome === 'loss' ? 'bg-red-100 text-red-800' :
                            trade.outcome === 'breakeven' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {trade.outcome ? trade.outcome.charAt(0).toUpperCase() + trade.outcome.slice(1) : 'Open'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {trade.notes || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {trade.rate_used_display || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {editingTrade?.id === trade.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => editingTrade && handleUpdateTrade(editingTrade)}
                              className="text-green-600 hover:text-green-800"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingTrade(null)}
                              className="text-gray-600 hover:text-gray-800"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingTrade(trade)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        </div>
      </main>
    </div>
  );
}