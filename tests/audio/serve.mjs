import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);

const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.wav': 'audio/wav' };

const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  const target = new URL(`.${path}`, root);

  if (!target.href.startsWith(root.href)) { response.writeHead(403).end();

 return; }

  try {
    const data = await readFile(fileURLToPath(target));
    const extension = path.slice(path.lastIndexOf('.'));
    response.writeHead(200, { 'Content-Type': mime[extension] ?? 'application/octet-stream' }).end(data);
  } catch { response.writeHead(404).end('Not found'); }
});

server.listen(4189, '127.0.0.1', () => console.log('http://127.0.0.1:4189/tests/audio/index.html'));
