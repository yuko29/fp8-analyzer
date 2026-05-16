import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ROW_HEIGHT = 50;
const CHART_CHROME = 100;

// Symmetric-log transform: linear near 0 (within threshold), log-scaled outside.
const symlog = (x, threshold) => {
  if (x === 0) return 0;
  return Math.sign(x) * Math.log10(1 + Math.abs(x) / threshold);
};

const symlogInverse = (xp, threshold) => {
  if (xp === 0) return 0;
  return Math.sign(xp) * threshold * (Math.pow(10, Math.abs(xp)) - 1);
};

const formatReal = (v) => {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a < 0.01 || a >= 10000) return v.toExponential(0);
  if (a < 1) return v.toFixed(2);
  return v.toFixed(0);
};

const StripChart = ({ datasets, scale, colors, title }) => {
  const { series, threshold, xDomain, xTicks } = useMemo(() => {
    let maxAbs = 0;
    let minPositive = Infinity;

    datasets.forEach((ds) => {
      if (!ds.data) return;
      ds.data.distributionData.forEach((p) => {
        const a = Math.abs(p.value);
        if (a > maxAbs) maxAbs = a;
        if (a > 0 && a < minPositive) minPositive = a;
      });
    });

    const threshold = minPositive === Infinity ? 1 : minPositive;

    const series = datasets.map((ds, rowIdx) => ({
      rowIdx,
      name: ds.config.name,
      color: colors[rowIdx % colors.length],
      points: ds.data
        ? ds.data.distributionData.map((p) => ({
            x: scale === 'symlog' ? symlog(p.value, threshold) : p.value,
            y: rowIdx,
            value: p.value,
            binary: p.binary,
            formatName: ds.config.name,
          }))
        : [],
    }));

    let xDomain, xTicks;
    if (scale === 'symlog') {
      const maxT = symlog(maxAbs, threshold);
      xDomain = [-maxT * 1.05, maxT * 1.05];
      const minLog = Math.floor(Math.log10(threshold));
      const maxLog = Math.ceil(Math.log10(maxAbs));
      const decades = [];
      for (let e = minLog; e <= maxLog; e++) decades.push(Math.pow(10, e));
      xTicks = [
        ...decades.slice().reverse().map((v) => symlog(-v, threshold)),
        0,
        ...decades.map((v) => symlog(v, threshold)),
      ];
    } else {
      xDomain = [-maxAbs * 1.05, maxAbs * 1.05];
      const step = maxAbs / 5;
      xTicks = [];
      for (let i = -5; i <= 5; i++) xTicks.push(i * step);
    }

    return { series, threshold, xDomain, xTicks };
  }, [datasets, scale, colors]);

  const xTickFormatter = (xp) => formatReal(scale === 'symlog' ? symlogInverse(xp, threshold) : xp);
  const yTickFormatter = (idx) => datasets[idx]?.config?.name ?? '';

  const CompareTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      return (
        <div style={{ padding: '10px', backgroundColor: '#1e293b', border: '1px solid #475569', whiteSpace: 'nowrap', color: '#fff' }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{p.formatName}</p>
          <p style={{ margin: 0 }}>Value: {p.value}</p>
          <p style={{ margin: 0 }}>Binary: {p.binary}</p>
        </div>
      );
    }
    return null;
  };

  const chartHeight = Math.max(150, datasets.length * ROW_HEIGHT + CHART_CHROME);

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
      {title && <h2 className="text-xl font-bold mb-4">{title}</h2>}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
          <XAxis
            type="number"
            dataKey="x"
            stroke="#fff"
            domain={xDomain}
            ticks={xTicks}
            tickFormatter={xTickFormatter}
            label={{ value: 'Value', position: 'insideBottom', offset: -10, fill: '#fff' }}
          />
          <YAxis
            type="number"
            dataKey="y"
            stroke="#fff"
            domain={[-0.5, Math.max(0.5, datasets.length - 0.5)]}
            ticks={datasets.map((_, i) => i)}
            tickFormatter={yTickFormatter}
            width={90}
            interval={0}
          />
          <Tooltip content={<CompareTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          {series.map((s) => (
            <Scatter key={s.rowIdx} name={s.name} data={s.points} fill={s.color} isAnimationActive={false} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StripChart;
