/** Chromium-side compositing for the sheet and compare scripts: Remotion's
 * ffmpeg can't overlay or stack, so frames are laid out as HTML and screenshotted. */
import { pathToFileURL } from 'node:url';
import type { Page } from 'playwright';
import { launchPlain } from './tools';

const LABEL_CSS =
  'position:absolute;left:8px;top:8px;font:bold var(--label) DejaVu Sans,sans-serif;color:#fff;background:#000a;padding:2px 10px;border-radius:6px';

export const fileUrl = (path: string) => pathToFileURL(path).href;

/** Runs `work` with a page on a blank file:// origin, so it may load local images. */
export async function withPage<T>(width: number, work: (page: Page) => Promise<T>): Promise<T> {
  const browser = await launchPlain();
  try {
    const page = await browser.newPage({ viewport: { width, height: 200 } });
    await page.goto(fileUrl('/'));
    return await work(page);
  } finally {
    await browser.close();
  }
}

/** Lays out `html` and saves a full-page screenshot once every image has loaded. */
export async function shoot(page: Page, html: string, out: string) {
  await page.setContent(`<body style="margin:0;background:#fff">${html}</body>`);
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  await page.screenshot({
    path: out,
    fullPage: true,
    ...(out.endsWith('.jpg') ? { type: 'jpeg', quality: 90 } : {}),
  });
}

/** Two frames side by side, each `width` px wide, labelled BEFORE and AFTER. */
export function pairHtml(before: string, after: string, width: number) {
  const side = (src: string, text: string) =>
    `<div style="position:relative;width:${width}px"><img src="${fileUrl(src)}" style="width:100%;display:block"><span style="${LABEL_CSS}">${text}</span></div>`;
  return `<div style="display:flex;--label:${Math.round(width / 14)}px">${side(before, 'BEFORE')}${side(after, 'AFTER')}</div>`;
}
