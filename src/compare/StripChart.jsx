import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ZoomOut } from 'lucide-react';

const ROW_HEIGHT = 50;
const CHART_CHROME = 100;
const PLOT_LEFT_OFFSET = 100; // YAxis width (90) + ScatterChart left margin (10)
const PLOT_RIGHT_OFFSET = 30; // ScatterChart right margin
const ZOOM_FACTOR = 1.2;

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
  if (a < 0.01 || a >= 10000) return v.toExponential(1);
  // toPrecision(3) gives 3 sig figs; Number(...) strips trailing zeros so "1.50" → "1.5".
  return Number(v.toPrecision(3)).toString();
};

// Pick ticks at multiples of 1/2/5 × 10ⁿ that fall inside [lo, hi].
// Keeps labels honest: the displayed number is exactly the tick position.
const niceLinearTicks = (lo, hi, targetCount = 10) => {
  if (!(hi > lo)) return [lo];
  const rawStep = (hi - lo) / targetCount;
  const exp = Math.floor(Math.log10(rawStep));
  const base = Math.pow(10, exp);
  const m = rawStep / base;
  const step = m < 1.5 ? base : m < 3 ? 2 * base : m < 7 ? 5 * base : 10 * base;
  const start = Math.ceil(lo / step) * step;
  const count = Math.floor((hi - start) / step) + 1;
  // Round each tick to step-aligned precision to avoid 0.94000001 artifacts.
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 2);
  const ticks = [];
  for (let i = 0; i < count; i++) ticks.push(parseFloat((start + i * step).toFixed(decimals)));
  return ticks;
};

const clampDomain = ([lo, hi], [minLo, maxHi]) => {
  const range = hi - lo;
  if (range >= maxHi - minLo) return null; // fully zoomed out → no zoom
  let nLo = lo, nHi = hi;
  if (nLo < minLo) { nHi += (minLo - nLo); nLo = minLo; }
  if (nHi > maxHi) { nLo -= (nHi - maxHi); nHi = maxHi; }
  return [nLo, nHi];
};

