import { Request, Response, NextFunction } from 'express';

// Simple request logging middleware
export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Log when the request comes in
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Log when the request completes
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });
  
  next();
}; 