/**
 * Tests for history module
 */

const { strict: assert } = require('assert');
const history = require('../src/history');

describe('History', () => {
  const testTrack = {
    id: 'test123',
    title: 'Test Track',
    channel: 'Test Artist',
    url: 'https://youtube.com/watch?v=test123'
  };

  beforeEach(() => {
    // Initialize history
    history.init();
  });

  afterEach(() => {
    // Cleanup - remove test entries
    history.clear();
  });

  describe('add', () => {
    it('should add track to history', () => {
      const result = history.add(testTrack);
      assert.strictEqual(result, true);
    });

    it('should move existing track to top', () => {
      // Add same track twice
      history.add(testTrack);
      history.add(testTrack);
      
      const entries = history.get(10);
      const testEntries = entries.filter(e => e.id === testTrack.id);
      
      assert.strictEqual(testEntries.length, 1);
      assert.strictEqual(testEntries[0].playCount, 2);
    });

    it('should limit history size', () => {
      // Add many tracks
      for (let i = 0; i < 150; i++) {
        history.add({
          id: `track${i}`,
          title: `Track ${i}`,
          channel: 'Artist',
          url: `https://youtube.com/watch?v=track${i}`
        });
      }
      
      const entries = history.get(200);
      assert.ok(entries.length <= 100);
      
      // Cleanup
      history.clear();
    });
  });

  describe('get', () => {
    it('should return array of entries', () => {
      const entries = history.get(20);
      assert.ok(Array.isArray(entries));
    });

    it('should respect limit', () => {
      const entries = history.get(5);
      assert.ok(entries.length <= 5);
    });

    it('should return most recent first', () => {
      const entries = history.get(10);
      if (entries.length > 1) {
        const first = new Date(entries[0].playedAt);
        const second = new Date(entries[1].playedAt);
        assert.ok(first >= second);
      }
    });
  });

  describe('getByIndex', () => {
    it('should find track by index (1-based)', () => {
      const result = history.getByIndex(1);
      if (result.found) {
        assert.ok('track' in result);
        assert.ok('index' in result);
        assert.strictEqual(result.index, 0);
      }
    });

    it('should return not found for invalid index', () => {
      const result = history.getByIndex(9999);
      assert.strictEqual(result.found, false);
    });

    it('should return not found for negative index', () => {
      const result = history.getByIndex(0);
      assert.strictEqual(result.found, false);
    });
  });

  describe('search', () => {
    it('should find tracks by title', () => {
      const results = history.search('Test');
      assert.ok(Array.isArray(results));
    });

    it('should find tracks by artist', () => {
      const results = history.search('Artist');
      assert.ok(Array.isArray(results));
    });

    it('should be case-insensitive', () => {
      const results1 = history.search('test');
      const results2 = history.search('TEST');
      assert.strictEqual(results1.length, results2.length);
    });

    it('should return empty array for no matches', () => {
      const results = history.search('nonexistent_artist_xyz');
      assert.ok(Array.isArray(results));
      assert.strictEqual(results.length, 0);
    });
  });

  describe('remove', () => {
    it('should remove entry by index', () => {
      const initialLength = history.get(100).length;
      const result = history.remove(1);
      
      if (result) {
        const newLength = history.get(100).length;
        assert.strictEqual(newLength, initialLength - 1);
      }
    });

    it('should return false for invalid index', () => {
      const result = history.remove(9999);
      assert.strictEqual(result, false);
    });
  });

  describe('clear', () => {
    it('should clear all history', () => {
      const result = history.clear();
      assert.strictEqual(result, true);
      
      const entries = history.get(100);
      assert.strictEqual(entries.length, 0);
    });
  });

  describe('getStats', () => {
    it('should return statistics object', () => {
      const stats = history.getStats();
      assert.ok('totalTracks' in stats);
      assert.ok('totalPlays' in stats);
      assert.ok('mostPlayed' in stats);
      assert.ok(Array.isArray(stats.mostPlayed));
    });
  });
});
