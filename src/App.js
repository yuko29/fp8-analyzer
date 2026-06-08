import React, { useState, useMemo } from 'react';
import {LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea} from 'recharts';
import { Settings, ZoomIn, ZoomOut } from 'lucide-react';
import { generateFP8Data } from './fp8/generate';
import CompareView from './compare/CompareView';

const FP8Analyzer = () => {

  const [mode, setMode] = useState('single');
  const [exponentBits, setExponentBits] = useState(4);
  const [mantissaBits, setMantissaBits] = useState(3);
  const [exponentBias, setExponentBias] = useState(7);
  const [floatFormat, setFloatFormat] = useState('IEEE');

  // Zoom state
  const [zoomState, setZoomState] = useState({ left: 'dataMin', right: 'dataMax', top: 'dataMax', bottom: 'dataMin' });
  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);

  const fp8Data = useMemo(
    () => generateFP8Data({ exponentBits, mantissaBits, exponentBias, floatFormat }),
    [exponentBits, mantissaBits, exponentBias, floatFormat]
  );
  const { stats, distributionData, histogramData } = fp8Data ?? { stats: null, distributionData: [], histogramData: [] };

  const zoomOut = () => {
    setZoomState({ left: 'dataMin', right: 'dataMax', top: 'dataMax', bottom: 'dataMin' });
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const handleMouseDown = (e) => {
    if (e && e.activeLabel !== undefined) {
      setRefAreaLeft(e.activeLabel);
      setRefAreaRight(e.activeLabel);
    }
  };

  const handleMouseMove = (e) => {
    if (refAreaLeft !== null && e && e.activeLabel !== undefined) {
      setRefAreaRight(e.activeLabel);
    }
  };

  const handleMouseUp = () => {
    if (refAreaLeft !== null && refAreaRight !== null && refAreaLeft !== refAreaRight) {
      let left = Math.min(refAreaLeft, refAreaRight);
      let right = Math.max(refAreaLeft, refAreaRight);

      // Find Y range more efficiently
      const minIdx = Math.max(0, left + Math.floor(distributionData.length / 2));
      const maxIdx = Math.min(distributionData.length - 1, right + Math.floor(distributionData.length / 2));
      
      let bottom = Infinity;
      let top = -Infinity;
      
      for (let i = minIdx; i <= maxIdx; i++) {
        const val = distributionData[i].value;
        if (val < bottom) bottom = val;
        if (val > top) top = val;
      }
      
      const padding = (top - bottom) * 0.1;
      setZoomState({ 
        left, 
        right, 
        bottom: bottom - padding,
        top: top + padding 
      });
    }
    
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div style={{ margin: 0, padding: '10px', backgroundColor: '#1e293b', border: '1px solid #475569', whiteSpace: 'nowrap' }}>
          <p>FP8 value: {item.value}</p>
          <p>Binary: {item.binary}</p>
          <p>Index: {item.index}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Settings className="w-10 h-10" />
            FP8 Values Analyzer
          </h1>
          <p className="text-blue-200">Interactive 8-bit Floating Point Format Explorer</p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('single')}
            className={`px-5 py-2 rounded-lg font-medium transition-colors ${
              mode === 'single' ? 'bg-blue-500 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'
            }`}
          >
            Single Format
          </button>
          <button
            onClick={() => setMode('compare')}
            className={`px-5 py-2 rounded-lg font-medium transition-colors ${
              mode === 'compare' ? 'bg-blue-500 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'
            }`}
          >
            Compare
          </button>
        </div>

        {mode === 'compare' ? (
          <CompareView />
        ) : !stats ? (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
            <p className="text-xl">Bits must sum to 8 (1 sign + exp + mantissa)</p>
          </div>
        ) : (
          <>
        {/* Controls */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 border border-white/20">
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">Floating-Point Format</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => setFloatFormat('IEEE')}
                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                  floatFormat === 'IEEE' 
                    ? 'bg-blue-500 text-white shadow-lg' 
                    : 'bg-white/5 hover:bg-white/10 text-gray-300'
                }`}
              >
                <div className="font-bold">IEEE 754</div>
                <div className="text-xs mt-1">±Inf, ±0, NaN, Subnormals</div>
              </button>
              <button
                onClick={() => setFloatFormat('FN')}
                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                  floatFormat === 'FN' 
                    ? 'bg-blue-500 text-white shadow-lg' 
                    : 'bg-white/5 hover:bg-white/10 text-gray-300'
                }`}
              >
                <div className="font-bold">FN (Finite, No Inf)</div>
                <div className="text-xs mt-1">NaN, ±0, No Inf, Has Subnormals</div>
              </button>
              <button
                onClick={() => setFloatFormat('FNUZ')}
                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                  floatFormat === 'FNUZ' 
                    ? 'bg-blue-500 text-white shadow-lg' 
                    : 'bg-white/5 hover:bg-white/10 text-gray-300'
                }`}
              >
                <div className="font-bold">FNUZ</div>
                <div className="text-xs mt-1">-0→NaN, +0 only, No Inf, Has Subnormals</div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Exponent Bits: {exponentBits}
              </label>
              <input
                type="range"
                min="2"
                max="5"
                value={exponentBits}
                onChange={(e) => {
                  const newExp = parseInt(e.target.value);
                  setExponentBits(newExp);
                  setMantissaBits(7 - newExp);
                }}
                className="w-full"
              />
              <p className="text-xs text-blue-200 mt-1">Range: 2-5 bits</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Mantissa Bits: {mantissaBits}
              </label>
              <input
                type="range"
                min="2"
                max="5"
                value={mantissaBits}
                onChange={(e) => {
                  const newMant = parseInt(e.target.value);
                  setMantissaBits(newMant);
                  setExponentBits(7 - newMant);
                }}
                className="w-full"
              />
              <p className="text-xs text-blue-200 mt-1">Range: 2-5 bits</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Exponent Bias: {exponentBias}
              </label>
              <input
                type="range"
                min="0"
                max="63"
                value={exponentBias}
                onChange={(e) => setExponentBias(parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-blue-200 mt-1">
                Standard: {Math.pow(2, exponentBits - 1) - 1}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm">
            <div className="px-3 py-1 bg-blue-500/30 rounded">
              Format: 1 sign + {exponentBits} exp + {mantissaBits} mantissa = {1 + exponentBits + mantissaBits} bits
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <div className="text-2xl font-bold text-blue-300">{stats.total}</div>
            <div className="text-sm text-gray-300">Total Values</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <div className="text-2xl font-bold text-green-300">{stats.normal}</div>
            <div className="text-sm text-gray-300">Normal</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <div className="text-2xl font-bold text-yellow-300">{stats.subnormal}</div>
            <div className="text-sm text-gray-300">Subnormal</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <div className="text-2xl font-bold text-purple-300">{stats.zeros}</div>
            <div className="text-sm text-gray-300">Zeros</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <div className="text-2xl font-bold text-red-300">{stats.infinity}</div>
            <div className="text-sm text-gray-300">Infinity</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <div className="text-2xl font-bold text-orange-300">{stats.nan}</div>
            <div className="text-sm text-gray-300">NaN</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <div className="text-lg font-bold text-cyan-300">{stats.minPositive.toExponential(3)}</div>
            <div className="text-sm text-gray-300">Min Positive</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <div className="text-lg font-bold text-cyan-300">{stats.maxPositive.toExponential(3)}</div>
            <div className="text-sm text-gray-300">Max Positive</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <div className="text-lg font-bold text-cyan-300">{stats.dynamicRange.toExponential(3)}</div>
            <div className="text-sm text-gray-300">Dynamic Range</div>
          </div>
        </div>

        {/* Value Distribution with Zoom */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 border border-white/20">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Value Distribution</h2>
            <button
              onClick={zoomOut}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
              Reset Zoom
            </button>
          </div>
          <p className="text-sm text-blue-200 mb-3">
            <ZoomIn className="w-4 h-4 inline mr-1" />
            Click and drag to zoom in on a specific range
          </p>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              margin={{ top: 5, right: 30, left: 50, bottom: 35 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff30" />
              <XAxis 
                dataKey="index" 
                stroke="#fff"
                label={{ value: 'Value Index', position: 'insideBottom', offset: -20, fill: '#fff' }}
                domain={[zoomState.left, zoomState.right]}
                type="number"
                allowDecimals={false}
                allowDataOverflow
                ticks={(() => {
                  if (distributionData.length === 0) return [];
                  const left = zoomState.left === 'dataMin' ? Math.min(...distributionData.map(d => d.index)) : zoomState.left;
                  const right = zoomState.right === 'dataMax' ? Math.max(...distributionData.map(d => d.index)) : zoomState.right;
                  const range = right - left;
                  const step = Math.max(1, Math.ceil(range / 10));
                  const ticks = [];
                  ticks.push(left);
                  for (let i = Math.floor(left / step) * step + step; i <= right; i += step) {
                    ticks.push(i);
                  }
                  if (!ticks.includes(0) && 0 >= left && 0 <= right) ticks.push(0);
                  return ticks.sort((a, b) => a - b);
                })()}
              />
              <YAxis 
                stroke="#fff"
                label={{ 
                  value: 'FP8 Value', 
                  angle: -90, 
                  position: 'insideLeft', 
                  fill: '#fff',
                  offset: -20,
                  style: { textAnchor: 'middle' }
                }}
                domain={[zoomState.bottom, zoomState.top]}
                allowDataOverflow
                width={70}
                tickFormatter={(value) => {
                  if (Math.abs(value) < 0.01 || Math.abs(value) > 1000) {
                    return value.toExponential(1);
                  }
                  return value.toFixed(2);
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter 
                name="FP8 Values" 
                data={distributionData} 
                fill="#60a5fa"
                dataKey="value"
                isAnimationActive={false}
              />
              {refAreaLeft !== null && refAreaRight !== null && (
                <ReferenceArea
                  x1={refAreaLeft}
                  x2={refAreaRight}
                  strokeOpacity={0.3}
                  fill="#8884d8"
                  fillOpacity={0.3}
                />
              )}
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Histogram */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 border border-white/20">
          <h2 className="text-2xl font-bold mb-4">Value Histogram (Log Scale Bins)</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={histogramData}
              margin={{ top: 5, right: 30, left: 30, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff30" />
              <XAxis 
                dataKey="bin" 
                stroke="#fff"
                tickFormatter={(val) => Math.pow(10, val).toFixed(4)}
                label={{ 
                  value: 'Value Range', 
                  position: 'insideBottom', 
                  offset: -50, 
                  fill: '#fff' 
                }}
                angle={-45}
                textAnchor="end"   
              />
              <YAxis 
                stroke="#fff"
                label={{ 
                  value: 'Count', 
                  angle: -90, 
                  position: 'insideLeft', 
                  fill: '#fff', 
                  offset: 0,
                  style: { textAnchor: 'middle' }
                }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                labelFormatter={(val) => `Range: 10^${val.toFixed(2)}`}
              />
              <Line type="monotone" dataKey="count" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Value Table Sample */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h2 className="text-2xl font-bold mb-4">Sample Values (First 20 Finite)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="px-4 py-2 text-left">Binary</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-right">Decimal Value</th>
                  <th className="px-4 py-2 text-right">Scientific</th>
                </tr>
              </thead>
              <tbody>
                {distributionData.slice(0, 20).map((v, idx) => (
                  <tr key={idx} className="border-b border-white/10 hover:bg-white/5">
                    <td className="px-4 py-2 font-mono">{v.binary}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        v.type === 'normal' ? 'bg-green-500/30' : 'bg-yellow-500/30'
                      }`}>
                        {v.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{v.value.toFixed(6)}</td>
                    <td className="px-4 py-2 text-right font-mono">{v.value.toExponential(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FP8Analyzer;