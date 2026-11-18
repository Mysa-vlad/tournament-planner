import { loadConfig } from './config/env.js';
import { createApp } from './http/app.js';

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, () => {
  console.info(`Tournament Planner v${config.version} listening on :${String(config.port)}`);
});
