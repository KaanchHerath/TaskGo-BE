/**
 * Simple logger utility for the application
 * Provides consistent logging interface across all modules
 */

const logger = {
  info: (message, data = {}) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`, data);
  },
  
  warn: (message, data = {}) => {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, data);
  },
  
  error: (message, data = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, data);
  },
  
  auth: (message, data = {}) => {
    console.log(`[AUTH] ${new Date().toISOString()}: ${message}`, data);
  }
};

export default logger;

