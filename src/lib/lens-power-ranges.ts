export type PowerPair = { sph: number; cyl: number };

export type LensPowerRange = {
  id: string;
  lens_id: string;
  sph_min: number;
  sph_max: number;
  sph_step: number;
  cyl_min: number;
  cyl_max: number;
  cyl_step: number;
  allowed_combinations: PowerPair[];
  created_at: string;
};

function isOnStep(value: number, min: number, step: number): boolean {
  const quotient = (value - min) / step;
  return Math.abs(quotient - Math.round(quotient)) < 0.000001;
}

function inSteppedRange(value: number, min: number, max: number, step: number): boolean {
  return value >= min - 0.000001 && value <= max + 0.000001 && isOnStep(value, min, step);
}

function signMatches(value: number, sign: 'any' | 'positive' | 'negative'): boolean {
  if (sign === 'positive') return value >= 0;
  if (sign === 'negative') return value <= 0;
  return true;
}

function thresholdMatches(value: number, threshold: number | null): boolean {
  return threshold === null || Math.abs(value) >= Math.abs(threshold);
}

function rangeHasCandidate(
  min: number,
  max: number,
  step: number,
  threshold: number | null,
  sign: 'any' | 'positive' | 'negative'
): boolean {
  return rangeValues(min, max, step).some((value) =>
    thresholdMatches(value, threshold) && signMatches(value, sign)
  );
}

export function powerPairIsAllowed(ranges: LensPowerRange[], sph: number, cyl: number): boolean {
  return ranges.some((range) => {
    if (range.allowed_combinations.length > 0) {
      return range.allowed_combinations.some((pair) => Math.abs(pair.sph - sph) < 0.000001 && Math.abs(pair.cyl - cyl) < 0.000001);
    }
    return inSteppedRange(sph, range.sph_min, range.sph_max, range.sph_step)
      && inSteppedRange(cyl, range.cyl_min, range.cyl_max, range.cyl_step);
  });
}

export function powerRangeMatchesFilter(
  ranges: LensPowerRange[],
  sphThreshold: number | null,
  cylThreshold: number | null,
  sphSign: 'any' | 'positive' | 'negative',
  cylSign: 'any' | 'positive' | 'negative'
): boolean {
  return ranges.some((range) => {
    if (range.allowed_combinations.length > 0) {
      return range.allowed_combinations.some((pair) =>
        thresholdMatches(pair.sph, sphThreshold)
        && thresholdMatches(pair.cyl, cylThreshold)
        && signMatches(pair.sph, sphSign)
        && signMatches(pair.cyl, cylSign)
      );
    }
    return rangeHasCandidate(range.sph_min, range.sph_max, range.sph_step, sphThreshold, sphSign)
      && rangeHasCandidate(range.cyl_min, range.cyl_max, range.cyl_step, cylThreshold, cylSign);
  });
}

export function rangeValues(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  for (let value = min; value <= max + 0.000001; value += step) {
    values.push(Number(value.toFixed(4)));
    if (values.length > 2000) break;
  }
  return values;
}

export function formatPower(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

export function validatePowerRange(input: Omit<LensPowerRange, 'id' | 'lens_id' | 'created_at'>): string | null {
  if (![input.sph_min, input.sph_max, input.sph_step, input.cyl_min, input.cyl_max, input.cyl_step].every(Number.isFinite)) {
    return 'Заполните все числовые значения диапазона';
  }
  if (input.sph_min > input.sph_max || input.cyl_min > input.cyl_max) return 'Минимум не может быть больше максимума';
  if (input.sph_step <= 0 || input.cyl_step <= 0) return 'Шаг должен быть больше нуля';
  if (input.allowed_combinations.some((pair) =>
    !Number.isFinite(pair.sph) || !Number.isFinite(pair.cyl)
    || !inSteppedRange(pair.sph, input.sph_min, input.sph_max, input.sph_step)
    || !inSteppedRange(pair.cyl, input.cyl_min, input.cyl_max, input.cyl_step)
  )) return 'Точные сочетания должны попадать в указанные диапазоны и шаги';
  return null;
}
