import { app } from './app.js';
import { config } from './config/index.js';

const server = app.listen(config.port, () => {
  console.log(`
============================================================
 SENTINEL 2.0 API RUNTIME ACTIVE
============================================================
 [Service]  : sentinel-api
 [Env]      : ${config.env}
 [Port]     : ${config.port}
 [Health]   : http://localhost:${config.port}${config.apiPrefix}/health
 [Ready]    : Runtime Control Layer Foundation Initialized
============================================================
  `);
});

// Graceful shutdown handling
function handleShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Gracefully terminating Sentinel 2.0 API...`);
  server.close(() => {
    console.log('Sentinel 2.0 API closed successfully.');
    process.exit(0);
  });

  // Force exit if hanging
  setTimeout(() => {
    console.error('Forcefully terminating after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export { server };
