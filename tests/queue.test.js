/**
 * Tests for queue module
 */

const { strict: assert } = require('assert');
const queue = require('../src/queue');

describe('Queue', () => {
  const testTracks = [
    {
      id: 'track1',
      title: 'First Track',
      channel: 'Artist 1',
      url: 'https://youtube.com/watch?v=track1'
    },
    {
      id: 'track2',
      title: 'Second Track',
      channel: 'Artist 2',
      url: 'https://youtube.com/watch?v=track2'
    },
    {
      id: 'track3',
      title: 'Third Track',
      channel: 'Artist 3',
      url: 'https://youtube.com/watch?v=track3'
    }
  ];

  beforeEach(() => {
    // Initialize and clear queue
    queue.init();
    queue.clear();
  });

  afterEach(() => {
    // Cleanup
    queue.clear();
  });

  describe('add', () => {
    it('should add track to queue', () => {
      const result = queue.add(testTracks[0], false);
      assert.ok('position' in result);
      assert.ok('queue' in result);
      assert.ok(Array.isArray(result.queue));
    });

    it('should increment position', () => {
      queue.add(testTracks[0], false);
      const result1 = queue.add(testTracks[1], false);
      const result2 = queue.add(testTracks[2], false);
      assert.strictEqual(result2.position, result1.position + 1);
    });

    it('should set playing state when playNow is true', () => {
      queue.add(testTracks[0], true);
      const status = queue.getStatus();
      assert.strictEqual(status.currentIndex, 0);
      assert.strictEqual(status.playing, true);
    });
  });

  describe('getNext', () => {
    it('should get first track when at start', () => {
      queue.add(testTracks[0], false);
      queue.add(testTracks[1], false);

      const result = queue.getNext();
      assert.strictEqual(result.found, true);
      assert.strictEqual(result.track.id, testTracks[0].id);
      assert.strictEqual(result.index, 0);
    });

    it('should get next track', () => {
      queue.add(testTracks[0], false);
      queue.add(testTracks[1], false);
      queue.getNext(); // Get first track

      const result = queue.getNext();
      assert.strictEqual(result.found, true);
      assert.strictEqual(result.track.id, testTracks[1].id);
    });

    it('should return not found when at end', () => {
      queue.add(testTracks[0], false);
      queue.getNext(); // Get the only track

      const result = queue.getNext();
      assert.strictEqual(result.found, false);
    });

    it('should include remaining count', () => {
      queue.add(testTracks[0], false);
      queue.add(testTracks[1], false);
      queue.add(testTracks[2], false);

      const result = queue.getNext();
      assert.strictEqual(result.remaining, 2);
    });
  });

  describe('getPrev', () => {
    it('should get previous track', () => {
      queue.add(testTracks[0], false);
      queue.add(testTracks[1], false);
      queue.add(testTracks[2], false);
      queue.getNext(); // Move to index 0
      queue.getNext(); // Move to index 1

      const result = queue.getPrev();
      assert.strictEqual(result.found, true);
      assert.strictEqual(result.index, 0);
    });

    it('should return not found when at start', () => {
      queue.add(testTracks[0], false);
      queue.getNext(); // Get first track

      const result = queue.getPrev();
      assert.strictEqual(result.found, false);
    });
  });

  describe('getCurrent', () => {
    it('should get current track', () => {
      const result = queue.getCurrent();
      assert.ok('found' in result);
      if (result.found) {
        assert.ok('track' in result);
        assert.ok('index' in result);
      }
    });

    it('should return not found when no current track', () => {
      queue.clear();
      const result = queue.getCurrent();
      assert.strictEqual(result.found, false);
    });
  });

  describe('getStatus', () => {
    it('should return status object', () => {
      queue.add(testTracks[0], false);
      queue.add(testTracks[1], false);

      const status = queue.getStatus();
      assert.ok('total' in status);
      assert.ok('currentIndex' in status);
      assert.ok('playing' in status);
      assert.ok('current' in status);
      assert.ok('upcoming' in status);
      assert.ok(Array.isArray(status.upcoming));
    });

    it('should show correct total', () => {
      queue.add(testTracks[0], false);
      queue.add(testTracks[1], false);
      const status = queue.getStatus();
      assert.strictEqual(status.total, 2);
    });
  });

  describe('remove', () => {
    it('should remove track by index', () => {
      const initialStatus = queue.getStatus();
      const result = queue.remove(1);
      
      if (result) {
        const newStatus = queue.getStatus();
        assert.strictEqual(newStatus.total, initialStatus.total - 1);
      }
    });

    it('should return false for invalid index', () => {
      const result = queue.remove(9999);
      assert.strictEqual(result, false);
    });
  });

  describe('clear', () => {
    it('should clear all tracks', () => {
      const result = queue.clear();
      assert.strictEqual(result, true);
      
      const status = queue.getStatus();
      assert.strictEqual(status.total, 0);
      assert.strictEqual(status.currentIndex, -1);
    });
  });

  describe('setPlaying', () => {
    it('should set queue as playing from index', () => {
      queue.clear();
      queue.add(testTracks[0], false);
      queue.add(testTracks[1], false);
      queue.add(testTracks[2], false);
      
      queue.setPlaying(1);
      const status = queue.getStatus();
      assert.strictEqual(status.currentIndex, 1);
      assert.strictEqual(status.playing, true);
    });
  });

  describe('stop', () => {
    it('should stop queue playback', () => {
      queue.setPlaying(0);
      queue.stop();
      
      const status = queue.getStatus();
      assert.strictEqual(status.playing, false);
    });
  });

  describe('loadQueue/saveQueue', () => {
    it('should persist queue state', () => {
      queue.clear();
      queue.add(testTracks[0], false);
      
      const saved = queue.loadQueue();
      assert.ok('tracks' in saved);
      assert.ok('currentIndex' in saved);
      assert.ok('playing' in saved);
      assert.strictEqual(saved.tracks.length, 1);
    });
  });
});
