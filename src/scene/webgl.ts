let cached: boolean | null = null;

/** Whether this browser can give us a WebGL context. Cached after the first probe. */
export function hasWebGL(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    cached = Boolean(gl && typeof (gl as WebGLRenderingContext).getParameter === 'function');
  } catch {
    cached = false;
  }
  return cached;
}

/** Test seam. */
export function resetWebGLProbeForTests(): void {
  cached = null;
}
