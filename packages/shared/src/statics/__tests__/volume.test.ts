import { describe, expect, test } from 'bun:test';
import {
  VOLUME_DEFAULT_PERCENT,
  VOLUME_MAX_PERCENT,
  VOLUME_MIN_PERCENT,
  clampVolumePercent,
  isVolumeBoosted,
  volumePercentToGain
} from '../volume';

describe('volume', () => {
  test('should convert a percentage to the gain the audio graph expects', () => {
    expect(volumePercentToGain(VOLUME_MIN_PERCENT)).toBe(0);
    expect(volumePercentToGain(VOLUME_DEFAULT_PERCENT)).toBe(1);
    expect(volumePercentToGain(150)).toBe(1.5);
    expect(volumePercentToGain(VOLUME_MAX_PERCENT)).toBe(4);
  });

  test('should clamp out of range percentages', () => {
    expect(clampVolumePercent(1500)).toBe(VOLUME_MAX_PERCENT);
    expect(clampVolumePercent(-50)).toBe(VOLUME_MIN_PERCENT);
    expect(volumePercentToGain(1500)).toBe(4);
  });

  test('should fall back to the default when the percentage is not a number', () => {
    expect(clampVolumePercent(Number.NaN)).toBe(VOLUME_DEFAULT_PERCENT);
    expect(clampVolumePercent(Number.POSITIVE_INFINITY)).toBe(
      VOLUME_DEFAULT_PERCENT
    );
  });

  test('should only flag a percentage above the default as boosted', () => {
    expect(isVolumeBoosted(VOLUME_DEFAULT_PERCENT)).toBe(false);
    expect(isVolumeBoosted(VOLUME_MAX_PERCENT)).toBe(true);
  });
});
