import { Request, Response } from 'express';

// Root endpoint handler
export const rootHandler = (req: Request, res: Response) => {
  res.json({
    name: 'Browser Connect HTTP Server',
    version: '1.0.0',
    description: 'HTTP server for Browser Connect extension',
    endpoints: [
      { path: '/', method: 'GET', description: 'This endpoint' },
      { path: '/status', method: 'GET', description: 'Health check' },
      { path: '/socket.io', method: 'GET/POST', description: 'Socket.IO endpoint for extension communication' }
    ]
  });
}; 