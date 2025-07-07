/**
 * Logger utility for TaskGo backend
 * Provides structured logging with different levels
 */

const isDevelopment = process.env.NODE_ENV === 'development';

class Logger {
  constructor() {
    this.timestamp = () => new Date().toISOString();
  }

  info(message, data = null) {
    if (isDevelopment) {
      console.log(`[INFO] ${this.timestamp()} - ${message}`);
      if (data) {
        console.log('Data:', JSON.stringify(data, null, 2));
      }
    }
  }

  error(message, error = null) {
    console.error(`[ERROR] ${this.timestamp()} - ${message}`);
    if (error && isDevelopment) {
      console.error('Error details:', error);
    }
  }

  warn(message, data = null) {
    if (isDevelopment) {
      console.warn(`[WARN] ${this.timestamp()} - ${message}`);
      if (data) {
        console.warn('Data:', JSON.stringify(data, null, 2));
      }
    }
  }

  debug(message, data = null) {
    if (isDevelopment) {
      console.log(`[DEBUG] ${this.timestamp()} - ${message}`);
      if (data) {
        console.log('Data:', JSON.stringify(data, null, 2));
      }
    }
  }

  // For API request logging
  request(method, url, duration, statusCode) {
    if (isDevelopment) {
      const statusColor = statusCode >= 400 ? '\x1b[31m' : statusCode >= 300 ? '\x1b[33m' : '\x1b[32m';
      const resetColor = '\x1b[0m';
      console.log(`${statusColor}${method} ${url} - ${statusCode} - ${duration}ms${resetColor}`);
    }
  }

  // For database operations
  db(operation, collection, duration) {
    if (isDevelopment) {
      console.log(`[DB] ${this.timestamp()} - ${operation} on ${collection} - ${duration}ms`);
    }
  }

  // For authentication events
  auth(event, userId = null) {
    if (isDevelopment) {
      console.log(`[AUTH] ${this.timestamp()} - ${event}${userId ? ` - User: ${userId}` : ''}`);
    }
  }

  // For payment events
  payment(event, data = null) {
    if (isDevelopment) {
      console.log(`[PAYMENT] ${this.timestamp()} - ${event}`);
      if (data) {
        console.log('Payment data:', JSON.stringify(data, null, 2));
      }
    }
  }
}

export default new Logger(); 