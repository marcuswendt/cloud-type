// The numbers that are shared between stages, kept exactly as the standalone's
// params.ts so the graph and the app compute the same dots.

/** The approved CLOUD OBSERVATORY step between 1C (0) and soft (1): titlepage.GENTLE_T on cloud-plots main. */
// cloud-plots 152a124, titlepage CO_STRENGTHS["final"] = between(0.3) (the 16:02 render).
export const APPROVED_T = 0.3;

/** 1C's own values and soft's, for CLOUD OBSERVATORY's zone (titlepage.CO_STRENGTHS / between). */
export const C1 = { defocus: 0.42, fade: 0.45, dof: 0.17, span: 0.48, tone: 0.7 };
export const SOFT = { defocus: 0.3, fade: 0.3, dof: 0.3, span: 0.6, tone: 0.85 };

/** titlepage.between(t): 0 = 1C, 1 = soft, rounded to 4 places as the Python does. */
export function between(t: number) {
  const r = (a: number, b: number) => Math.round((a + t * (b - a)) * 1e4) / 1e4;
  return {
    defocus: r(C1.defocus, SOFT.defocus),
    fade: r(C1.fade, SOFT.fade),
    dof: r(C1.dof, SOFT.dof),
    span: r(C1.span, SOFT.span),
    tone: r(C1.tone, SOFT.tone)
  };
}

export function autoPitch(capMm: number) {
  return Math.min(0.6, Math.max(0.28, capMm / 34));
}

/** The dot pitch: explicit when > 0, otherwise cap / 34 clamped, divided by the density. */
export function pitchOf(capMm: number, density: number, pitchMm: number) {
  const base = pitchMm > 0 ? pitchMm : autoPitch(capMm);
  return base / Math.max(0.05, density);
}

/** Mask raster resolution in px per mm (the standalone's quality switch). */
export function maskResolution(pitchMm: number, quality: string) {
  return (quality === 'preview' ? 6 : 10) / pitchMm;
}

/** titletype.dot_scale. */
export function dotScale(t: number, growth: number, size: number) {
  return Math.max(0.05, size * (1 - growth * 0.5 + growth * t));
}
