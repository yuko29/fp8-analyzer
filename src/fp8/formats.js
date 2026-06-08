// Compute the decimal value and category ('zero' | 'subnormal' | 'normal' | 'infinity' | 'nan')
// for an FP8 bit pattern under the given format configuration.
export const calculateFP8Value = (sign, exp, mantissa, { exponentBits, mantissaBits, exponentBias, floatFormat }) => {
  const maxExponent = (1 << exponentBits) - 1;
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
    const maxMantissa = (1 << mantissaBits) - 1;
    if (exp === 0 && mantissa === 0) {
      value = sign === 0 ? 0 : -0;
      type = 'zero';
    } else if (exp === maxExponent && mantissa === maxMantissa) {
      value = NaN;
      type = 'nan';
    } else {
      const actualExponent = exp === 0 ? 1 - exponentBias : exp - exponentBias;
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
