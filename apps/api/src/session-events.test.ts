import { describe, expect, it, vi, afterEach } from 'vitest';
import { SecurityEvent } from './models.js';
import { recordSessionEvent } from './session-events.js';
const userId = '507f1f77bcf86cd799439011';
const metadata = { sessionId: userId, targetSessionId: userId, revokedCount: 1 };
afterEach(() => vi.restoreAllMocks());
describe('device security events', () => {
  it('validates event-specific fields at the model boundary', () => {
    expect(new SecurityEvent({ userId, type: 'device_revoked', metadata }).validateSync()).toBeUndefined();
    expect(new SecurityEvent({ userId, type: 'other_devices_revoked', metadata }).validateSync()).toBeDefined();
    expect(new SecurityEvent({ userId, type: 'device_revoked', metadata: { sessionId: userId } }).validateSync()).toBeDefined();
  });
  it('rejects nested secrets, unknown fields, and invalid values', () => {
    for (const bad of [{ ...metadata, password: 'secret' }, { ...metadata, revokedCount: -1 }, { ...metadata, sessionId: { token: 'secret' } }]) {
      expect(new SecurityEvent({ userId, type: 'device_revoked', metadata: bad }).validateSync()).toBeDefined();
    }
  });
  it('reports audit persistence failure without throwing or logging metadata', async () => {
    vi.spyOn(SecurityEvent, 'create').mockRejectedValueOnce(new Error('secret database payload'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(recordSessionEvent(userId, 'device_revoked', metadata)).resolves.toBeUndefined();
    const report = JSON.parse(log.mock.calls[0]![0]);
    expect(report).toMatchObject({ type: 'device_revoked', alert: true });
    expect(report.requestCorrelationId).toBeTypeOf('string');
    expect(JSON.stringify(report)).not.toContain(userId);
    expect(JSON.stringify(report)).not.toContain('secret');
  });
});
