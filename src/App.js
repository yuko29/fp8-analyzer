import React, { useState, useMemo } from 'react';
import { LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Settings, Info } from 'lucide-react';

const FP8Analyzer = () => {
  const [exponentBits, setExponentBits] = useState(4);
  const [mantissaBits, setMantissaBits] = useState(3);
  const [exponentBias, setExponentBias] = useState(7);
  const [floatFormat, setFloatFormat] = useState('IEEE'); // IEEE, FN, FNUZ
  const [showInfo, setShowInfo] = useState(false);

  const fp8Values = useMemo(() => {
    const values = [];
    const totalBits = 8;
    const signBit = 1;
    
    // Validate configuration
    if (exponentBits + mantissaBits + signBit !== totalBits) {
      return { values: [], stats: null, error: 'Bits must sum to 8 (1 sign + exp + mantissa)' };
    }

    const maxExponent = (1 << exponentBits) - 1;
    const maxMantissa = (1 << mantissaBits) - 1;

    // Generate all possible values
    for (let sign = 0; sign <= 1; sign++) {
      for (let exp = 0; exp <= maxExponent; exp++) {
        for (let mantissa = 0; mantissa <= maxMantissa; mantissa++) {
          let value;
          let type = 'normal';
          
          // Apply format-specific rules
          if (floatFormat === 'IEEE') {
            // IEEE 754 standard
            if (exp === 0) {
              if (mantissa === 0) {
                value = sign === 0 ? 0 : -0;
                type = 'zero';
              } else {
                // Subnormal numbers
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
              // Normal numbers
              const actualExponent = exp - exponentBias;
              const mantissaValue = 1 + mantissa / Math.pow(2, mantissaBits);
              value = Math.pow(-1, sign) * Math.pow(2, actualExponent) * mantissaValue;
              type = 'normal';
            }
          } else if (floatFormat === 'FN') {
            // Float with NaN (no infinities, no subnormals)
            if (exp === 0 && mantissa === 0) {
              value = sign === 0 ? 0 : -0;
              type = 'zero';
            } else if (exp === maxExponent) {
              // All max exponent values are NaN
              value = NaN;
              type = 'nan';
            } else {
              // All other values are normal (including exp=0 with mantissa!=0)
              const actualExponent = exp - exponentBias;
              const mantissaValue = (exp === 0) ? 
                (mantissa / Math.pow(2, mantissaBits)) : 
                (1 + mantissa / Math.pow(2, mantissaBits));
              value = Math.pow(-1, sign) * Math.pow(2, actualExponent) * mantissaValue;
              type = exp === 0 ? 'subnormal' : 'normal';
            }
          } else if (floatFormat === 'FNUZ') {
            // Float with NaN, Unsigned Zero (no infinities, negative zero is NaN, has subnormals)
            if (sign === 1 && exp === 0 && mantissa === 0) {
              // Negative zero representation is reserved for NaN
              value = NaN;
              type = 'nan';
            } else if (exp === 0 && mantissa === 0) {
              // Positive zero only
              value = 0;
              type = 'zero';
            } else if (exp === 0) {
              // Subnormal numbers (for both positive and negative)
              value = Math.pow(-1, sign) * Math.pow(2, 1 - exponentBias) * (mantissa / Math.pow(2, mantissaBits));
              type = 'subnormal';
            } else {
              // Normal numbers (including max exponent - represents maximum values, not infinity)
              const actualExponent = exp - exponentBias;
              const mantissaValue = 1 + mantissa / Math.pow(2, mantissaBits);
              value = Math.pow(-1, sign) * Math.pow(2, actualExponent) * mantissaValue;
              type = 'normal';
            }
          }

          const binary = `${sign}${exp.toString(2).padStart(exponentBits, '0')}${mantissa.toString(2).padStart(mantissaBits, '0')}`;
          
          values.push({
            binary,
            sign,
            exponent: exp,
            mantissa,
            value,
            type,
            absValue: Math.abs(value)
          });
        }
      }
    }

    // Calculate statistics
    const finiteValues = values.filter(v => isFinite(v.value) && v.value !== 0).map(v => Math.abs(v.value));
    const stats = {
      total: values.length,
      zeros: values.filter(v => v.type === 'zero').length,
      subnormal: values.filter(v => v.type === 'subnormal').length,
      normal: values.filter(v => v.type === 'normal').length,
      infinity: values.filter(v => v.type === 'infinity').length,
      nan: values.filter(v => v.type === 'nan').length,
      minPositive: finiteValues.length > 0 ? Math.min(...finiteValues) : 0,
      maxPositive: finiteValues.length > 0 ? Math.max(...finiteValues) : 0,
      dynamicRange: finiteValues.length > 0 ? Math.max(...finiteValues) / Math.min(...finiteValues) : 0
    };

    return { values, stats, error: null };
  }, [exponentBits, mantissaBits, exponentBias, floatFormat]);

  const distributionData = useMemo(() => {
    if (fp8Values.error || !fp8Values.values.length) return [];
    
    const finiteValues = fp8Values.values.filter(v => isFinite(v.value) && v.value !== 0);
    const sorted = [...finiteValues].sort((a, b) => a.value - b.value);
    
    // Center the indices around the midpoint as integers
    const totalCount = sorted.length;
    const midIndex = Math.floor(totalCount / 2);
    
    return sorted.map((v, idx) => ({
      index: idx - midIndex,
      value: v.value,
      absValue: Math.abs(v.value),
      logValue: Math.log10(Math.abs(v.value)),
      type: v.type,
      binary: v.binary
    }));
  }, [fp8Values]);

  const histogramData = useMemo(() => {
    if (fp8Values.error || !fp8Values.values.length) return [];
    
    const finiteValues = fp8Values.values.filter(v => isFinite(v.value) && v.value !== 0);
    const bins = 30;
    const minLog = Math.log10(fp8Values.stats.minPositive);
    const maxLog = Math.log10(fp8Values.stats.maxPositive);
    const binSize = (maxLog - minLog) / bins;
    
    const histogram = new Array(bins).fill(0);
    
    finiteValues.forEach(v => {
      const logVal = Math.log10(Math.abs(v.value));
      const binIdx = Math.min(Math.floor((logVal - minLog) / binSize), bins - 1);
      if (binIdx >= 0) histogram[binIdx]++;
    });
    
    return histogram.map((count, idx) => ({
      bin: minLog + (idx + 0.5) * binSize,
      binLabel: `10^${(minLog + (idx + 0.5) * binSize).toFixed(1)}`,
      count
    }));
  }, [fp8Values]);

  const defaultContentStyle = {
    margin: 0,
    padding: '10px',
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    whiteSpace: 'nowrap',
  };

  const CustomTooltip = ({ active, payload, label}) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
      <div style={{defaultContentStyle}}>
          <p>FP8 values: {item.value}</p>
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

        {/* Controls */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 border border-white/20">
          {/* Format Selection */}
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
                  setMantissaBits(7 - newExp); // 8 - 1 (sign bit) - exponentBits
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
                  setExponentBits(7 - newMant); // 8 - 1 (sign bit) - mantissaBits
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
            {1 + exponentBits + mantissaBits !== 8 && (
              <div className="px-3 py-1 bg-red-500/30 rounded">
                ⚠ Must equal 8 bits total
              </div>
            )}
          </div>
        </div>

        {fp8Values.error ? (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
            <p className="text-xl">{fp8Values.error}</p>
          </div>
        ) : (
          <>
            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-2xl font-bold text-blue-300">{fp8Values.stats.total}</div>
                <div className="text-sm text-gray-300">Total Values</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-2xl font-bold text-green-300">{fp8Values.stats.normal}</div>
                <div className="text-sm text-gray-300">Normal</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-2xl font-bold text-yellow-300">{fp8Values.stats.subnormal}</div>
                <div className="text-sm text-gray-300">Subnormal</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-2xl font-bold text-purple-300">{fp8Values.stats.zeros}</div>
                <div className="text-sm text-gray-300">Zeros</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-2xl font-bold text-red-300">{fp8Values.stats.infinity}</div>
                <div className="text-sm text-gray-300">Infinity</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-2xl font-bold text-orange-300">{fp8Values.stats.nan}</div>
                <div className="text-sm text-gray-300">NaN</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-lg font-bold text-cyan-300">{fp8Values.stats.minPositive.toExponential(3)}</div>
                <div className="text-sm text-gray-300">Min Positive</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-lg font-bold text-cyan-300">{fp8Values.stats.maxPositive.toExponential(3)}</div>
                <div className="text-sm text-gray-300">Max Positive</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <div className="text-lg font-bold text-cyan-300">{fp8Values.stats.dynamicRange.toExponential(3)}</div>
                <div className="text-sm text-gray-300">Dynamic Range</div>
              </div>
            </div>

            {/* Value Distribution */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 border border-white/20">
              <h2 className="text-2xl font-bold mb-4">Value Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff30" />
                  <XAxis 
                    dataKey="index" 
                    stroke="#fff"
                    label={{ value: 'Value Index', position: 'insideBottom', offset: -5, fill: '#fff' }}
                    ticks={(() => {
                      if (distributionData.length === 0) return [];
                      const min = Math.min(...distributionData.map(d => d.index));
                      const max = Math.max(...distributionData.map(d => d.index));
                      const range = max - min;
                      const step = Math.max(1, Math.ceil(range / 10));
                      const ticks = [];
                      for (let i = Math.floor(min / step) * step; i <= max; i += step) {
                        ticks.push(i);
                      }
                      if (!ticks.includes(0)) ticks.push(0);
                      return ticks.sort((a, b) => a - b);
                    })()}
                  />
                  <YAxis 
                    stroke="#fff"
                    label={{ value: 'FP8 Value', angle: -90, position: 'insideLeft', fill: '#fff' }}
                  />
                  {/* <Tooltip 
                    contentStyle={{ backgroundColor: '#cce0ff', border: '1px solid #475569' }}
                    formatter={(value, name) => {
                      if (name === 'value') return [typeof value === 'number' ? value.toFixed(3) : value, 'Value'];
                      return [value, name];
                    }}
                  /> */}
                  <Tooltip content={<CustomTooltip />} />
                  <Scatter 
                    name="FP8 Values" 
                    data={distributionData} 
                    fill="#60a5fa"
                    dataKey="value"
                  />
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
          </>
        )}
      </div>
    </div>
  );
};

export default FP8Analyzer;