import cors from 'cors';

// CORS configuration for the HTTP server
export const corsMiddleware = cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST'], // Allow only GET and POST methods
  credentials: true, // Allow credentials
  optionsSuccessStatus: 204 // Some legacy browsers (IE11) choke on 204
}); 