const StripChart = ({ datasets, scale, colors, title }) => {
  const isZoomable = scale === 'linear';
  const [zoomDomain, setZoomDomain] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [centerInput, setCenterInput] = useState('');
  const [centerFocused, setCenterFocused] = useState(false);
  const wrapperRef = useRef(null);
  const panAnchorRef = useRef(null);

  const { series, threshold, defaultDomain, symlogTicks } = useMemo(() => {
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

    let defaultDomain, symlogTicks = null;
    if (scale === 'symlog') {
      const maxT = symlog(maxAbs, threshold);
      defaultDomain = [-maxT * 1.05, maxT * 1.05];
      const minLog = Math.floor(Math.log10(threshold));
      const maxLog = Math.ceil(Math.log10(maxAbs));
      const decades = [];
      for (let e = minLog; e <= maxLog; e++) decades.push(Math.pow(10, e));
      symlogTicks = [
        ...decades.slice().reverse().map((v) => symlog(-v, threshold)),
        0,
        ...decades.map((v) => symlog(v, threshold)),
      ];
    } else {
      defaultDomain = [-maxAbs * 1.05, maxAbs * 1.05];
    }

    return { series, threshold, defaultDomain, symlogTicks };
  }, [datasets, scale, colors]);

  const xDomain = isZoomable && zoomDomain ? zoomDomain : defaultDomain;

  const xTicks = useMemo(() => {
    if (scale === 'symlog') return symlogTicks;
    return niceLinearTicks(xDomain[0], xDomain[1]);
  }, [scale, symlogTicks, xDomain]);

  const xTickFormatter = (xp) => formatReal(scale === 'symlog' ? symlogInverse(xp, threshold) : xp);
  const yTickFormatter = (idx) => datasets[idx]?.config?.name ?? '';

  const getPlotMetrics = useCallback(() => {
    if (!wrapperRef.current) return null;
    const rect = wrapperRef.current.getBoundingClientRect();
    const width = rect.width - PLOT_LEFT_OFFSET - PLOT_RIGHT_OFFSET;
    if (width <= 0) return null;
    return { width, left: rect.left + PLOT_LEFT_OFFSET };
  }, []);

  // Wheel zoom — anchored at cursor value. Uses a native non-passive listener
  // so preventDefault actually suppresses page scroll.
  const handleWheelRef = useRef(null);
  handleWheelRef.current = (e) => {
    if (!isZoomable) return;
    const metrics = getPlotMetrics();
    if (!metrics) return;
    const cursorXInPlot = e.clientX - metrics.left;
    if (cursorXInPlot < 0 || cursorXInPlot > metrics.width) return;
    e.preventDefault();

    const t = cursorXInPlot / metrics.width;
    const [lo, hi] = xDomain;
    const range = hi - lo;
    const cursorValue = lo + t * range;
    const defaultRange = defaultDomain[1] - defaultDomain[0];
    const zoomLevel = Math.max(1, defaultRange / range);
    const stepFactor = 1 + (ZOOM_FACTOR - 1) / Math.sqrt(zoomLevel);
    const factor = e.deltaY > 0 ? stepFactor : 1 / stepFactor;
    const newRange = range * factor;
    const candidate = [cursorValue - t * newRange, cursorValue + (1 - t) * newRange];
    setZoomDomain(clampDomain(candidate, defaultDomain));
  };

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const fn = (e) => handleWheelRef.current && handleWheelRef.current(e);
    el.addEventListener('wheel', fn, { passive: false });
    return () => el.removeEventListener('wheel', fn);
  }, []);

  // Pan-on-drag — track pixel deltas, convert to value deltas via plot width.
  const handleMouseDown = (e) => {
    if (!isZoomable) return;
    const metrics = getPlotMetrics();
    if (!metrics) return;
    const cursorXInPlot = e.clientX - metrics.left;
    if (cursorXInPlot < 0 || cursorXInPlot > metrics.width) return;
    panAnchorRef.current = { startClientX: e.clientX, startDomain: xDomain, plotWidth: metrics.width };
    setIsPanning(true);
  };

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (ev) => {
      const a = panAnchorRef.current;
      if (!a) return;
      const [sLo, sHi] = a.startDomain;
      const range = sHi - sLo;
      const dValue = -((ev.clientX - a.startClientX) / a.plotWidth) * range;
      setZoomDomain(clampDomain([sLo + dValue, sHi + dValue], defaultDomain));
    };
    const onUp = () => {
      setIsPanning(false);
      panAnchorRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning, defaultDomain]);

  const resetZoom = () => setZoomDomain(null);

  const applyCenter = (center) => {
    const [minLo, maxHi] = defaultDomain;
    const totalRange = maxHi - minLo;
    const currentRange = xDomain[1] - xDomain[0];
    // If not zoomed, auto-zoom to 20% of the total range centered on the value.
    const visRange = zoomDomain ? currentRange : totalRange * 0.2;
    const next = clampDomain([center - visRange / 2, center + visRange / 2], defaultDomain);
    setZoomDomain(next);
  };

  const commitCenter = () => {
    const v = parseFloat(centerInput);
    if (!isNaN(v) && isFinite(v)) applyCenter(v);
  };

  const currentCenter = (xDomain[0] + xDomain[1]) / 2;
  const centerDisplay = centerFocused ? centerInput : formatReal(currentCenter);

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
      <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
        {title && <h2 className="text-xl font-bold">{title}</h2>}
        {isZoomable && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-blue-200">Center:</span>
              <input
                type="text"
                value={centerDisplay}
                onFocus={() => { setCenterFocused(true); setCenterInput(formatReal(currentCenter)); }}
                onBlur={() => setCenterFocused(false)}
                onChange={(e) => setCenterInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { commitCenter(); e.currentTarget.blur(); }
                  else if (e.key === 'Escape') e.currentTarget.blur();
                }}
                placeholder="e.g. 1.5e-3"
                className="bg-white/10 px-2 py-1 rounded text-sm font-mono w-28 border border-white/10 focus:outline-none focus:border-blue-400"
              />
            </label>
            <button
              onClick={resetZoom}
              disabled={!zoomDomain}
              className="flex items-center gap-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ZoomOut className="w-4 h-4" />
              Reset Zoom
            </button>
          </div>
        )}
      </div>
      {isZoomable && (
        <p className="text-xs text-blue-200 mb-2">
          Scroll to zoom · Drag to pan · Use the scrollbar below to navigate
        </p>
      )}
      <div
        ref={wrapperRef}
        onMouseDown={handleMouseDown}
        style={{ cursor: isZoomable ? (isPanning ? 'grabbing' : 'grab') : 'default', userSelect: 'none' }}
      >
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ScatterChart margin={{ top: 10, right: PLOT_RIGHT_OFFSET, left: 10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
            <XAxis
              type="number"
              dataKey="x"
              stroke="#fff"
              domain={xDomain}
              ticks={xTicks}
              tickFormatter={xTickFormatter}
              allowDataOverflow
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
            <Tooltip content={<CompareTooltip />} cursor={{ strokeDasharray: '3 3' }} isAnimationActive={false} />
            {series.map((s) => (
              <Scatter key={s.rowIdx} name={s.name} data={s.points} fill={s.color} isAnimationActive={false} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {isZoomable && (
        <Scrollbar
          defaultDomain={defaultDomain}
          zoomDomain={zoomDomain}
          onChange={setZoomDomain}
        />
      )}
    </div>
  );
};

const Scrollbar = ({ defaultDomain, zoomDomain, onChange }) => {
  const trackRef = useRef(null);
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const [minLo, maxHi] = defaultDomain;
  const totalRange = maxHi - minLo;
  const [lo, hi] = zoomDomain || defaultDomain;
  const visRange = hi - lo;
  const thumbLeftPct = totalRange > 0 ? ((lo - minLo) / totalRange) * 100 : 0;
  const thumbWidthPct = totalRange > 0 ? (visRange / totalRange) * 100 : 100;
  const isActive = !!zoomDomain;

  const startDrag = (e) => {
    if (!isActive) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startClientX: e.clientX, startLo: lo };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (ev) => {
      if (!trackRef.current || !dragRef.current) return;
      const trackW = trackRef.current.getBoundingClientRect().width;
      if (trackW <= 0) return;
      const dValue = ((ev.clientX - dragRef.current.startClientX) / trackW) * totalRange;
      let newLo = dragRef.current.startLo + dValue;
      let newHi = newLo + visRange;
      if (newLo < minLo) { newLo = minLo; newHi = minLo + visRange; }
      if (newHi > maxHi) { newHi = maxHi; newLo = maxHi - visRange; }
      onChange([newLo, newHi]);
    };
    const onUp = () => {
      setDragging(false);
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, totalRange, visRange, minLo, maxHi, onChange]);

  const handleTrackClick = (e) => {
    if (!isActive || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const t = (e.clientX - rect.left) / rect.width;
    const newCenter = minLo + t * totalRange;
    let newLo = newCenter - visRange / 2;
    let newHi = newLo + visRange;
    if (newLo < minLo) { newLo = minLo; newHi = minLo + visRange; }
    if (newHi > maxHi) { newHi = maxHi; newLo = maxHi - visRange; }
    onChange([newLo, newHi]);
  };

  return (
    <div
      ref={trackRef}
      onMouseDown={handleTrackClick}
      className="relative h-3 bg-white/10 rounded mt-3 cursor-pointer"
      style={{ marginLeft: PLOT_LEFT_OFFSET, marginRight: PLOT_RIGHT_OFFSET }}
    >
      <div
        onMouseDown={startDrag}
        className={`absolute top-0 h-full rounded transition-colors ${
          isActive ? 'bg-blue-400/70 hover:bg-blue-400 cursor-grab' : 'bg-white/20 cursor-default'
        } ${dragging ? 'cursor-grabbing bg-blue-400' : ''}`}
        style={{ left: `${thumbLeftPct}%`, width: `${Math.max(2, thumbWidthPct)}%` }}
      />
    </div>
  );
};

export default StripChart;
