import { calculateFP8Value } from './formats';

export const HISTOGRAM_BINS = 20;

// Enumerate all 8-bit patterns under the given format and return everything
// the UI needs: stats, sorted distribution points (with mid-centered index),
// and log-binned histogram. Returns null if the bit configuration is invalid.
export const generateFP8Data = (formatConfig) => {
  const { exponentBits, mantissaBits } = formatConfig;
  const totalBits = 8;
  const signBit = 1;

  if (exponentBits + mantissaBits + signBit !== totalBits) {
    return null;
  }

  const maxExponent = (1 << exponentBits) - 1;
  const maxMantissa = (1 << mantissaBits) - 1;

  const counts = { total: 0, zeros: 0, subnormal: 0, normal: 0, infinity: 0, nan: 0 };
  const rawFinite = [];
  let minPositive = Infinity;
  let maxPositive = -Infinity;

  for (let sign = 0; sign <= 1; sign++) {
    for (let exp = 0; exp <= maxExponent; exp++) {
      for (let mantissa = 0; mantissa <= maxMantissa; mantissa++) {
        const { value, type } = calculateFP8Value(sign, exp, mantissa, formatConfig);
        counts.total++;
        counts[type]++;

        if (isFinite(value) && value !== 0) {
          const absVal = Math.abs(value);
          if (absVal < minPositive) minPositive = absVal;
          if (absVal > maxPositive) maxPositive = absVal;
          const binary = `${sign}${exp.toString(2).padStart(exponentBits, '0')}${mantissa.toString(2).padStart(mantissaBits, '0')}`;
          rawFinite.push({ value, type, binary });
        }
      }
    }
  }

  const stats = {
    ...counts,
    minPositive: minPositive === Infinity ? 0 : minPositive,
    maxPositive: maxPositive === -Infinity ? 0 : maxPositive,
    dynamicRange: (minPositive !== Infinity && maxPositive !== -Infinity) ? maxPositive / minPositive : 0,
  };

  rawFinite.sort((a, b) => a.value - b.value);
  const midIndex = Math.floor(rawFinite.length / 2);
  const distributionData = rawFinite.map((v, idx) => ({
    index: idx - midIndex,
    value: v.value,
    type: v.type,
    binary: v.binary,
  }));

  let histogramData = [];
  if (stats.minPositive !== 0 && stats.maxPositive !== stats.minPositive) {
    const minLog = Math.log10(stats.minPositive);
    const maxLog = Math.log10(stats.maxPositive);
    const binSize = (maxLog - minLog) / HISTOGRAM_BINS;
    const histogram = new Array(HISTOGRAM_BINS).fill(0);

    for (const { value } of rawFinite) {
      const logVal = Math.log10(Math.abs(value));
      const binIdx = Math.min(Math.floor((logVal - minLog) / binSize), HISTOGRAM_BINS - 1);
      if (binIdx >= 0) histogram[binIdx]++;
    }

    histogramData = histogram.map((count, idx) => ({
      bin: minLog + (idx + 0.5) * binSize,
      count,
    }));
  }

  return { stats, distributionData, histogramData };
};
