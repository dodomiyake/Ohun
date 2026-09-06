import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('web brand font assets', () => {
  it('declares Nunito ExtraBold @font-face with weight 800 and font-display swap', () => {
    const css = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
    expect(css).toMatch(/font-family:\s*Nunito;/);
    expect(css).toMatch(/Nunito-ExtraBold\.woff2/);
    expect(css).toMatch(/font-weight:\s*800;/);
    expect(css).toMatch(/font-display:\s*swap;/);
    expect(css).not.toMatch(/font-display:\s*block;/);
    expect(css).not.toMatch(/DejaVu/);
    expect(css).not.toMatch(/\.woff'/);
    expect(css).toMatch(/--ohun-font:\s*Inter/);
    expect(css).toMatch(/--ohun-font-brand:\s*Nunito/);
  });

  it('preloads the self-hosted WOFF2 and does not request Nunito from Google Fonts', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    expect(html).toContain('/fonts/Nunito-ExtraBold.woff2');
    expect(html).not.toMatch(/fonts\.googleapis\.com\/css2\?family=Nunito/i);
    expect(html).not.toMatch(/DejaVu/);
  });

  it('ships a genuine WOFF2 asset (not HTML or empty)', () => {
    const bytes = readFileSync(join(root, 'public/fonts/Nunito-ExtraBold.woff2'));
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('wOF2');
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
