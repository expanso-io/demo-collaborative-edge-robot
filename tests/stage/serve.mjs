import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = fileURLToPath(new URL("../../web/", import.meta.url));

const fixtures = process.argv.includes("--fixtures");

const streams = new Set();

const received = [];

const servers = [];

const ports = {};

let origin;

const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
};

async function listen(handler) {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  return server.address().port;
}

async function json(request) {
  let body = "";

  for await (const chunk of request) body += chunk;

  return JSON.parse(body);
}

function broadcast(envelope) {
  for (const stream of streams)
    stream.write(`data: ${JSON.stringify(envelope)}\n\n`);
}

const uiPort = await listen(async (request, response) => {
  try {
    if (fixtures && request.url === "/__fixture" && request.method === "POST") {
      broadcast(await json(request));
      response.end("ok");

      return;
    }

    if (fixtures && request.url === "/__received") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(received));

      return;
    }

    const pathname = new URL(request.url, origin).pathname;

    const target = path.resolve(
      web,
      `.${decodeURIComponent(pathname === "/" ? "/index.html" : pathname)}`,
    );

    if (!target.startsWith(web)) {
      response.writeHead(403);
      response.end();

      return;
    }

    let body = await fs.readFile(target);

    if (fixtures && path.extname(target) === ".js") {
      // Test-only routing: production modules keep the integration contract ports.
      body = Buffer.from(
        body
          .toString()
          .replace(/\b(4101|4102|4111|4121|4122|4190)\b/g, (port) =>
            String(ports[port]),
          ),
      );
    }

    response.setHeader(
      "Content-Type",
      mime[path.extname(target)] ?? "application/octet-stream",
    );
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    response.writeHead(404);
    response.end(error.code === "ENOENT" ? "Not found" : "Request failed");
  }
});

origin = `http://127.0.0.1:${uiPort}`;

if (fixtures) {
  ports[4190] = await listen((request, response) => {
    response.writeHead(200, {
      "Access-Control-Allow-Origin": origin,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    });
    response.write(": fixture bus\n\n");
    streams.add(response);
    request.on("close", () => streams.delete(response));
  });

  for (const port of [4101, 4102, 4111, 4121, 4122]) {
    ports[port] = await listen(async (request, response) => {
      if (request.method !== "POST") {
        response.writeHead(405);
        response.end();

        return;
      }

      const envelope = await json(request);
      received.push({
        port,
        contentType: request.headers["content-type"],
        envelope,
      });
      broadcast(envelope);
      response.writeHead(200, { "Access-Control-Allow-Origin": origin });
      response.end("ok");
    });
  }
}

console.log(JSON.stringify({ origin, ports, fixtures }));

function close() {
  for (const stream of streams) stream.end();

  for (const server of servers) {
    server.close();
    server.closeAllConnections();
  }
}

process.on("SIGTERM", close);

process.on("SIGINT", close);
