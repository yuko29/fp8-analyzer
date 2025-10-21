import React, { useState, useMemo } from 'react';
import { LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { Settings, ZoomIn, ZoomOut } from 'lucide-react';

const FP8Analyzer = () => {
  const [exponentBits, setExponentBits] = useState(4);
  const [mantissaBits, setMantissaBits] = useState(3);
  const [exponentBias, setExponentBias] = useState(7);
  const [floatFormat, setFloatFormat] = useState('IEEE');
  
  // Zoom state
  const [zoomState, setZoomState] = useState({ left: 'dataMin', right: 'dataMax', top: 'dataMax', bottom: 'dataMin' });
  const [refAreaLeft, setRefAreaLeft] = useState('');
  const [refAreaRight, setRefAreaRight] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);

  // Calculate FP8 value from bit representation
  const calculateFP8Value = (sign, exp, mantissa) => {
    const maxExponent = (1 << exponentBits) - 1;
    const maxMantissa = (1 << mantissaBits) - 1;
    let value, type = 'normal';
    
    if (floatFormat === 'IEEE') {
      if (exp === 0) {
        if (mantissa === 0) {
          value = sign === 0 ? 0 : -0;
          type = 'zero';
        } else {
          value = Math.pow(-1, sign) * Math.pow(2, 1 - exponentBias) * (mantissa / Math.pow(2, mantissaBits));
          type = 'subnormal';
        }
      } else if (exp === maxExponent) {
        if (mantissa === 0) {
          value = sign === 0 ? Infinity : -Infinity;
          type = 'infinity';
        } else {
          value = NaN;
          type = 'nan';
        }
      } else {
        const actualExponent = exp - exponentBias;
        const mantissaValue = 1 + mantissa / Math.pow(2, mantissaBits);
        value = Math.pow(-1, sign) * Math.pow(2, actualExponent) * mantissaValue;
      }
    } else if (floatFormat === 'FN') {
      if (exp === 0 && mantissa === 0) {
        value = sign === 0 ? 0 : -0;
        type = 'zero';
      } else if (exp === maxExponent) {
        value = NaN;
        type = 'nan';
      } else {
        const actualExponent = exp - exponentBias;
        const mantissaValue = (exp === 0) ? 
          (mantissa / Math.pow(2, mantissaBits)) : 
          (1 + mantissa / Math.pow(2, mantissaBits));
        value = Math.pow(-1, sign) * Math.pow(2, actualExponent) * mantissaValue;
        type = exp === 0 ? 'subnormal' : 'normal';
      }
    } else if (floatFormat === 'FNUZ') {
      if (sign === 1 && exp === 0 && mantissa === 0) {
        value = NaN;
        type = 'nan';
      } else if (exp === 0 && mantissa === 0) {
        value = 0;
        type = 'zero';
      } else if (exp === 0) {
        value = Math.pow(-1, sign) * Math.pow(2, 1 - exponentBias) * (mantissa / Math.pow(2, mantissaBits));
        type = 'subnormal';
      } else {
        const actualExponent = exp - exponentBias;
        const mantissaValue = 1 + mantissa / Math.pow(2, mantissaBits);
        value = Math.pow(-1, sign) * Math.pow(2, actualExponent) * mantissaValue;
      }
    }
    
    return { value, type };
  };

  // Calculate statistics only
  const stats = useMemo(() => {
    const totalBits = 8;
    const signBit = 1;
    
    if (exponentBits + mantissaBits + signBit !== totalBits) {
      return null;
    }

    const maxExponent = (1 << exponentBits) - 1;
    const maxMantissa = (1 << mantissaBits) - 1;
    
    let counts = { total: 0, zeros: 0, subnormal: 0, normal: 0, infinity: 0, nan: 0 };
    let minPositive = Infinity;
    let maxPositive = -Infinity;

    for (let sign = 0; sign <= 1; sign++) {
      for (let exp = 0; exp <= maxExponent; exp++) {
        for (let mantissa = 0; mantissa <= maxMantissa; mantissa++) {
          const { value, type } = calculateFP8Value(sign, exp, mantissa);
          counts.total++;
          counts[type]++;
          
          if (isFinite(value) && value !== 0) {
            const absVal = Math.abs(value);
            if (absVal < minPositive) minPositive = absVal;
            if (absVal > maxPositive) maxPositive = absVal;
          }
        }
      }
    }

    return {
      ...counts,
      minPositive: minPositive === Infinity ? 0 : minPositive,
      maxPositive: maxPositive === -Infinity ? 0 : maxPositive,
      dynamicRange: (minPositive !== Infinity && maxPositive !== -Infinity) ? maxPositive / minPositive : 0
    };
  }, [exponentBits, mantissaBits, exponentBias, floatFormat]);

  // Generate distribution data on demand (lighter memory footprint)
  const distributionData = useMemo(() => {
    if (!stats) return [];
    
    const maxExponent = (1 << exponentBits) - 1;
    const maxMantissa = (1 << mantissaBits) - 1;
    const finiteValues = [];

    for (let sign = 0; sign <= 1; sign++) {
      for (let exp = 0; exp <= maxExponent; exp++) {
        for (let mantissa = 0; mantissa <= maxMantissa; mantissa++) {
          const { value, type } = calculateFP8Value(sign, exp, mantissa);
          
          if (isFinite(value) && value !== 0) {
            const binary = `${sign}${exp.toString(2).padStart(exponentBits, '0')}${mantissa.toString(2).padStart(mantissaBits, '0')}`;
            finiteValues.push({ value, type, binary });
          }
        }
      }
    }

    finiteValues.sort((a, b) => a.value - b.value);
    const midIndex = Math.floor(finiteValues.length / 2);
    
    return finiteValues.map((v, idx) => ({
      index: idx - midIndex,
      value: v.value,
      type: v.type,
      binary: v.binary
    }));
  }, [exponentBits, mantissaBits, exponentBias, floatFormat, stats]);

  // Generate histogram data (optimized binning)
  const histogramData = useMemo(() => {
    if (!stats || stats.minPositive === 0) return [];
    
    const bins = 30;
    const minLog = Math.log10(stats.minPositive);
    const maxLog = Math.log10(stats.maxPositive);
    const binSize = (maxLog - minLog) / bins;
    const histogram = new Array(bins).fill(0);
    
    const maxExponent = (1 << exponentBits) - 1;
    const maxMantissa = (1 << mantissaBits) - 1;

    for (let sign = 0; sign <= 1; sign++) {
      for (let exp = 0; exp <= maxExponent; exp++) {
        for (let mantissa = 0; mantissa <= maxMantissa; mantissa++) {
          const { value } = calculateFP8Value(sign, exp, mantissa);
          
          if (isFinite(value) && value !== 0) {
            const logVal = Math.log10(Math.abs(value));
            const binIdx = Math.min(Math.floor((logVal - minLog) / binSize), bins - 1);
            if (binIdx >= 0) histogram[binIdx]++;
          }
        }
      }
    }
    
    return histogram.map((count, idx) => ({
      bin: minLog + (idx + 0.5) * binSize,
      count
    }));
  }, [exponentBits, mantissaBits, exponentBias, floatFormat, stats]);

  const zoomOut = () => {
    setZoomState({ left: 'dataMin', right: 'dataMax', top: 'dataMax', bottom: 'dataMin' });
  };

  const handleMouseDown = (e) => {
    if (e && e.activeLabel !== undefined) {
      setRefAreaLeft(e.activeLabel);
      setIsSelecting(true);
    }
  };

  const handleMouseMove = (e) => {
    if (isSelecting && e && e.activeLabel !== undefined) {
      setRefAreaRight(e.activeLabel);
    }
  };

  const handleMouseUp = () => {
    if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
      let left = refAreaLeft;
      let right = refAreaRight;

      if (left > right) [left, right] = [right, left];

      const selectedData = distributionData.filter(d => d.index >= left && d.index <= right);
      if (selectedData.length > 0) {
        const yValues = selectedData.map(d => d.value);
        const bottom = Math.min(...yValues);
        const top = Math.max(...yValues);
        
        setZoomState({ 
          left, 
          right, 
          bottom: bottom - (top - bottom) * 0.1,
          top: top + (top - bottom) * 0.1 
        });
      }
    }
    
    setRefAreaLeft('');
    setRefAreaRight('');
    setIsSelecting(false);
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

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-8 flex items-center justify-center">
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
          <p className="text-xl">Bits must sum to 8 (1 sign + exp + mantissa)</p>
        </div>
      </div>
    );
  }

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
                <div className="font-bold">FN (Float with NaN)</div>
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
              margin={{ top: 5, right: 30, left: 80, bottom: 35 }}
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
              />
              {refAreaLeft && refAreaRight && (
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
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={histogramData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff30" />
              <XAxis 
                dataKey="bin" 
                stroke="#fff"
                tickFormatter={(val) => `10^${val.toFixed(1)}`}
                label={{ value: 'Value Range', position: 'insideBottom', offset: -5, fill: '#fff' }}
              />
              <YAxis 
                stroke="#fff"
                label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: '#fff' }}
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
      </div>
    </div>
  );
};

export default FP8Analyzer;