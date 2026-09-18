import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";

export interface RouteResponse {
  body: string;
  type?: string;
  status?: number;
  delayMs?: number;
}

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

export function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");
}

export async function startTestServer(routes: Record<string, RouteResponse>): Promise<TestServer> {
  const server = createServer((request, response) => {
    const path = (request.url ?? "/").split("?")[0] ?? "/";
    const route = routes[path];
    if (route === undefined) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("not found");
      return;
    }
    const respond = (): void => {
      response.writeHead(route.status ?? 200, { "content-type": route.type ?? "text/html; charset=utf-8" });
      response.end(route.body);
    };
    if (route.delayMs !== undefined) {
      setTimeout(respond, route.delayMs);
    } else {
      respond();
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}
