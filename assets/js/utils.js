/**
 * Yellow Rose - Shared Frontend Utilities
 * Unified helpers for HTML escaping, phone formatting, clipboard, and notifications
 */

(function(global) {
  'use strict';

  const YellowRoseUtils = {
    /**
     * Escape HTML special characters to prevent XSS
     * @param {string} str
     * @returns {string}
     */
    escapeHtml: function(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /**
     * Format a phone number into international format for WhatsApp links
     * @param {string} phone
     * @returns {string}
     */
    formatWhatsAppPhone: function(phone) {
      if (!phone) return '966582739397';
      let cleaned = String(phone).replace(/[^0-9]/g, '');
      if (cleaned.startsWith('05')) {
        cleaned = '966' + cleaned.substring(1);
      } else if (cleaned.startsWith('5') && cleaned.length === 9) {
        cleaned = '966' + cleaned;
      }
      return cleaned || '966582739397';
    },

    /**
     * Format Date into Arabic locale string
     * @param {Date|string|number} dateInput
     * @returns {string}
     */
    formatDateArabic: function(dateInput) {
      if (!dateInput) return '---';
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return String(dateInput);
      return d.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    /**
     * Copy text to clipboard with fallback
     * @param {string} text
     * @returns {Promise<boolean>}
     */
    copyToClipboard: async function(text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        }
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return !!successful;
      } catch (e) {
        console.error('Clipboard copy failed:', e);
        return false;
      }
    }
  };

  global.YRUtils = YellowRoseUtils;
})(typeof window !== 'undefined' ? window : this);
