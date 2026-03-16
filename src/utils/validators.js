/**
 * Input validation utilities
 */

const validators = {
  /**
   * Validate search query
   * @param {string} query 
   * @returns {{ valid: boolean, error?: string }}
   */
  validateQuery(query) {
    if (!query || typeof query !== 'string') {
      return { valid: false, error: 'Запрос должен быть строкой' };
    }

    const trimmed = query.trim();
    
    if (trimmed.length === 0) {
      return { valid: false, error: 'Запрос не может быть пустым' };
    }

    if (trimmed.length > 200) {
      return { valid: false, error: 'Запрос слишком длинный (макс. 200 символов)' };
    }

    // Check for potentially dangerous characters (basic sanitization)
    const dangerousChars = /[;&|`$(){}[\]]/g;
    if (dangerousChars.test(trimmed)) {
      return { valid: false, error: 'Запрос содержит недопустимые символы' };
    }

    return { valid: true };
  },

  /**
   * Validate volume level
   * @param {number|string} level 
   * @returns {{ valid: boolean, value?: number, error?: string }}
   */
  validateVolume(level) {
    const num = typeof level === 'string' ? parseInt(level, 10) : level;

    if (isNaN(num)) {
      return { valid: false, error: 'Громкость должна быть числом' };
    }

    if (num < 0 || num > 100) {
      return { valid: false, error: 'Громкость должна быть от 0 до 100' };
    }

    return { valid: true, value: num };
  },

  /**
   * Check if string is valid UTF-8 (supports Cyrillic and Latin)
   * @param {string} str 
   * @returns {boolean}
   */
  isValidUTF8(str) {
    try {
      // JavaScript strings are UTF-16, but we can check for valid encoding
      new TextEncoder().encode(str);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Sanitize filename (remove dangerous characters)
   * @param {string} filename 
   * @returns {string}
   */
  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_') // Replace dangerous chars
      .replace(/\s+/g, ' ')          // Normalize whitespace
      .trim()
      .substring(0, 100);            // Limit length
  }
};

module.exports = validators;
