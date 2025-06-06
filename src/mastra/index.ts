import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { QueryRouterAgent } from './agents/QueryRouterAgent';

export const mastra = new Mastra({
  agents: { QueryRouterAgent },
  storage: new LibSQLStore({
    url: ':memory:', // Change to 'file:../mastra.db' if persistence is needed
  }),
  logger: new PinoLogger({
    name: 'AiDit Agent',
    level: 'info',
  }),
});
