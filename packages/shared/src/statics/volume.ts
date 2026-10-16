// the volume sliders go past 100% so a quiet microphone can be boosted. a boost
// cannot go through HTMLMediaElement.volume, which the browser rejects above 1
export const VOLUME_MIN_PERCENT = 0;
export const VOLUME_DEFAULT_PERCENT = 100;
// boost is linear in amplitude, so 400% is about +12 dB. going higher is possible
// but the slider gets too coarse to aim between 100% and the top
export const VOLUME_MAX_PERCENT = 400;

const clampVolumePercent = (percent: number): number => {
  if (!Number.isFinite(percent)) return VOLUME_DEFAULT_PERCENT;

  return Math.min(VOLUME_MAX_PERCENT, Math.max(VOLUME_MIN_PERCENT, percent));
};

const volumePercentToGain = (percent: number): number =>
  clampVolumePercent(percent) / VOLUME_DEFAULT_PERCENT;

const isVolumeBoosted = (percent: number): boolean =>
  percent > VOLUME_DEFAULT_PERCENT;

export { clampVolumePercent, isVolumeBoosted, volumePercentToGain };
