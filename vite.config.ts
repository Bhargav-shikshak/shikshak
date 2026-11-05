import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { localApi } from './demo/local';

function demoBackend(): Plugin {
  const install: NonNullable<Plugin['configureServer']> = (server) => {
    server.middlewares.use(localApi(resolve('.demo-data'), (error) => server.config.logger.error(error)));
  };
  return { name: 'shikshak-demo-api', configureServer: install, configurePreviewServer: install };
}
export default defineConfig({ plugins: [demoBackend()] });
