import React, { useState, useMemo, useRef } from 'react';
import { generateFP8DistributionData } from '../fp8/generate';
import FormatList from './FormatList';
import StripChart from './StripChart';

const COLORS = ['#60a5fa', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#fb7185', '#22d3ee', '#fb923c'];

const newId = () => `fmt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_CONFIGS = [
  { id: newId(), name: 'E4M3 IEEE', exponentBits: 4, mantissaBits: 3, exponentBias: 7, floatFormat: 'IEEE' },
  { id: newId(), name: 'E5M2 IEEE', exponentBits: 5, mantissaBits: 2, exponentBias: 15, floatFormat: 'IEEE' },
];

const dataKeyFor = ({ exponentBits, mantissaBits, exponentBias, floatFormat }) =>
  `${exponentBits}:${mantissaBits}:${exponentBias}:${floatFormat}`;

const CompareView = () => {
  const [formatConfigs, setFormatConfigs] = useState(DEFAULT_CONFIGS);
  const dataCacheRef = useRef(new Map());

  const datasets = useMemo(() => {
    const cache = dataCacheRef.current;
    const activeKeys = new Set();

    const nextDatasets = formatConfigs.map((cfg) => {
      const key = dataKeyFor(cfg);
      activeKeys.add(key);

      if (!cache.has(key)) {
        cache.set(key, { distributionData: generateFP8DistributionData(cfg) });
      }

      return { config: cfg, data: cache.get(key) };
    });

    for (const key of cache.keys()) {
      if (!activeKeys.has(key)) cache.delete(key);
    }

    return nextDatasets;
  }, [formatConfigs]);

  const handleChange = (idx, newCfg) => {
    setFormatConfigs((prev) => prev.map((c, i) => (i === idx ? newCfg : c)));
  };

  const handleAdd = () => {
    setFormatConfigs((prev) => [
      ...prev,
      {
        id: newId(),
        name: `Format ${prev.length + 1}`,
        exponentBits: 4,
        mantissaBits: 3,
        exponentBias: 7,
        floatFormat: 'IEEE',
      },
    ]);
  };

  const handleRemove = (idx) => {
    setFormatConfigs((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      <FormatList
        formatConfigs={formatConfigs}
        onChange={handleChange}
        onAdd={handleAdd}
        onRemove={handleRemove}
        colors={COLORS}
      />
      <StripChart datasets={datasets} scale="linear" colors={COLORS} title="Linear scale" />
      <StripChart datasets={datasets} scale="symlog" colors={COLORS} title="Symmetric log scale" />
    </div>
  );
};

export default CompareView;
