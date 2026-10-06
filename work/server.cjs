const {startServer} = require('./backend/dist/server.js');
startServer().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
