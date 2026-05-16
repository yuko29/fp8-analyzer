import React from 'react';

const FORMAT_TYPES = [
  { id: 'IEEE', label: 'IEEE 754' },
  { id: 'FN', label: 'FN' },
  { id: 'FNUZ', label: 'FNUZ' },
];

const FormatList = ({ formatConfigs, onChange, onAdd, onRemove, colors }) => {
  const updateField = (idx, updates) => {
    onChange(idx, { ...formatConfigs[idx], ...updates });
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Formats</h2>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium"
        >
          + Add Format
        </button>
      </div>

      {formatConfigs.map((cfg, idx) => {
        const color = colors[idx % colors.length];
        const bitSum = 1 + cfg.exponentBits + cfg.mantissaBits;
        const bitsValid = bitSum === 8;
        return (
          <div key={cfg.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <input
                type="text"
                value={cfg.name}
                onChange={(e) => updateField(idx, { name: e.target.value })}
                className="flex-1 bg-white/10 px-3 py-1 rounded text-sm font-medium border border-white/10 focus:outline-none focus:border-blue-400"
              />
              <button
                onClick={() => onRemove(idx)}
                disabled={formatConfigs.length <= 1}
                className="px-3 py-1 bg-red-500/30 hover:bg-red-500/50 rounded text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                title={formatConfigs.length <= 1 ? 'At least one format required' : 'Remove'}
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {FORMAT_TYPES.map((ft) => (
                <button
                  key={ft.id}
                  onClick={() => updateField(idx, { floatFormat: ft.id })}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    cfg.floatFormat === ft.id ? 'bg-blue-500 text-white' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  {ft.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs mb-1">Exponent: {cfg.exponentBits}</label>
                <input
                  type="range" min="2" max="5"
                  value={cfg.exponentBits}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    updateField(idx, { exponentBits: v, mantissaBits: 7 - v });
                  }}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Mantissa: {cfg.mantissaBits}</label>
                <input
                  type="range" min="2" max="5"
                  value={cfg.mantissaBits}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    updateField(idx, { mantissaBits: v, exponentBits: 7 - v });
                  }}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Bias: {cfg.exponentBias}</label>
                <input
                  type="range" min="0" max="63"
                  value={cfg.exponentBias}
                  onChange={(e) => updateField(idx, { exponentBias: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            <div className={`text-xs mt-2 ${bitsValid ? 'text-blue-200' : 'text-red-300'}`}>
              1 sign + {cfg.exponentBits} exp + {cfg.mantissaBits} mantissa = {bitSum} bits
              {!bitsValid && ' (must be 8)'}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FormatList;
