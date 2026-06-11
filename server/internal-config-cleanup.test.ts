import { describe, it, expect } from 'vitest';
import { isInternalConfigKey, parseRetentionDays } from './internal-config-cleanup';

describe('isInternalConfigKey', () => {
  it('matches keys that start with literal _internal_', () => {
    expect(isInternalConfigKey('_internal_full_occupancy_notified_2025-01-01')).toBe(true);
    expect(isInternalConfigKey('_internal_')).toBe(true);
    expect(isInternalConfigKey('_internal_foo')).toBe(true);
  });

  it('does NOT match keys that start with a non-underscore character before "internal_"', () => {
    expect(isInternalConfigKey('xinternal_foo')).toBe(false);
    expect(isInternalConfigKey('ainternal_foo')).toBe(false);
  });

  it('does NOT match regular app config keys', () => {
    expect(isInternalConfigKey('lock_timeout_ms')).toBe(false);
    expect(isInternalConfigKey('timezone')).toBe(false);
    expect(isInternalConfigKey('max_daily_rate')).toBe(false);
    expect(isInternalConfigKey('internal_config_retention_days')).toBe(false);
  });

  it('does NOT match an empty string', () => {
    expect(isInternalConfigKey('')).toBe(false);
  });

  it('does NOT match keys that contain _internal_ but do not start with it', () => {
    expect(isInternalConfigKey('prefix_internal_foo')).toBe(false);
    expect(isInternalConfigKey('some_key_internal_bar')).toBe(false);
  });
});

describe('parseRetentionDays', () => {
  it('returns the parsed number when valid', () => {
    expect(parseRetentionDays('90', 90)).toBe(90);
    expect(parseRetentionDays('30', 90)).toBe(30);
    expect(parseRetentionDays('365', 90)).toBe(365);
  });

  it('falls back to default when value is undefined', () => {
    expect(parseRetentionDays(undefined, 90)).toBe(90);
  });

  it('falls back to default when value is empty string', () => {
    expect(parseRetentionDays('', 90)).toBe(90);
  });

  it('falls back to default when value is non-numeric', () => {
    expect(parseRetentionDays('abc', 90)).toBe(90);
    expect(parseRetentionDays('NaN', 90)).toBe(90);
  });

  it('falls back to default when value is zero', () => {
    expect(parseRetentionDays('0', 90)).toBe(90);
  });

  it('falls back to default when value is negative', () => {
    expect(parseRetentionDays('-10', 90)).toBe(90);
    expect(parseRetentionDays('-1', 90)).toBe(90);
  });
});
