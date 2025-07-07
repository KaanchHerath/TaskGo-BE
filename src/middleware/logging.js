// Request logging middleware (minimal production logging)
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log only essential information in production
  if (process.env.NODE_ENV === 'development') {
    console.log(`${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
  }
  
  // Add response time to headers
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (process.env.NODE_ENV === 'development') {
      console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    }
  });
  
  next();
}; 