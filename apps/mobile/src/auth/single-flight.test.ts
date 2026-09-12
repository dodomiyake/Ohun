import { describe, expect, it, vi } from 'vitest';
import { singleFlight } from './single-flight';

describe('session restoration coordination', () => {
  it('shares rotation and persistence until the entire operation completes', async () => {
    let finish!: () => void;
    const persisted = new Promise<void>((resolve) => { finish = resolve; });
    const refresh = vi.fn().mockResolvedValue('successor');
    const save = vi.fn().mockImplementation(() => persisted);
    const restore = singleFlight(async () => { const token = await refresh(); await save(token); return token; });
    const first = restore();
    await Promise.resolve(); await Promise.resolve();
    const second = restore();
    expect(second).toBe(first);
    expect(refresh).toHaveBeenCalledTimes(1);
    finish();
    await expect(first).resolves.toBe('successor');
    await restore();
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('releases the pending operation after failure so a user can retry', async () => {
    const operation = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('restored');
    const restore = singleFlight(operation);
    const first = restore(); const second = restore();
    expect(first).toBe(second);
    await expect(first).rejects.toThrow('offline');
    await expect(restore()).resolves.toBe('restored');
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
