import { describe, it, expect } from 'vitest';
import {
  normalizeCondition,
  parseStorageGB,
  parseRamGB,
  canonicalizeBrand,
  extractModelNumber,
  buildSlug,
} from '@refurbcompare/core';

describe('normalizeCondition', () => {
  it('maps common seller strings to normalized grades', () => {
    expect(normalizeCondition('Excellent').normalized).toBe('EXCELLENT');
    expect(normalizeCondition('A').normalized).toBe('EXCELLENT');
    expect(normalizeCondition('Certified Refurbished').normalized).toBe('REFURBISHED');
    expect(normalizeCondition('B+').normalized).toBe('GOOD');
    expect(normalizeCondition('Like New').normalized).toBe('LIKE_NEW');
    expect(normalizeCondition('Fair').normalized).toBe('FAIR');
  });

  it('returns UNKNOWN for missing or unrecognized input', () => {
    expect(normalizeCondition(null).normalized).toBe('UNKNOWN');
    expect(normalizeCondition('').normalized).toBe('UNKNOWN');
    expect(normalizeCondition('Mint with charger').normalized).toBe('UNKNOWN');
  });

  it('attaches the score and description matching the grade', () => {
    const excellent = normalizeCondition('Excellent');
    expect(excellent.score).toBe(90);
    expect(excellent.description.length).toBeGreaterThan(0);
    expect(excellent.source).toBe('excellent');
  });
});

describe('parseStorageGB / parseRamGB', () => {
  it('parses common storage spellings', () => {
    expect(parseStorageGB('128GB')).toBe(128);
    expect(parseStorageGB('256 gb')).toBe(256);
    expect(parseStorageGB('1TB')).toBe(1024);
  });

  it('rejects implausible or malformed values', () => {
    expect(parseStorageGB('0GB')).toBeNull();
    expect(parseStorageGB('5000GB')).toBeNull();
    expect(parseStorageGB('gb')).toBeNull();
    expect(parseStorageGB('Series 13')).toBeNull();
  });

  it('parses RAM and rejects values outside phone range', () => {
    expect(parseRamGB('6GB')).toBe(6);
    expect(parseRamGB('12 gb')).toBe(12);
    expect(parseRamGB('128GB RAM')).toBeNull();
  });
});

describe('canonicalizeBrand', () => {
  it('resolves aliases and title-cases unknown brands', () => {
    expect(canonicalizeBrand('apple')).toBe('Apple');
    expect(canonicalizeBrand('iphone')).toBe('Apple');
    expect(canonicalizeBrand('pixel')).toBe('Google');
    expect(canonicalizeBrand('redmi')).toBe('Xiaomi');
    expect(canonicalizeBrand('nothing')).toBe('Nothing');
    expect(canonicalizeBrand(null)).toBeNull();
  });
});

describe('extractModelNumber', () => {
  it('extracts Samsung / Apple hardware codes', () => {
    expect(extractModelNumber('Samsung Galaxy S22 SM-S901E 128GB')).toBe('SMS901E');
    expect(extractModelNumber('Apple iPhone 13 A2633 128GB')).toBe('A2633');
  });

  it('does not confuse a year or storage size with a model code', () => {
    expect(extractModelNumber('iPhone 13 128GB')).toBeNull();
  });
});

describe('buildSlug', () => {
  it('builds URL-safe product slugs', () => {
    expect(buildSlug('Apple', 'iPhone 13', 128)).toBe('apple-iphone-13-128gb');
    expect(buildSlug('Google', 'Pixel 8', null)).toBe('google-pixel-8');
  });
});