const {runServer} = require('./backend/dist/server.js');
runServer().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
