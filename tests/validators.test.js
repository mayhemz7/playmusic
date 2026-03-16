/**
 * Tests for validators module
 */

const { strict: assert } = require('assert');
const validators = require('../src/utils/validators');

describe('Validators', () => {
  describe('validateQuery', () => {
    it('should reject empty query', () => {
      const result = validators.validateQuery('');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Запрос должен быть строкой');
    });

    it('should reject whitespace-only query', () => {
      const result = validators.validateQuery('   ');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Запрос не может быть пустым');
    });

    it('should validate normal query', () => {
      const result = validators.validateQuery('never gonna give you up');
      assert.strictEqual(result.valid, true);
    });

    it('should validate Cyrillic query', () => {
      const result = validators.validateQuery('кино - группа крови');
      assert.strictEqual(result.valid, true);
    });

    it('should reject query with dangerous characters', () => {
      const result = validators.validateQuery('test; rm -rf /');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Запрос содержит недопустимые символы');
    });

    it('should reject too long query', () => {
      const longQuery = 'a'.repeat(201);
      const result = validators.validateQuery(longQuery);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Запрос слишком длинный (макс. 200 символов)');
    });

    it('should reject non-string query', () => {
      const result = validators.validateQuery(123);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Запрос должен быть строкой');
    });
  });

  describe('validateVolume', () => {
    it('should validate valid volume (number)', () => {
      const result = validators.validateVolume(50);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.value, 50);
    });

    it('should validate valid volume (string)', () => {
      const result = validators.validateVolume('75');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.value, 75);
    });

    it('should validate volume 0', () => {
      const result = validators.validateVolume(0);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.value, 0);
    });

    it('should validate volume 100', () => {
      const result = validators.validateVolume(100);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.value, 100);
    });

    it('should reject negative volume', () => {
      const result = validators.validateVolume(-10);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Громкость должна быть от 0 до 100');
    });

    it('should reject volume > 100', () => {
      const result = validators.validateVolume(150);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Громкость должна быть от 0 до 100');
    });

    it('should reject NaN', () => {
      const result = validators.validateVolume(NaN);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Громкость должна быть числом');
    });
  });

  describe('sanitizeFilename', () => {
    it('should sanitize dangerous characters', () => {
      const result = validators.sanitizeFilename('test<>:"/\\|?*file');
      assert.strictEqual(result, 'test_________file');
    });

    it('should normalize whitespace', () => {
      const result = validators.sanitizeFilename('test    multiple   spaces');
      assert.strictEqual(result, 'test multiple spaces');
    });

    it('should trim and limit length', () => {
      const longName = 'a'.repeat(150);
      const result = validators.sanitizeFilename(longName);
      assert.strictEqual(result.length, 100);
    });
  });

  describe('isValidUTF8', () => {
    it('should validate English text', () => {
      const result = validators.isValidUTF8('Hello World');
      assert.strictEqual(result, true);
    });

    it('should validate Cyrillic text', () => {
      const result = validators.isValidUTF8('Привет мир');
      assert.strictEqual(result, true);
    });

    it('should validate mixed text', () => {
      const result = validators.isValidUTF8('Hello Привет 123');
      assert.strictEqual(result, true);
    });
  });
});
