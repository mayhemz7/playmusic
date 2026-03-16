/**
 * Tests for cache module
 */

const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cache = require('../src/cache');

describe('Cache', () => {
  const testTrackId = 'test123';
  const testTrack = {
    id: testTrackId,
    title: 'Test Track',
    channel: 'Test Artist'
  };

  beforeEach(() => {
    // Initialize cache
    cache.init();
  });

  afterEach(() => {
    // Cleanup test cache
    cache.remove(testTrackId);
  });

  describe('getCacheKey', () => {
    it('should generate consistent hash', () => {
      const key1 = cache.getCacheKey('test query');
      const key2 = cache.getCacheKey('test query');
      assert.strictEqual(key1, key2);
    });

    it('should be case-insensitive', () => {
      const key1 = cache.getCacheKey('Test Query');
      const key2 = cache.getCacheKey('test query');
      assert.strictEqual(key1, key2);
    });

    it('should generate different keys for different queries', () => {
      const key1 = cache.getCacheKey('query 1');
      const key2 = cache.getCacheKey('query 2');
      assert.notStrictEqual(key1, key2);
    });
  });

  describe('getTrackPath', () => {
    it('should return correct path', () => {
      const trackPath = cache.getTrackPath(testTrackId);
      assert.ok(trackPath.endsWith('.m4a'));
      assert.ok(trackPath.includes(testTrackId));
    });
  });

  describe('check', () => {
    it('should return not exists for non-cached track', () => {
      const result = cache.check('nonexistent');
      assert.strictEqual(result.exists, false);
      assert.strictEqual(result.valid, false);
    });
  });

  describe('formatSize', () => {
    it('should format bytes to KB', () => {
      const result = cache.formatSize(1024);
      assert.strictEqual(result, '1.0 KB');
    });

    it('should format bytes to MB', () => {
      const result = cache.formatSize(1024 * 1024);
      assert.strictEqual(result, '1.0 MB');
    });

    it('should format bytes to GB', () => {
      const result = cache.formatSize(1024 * 1024 * 1024);
      assert.strictEqual(result, '1.0 GB');
    });

    it('should handle zero bytes', () => {
      const result = cache.formatSize(0);
      assert.strictEqual(result, '0 B');
    });
  });

  describe('loadIndex/saveIndex', () => {
    it('should load empty index if not exists', () => {
      const index = cache.loadIndex();
      assert.deepStrictEqual(index, { tracks: {}, totalSize: 0 });
    });

    it('should save and load index', () => {
      const testIndex = {
        tracks: { test: { id: 'test', title: 'Test' } },
        totalSize: 1024
      };
      
      cache.saveIndex(testIndex);
      const loaded = cache.loadIndex();
      
      assert.deepStrictEqual(loaded, testIndex);
      
      // Restore original
      cache.saveIndex({ tracks: {}, totalSize: 0 });
    });
  });

  describe('getStats', () => {
    it('should return stats object', () => {
      const stats = cache.getStats();
      assert.ok('count' in stats);
      assert.ok('totalSize' in stats);
      assert.ok('totalSizeFormatted' in stats);
      assert.ok('tracks' in stats);
      assert.ok(Array.isArray(stats.tracks));
    });
  });
});
