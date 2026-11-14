import type { AddressInfo } from 'node:net';
import { createContainer, type Container } from '../../src/composition.js';
import type { AppConfig } from '../../src/config/env.js';
import { createApp } from '../../src/http/app.js';

export interface TestServer {
  readonly baseUrl: string;
  readonly container: Container;
  close(): Promise<void>;
}

export const startTestServer = async (overrides: Partial<AppConfig>): Promise<TestServer> => {
  const config: AppConfig = {
    port: 0,
    version: 'smoke',
    dataSource: 'static',
    databaseUrl: 'memory://',
    ...overrides,
  };
  const container = await createContainer(config);
  const app = createApp(container.services, { version: config.version });
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({
        baseUrl: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
        container,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => {
              void container.close().then(done);
            });
          }),
      });
    });
  });
};

export interface ApiResponse<T> {
  readonly status: number;
  readonly body: T;
  readonly headers: Headers;
}

export const api =
  (baseUrl: string) =>
  async <T = Record<string, unknown>>(
    method: string,
    path: string,
    options: { body?: unknown; user?: string } = {},
  ): Promise<ApiResponse<T>> => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (options.user) headers['x-user-id'] = options.user;
    const res = await fetch(baseUrl + path, {
      method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    return { status: res.status, body: (await res.json()) as T, headers: res.headers };
  };
