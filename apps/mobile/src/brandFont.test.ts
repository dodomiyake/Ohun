import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('mobile brand font configuration', () => {
  it('depends on @expo-google-fonts/nunito ExtraBold', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@expo-google-fonts/nunito']).toBeTruthy();
  });

  it('loads Nunito_800ExtraBold with splash control and failure-safe path', () => {
    const layout = readFileSync(join(root, 'app/_layout.tsx'), 'utf8');
    expect(layout).toContain("from '@expo-google-fonts/nunito/800ExtraBold'");
    expect(layout).toContain('Nunito_800ExtraBold');
    expect(layout).toContain('expo-splash-screen');
    expect(layout).toContain('preventAutoHideAsync');
    expect(layout).toContain('hideAsync');
    expect(layout).toContain('fontError');
    expect(layout).toContain('fontsReady');
    expect(layout).not.toMatch(/\.woff2?/);
    expect(layout).not.toMatch(/DejaVu/);
  });

  it('applies brand family only on the AuthShell brand style', () => {
    const auth = readFileSync(join(root, 'src/shells/AuthShell.tsx'), 'utf8');
    expect(auth).toContain('fontFamilyBrandNative');
    expect(auth).not.toMatch(/DejaVu/);
    // Body copy uses sharedStyles.body without brand family override on the subtitle.
    expect(auth).toMatch(/sharedStyles\.body/);
  });
});
