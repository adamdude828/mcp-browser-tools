import { Request, Response } from 'express';

// Health check endpoint handler
export const healthHandler = (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
}; 