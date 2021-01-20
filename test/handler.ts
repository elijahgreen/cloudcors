import { expect } from 'chai';
import { handleRequest } from '../src/handler';
import * as fs from 'fs';
import * as path from 'path';
import * as CloudWorker from '@dollarshaveclub/cloudworker';
import { AddressInfo } from 'net';
import axios, { AxiosError } from 'axios';
import { Server } from 'http';

const workerScript = fs.readFileSync(
  path.resolve(__dirname, '../../dist/worker.production.js'),
  'utf8',
);

describe('handler returns response with request method', () => {
  const methods = ['GET', 'HEAD', 'POST', 'OPTIONS'];
  methods.forEach((method) => {
    it(method, async () => {
      const result = await handleRequest(new Request('/', { method }));
      const text = await result.text();
      expect(text).to.include('CLOUDFLARE');
    });
  });
});

describe('general methods', () => {
  let serverAddress: string;
  let server: Server;
  before(() => {
    const worker = new CloudWorker(workerScript, {
      bindings: { ENDPOINT_ALLOWLIST: '["example.com"]' },
    });
    server = worker.listen();
    serverAddress = `http://localhost:${
      (server.address() as AddressInfo).port
    }`;
  });

  after(() => {
    server.close();
  });

  it('GET /', async () => {
    const result = await axios.get<string>(serverAddress);
    const text = result.data;
    expect(text).to.include('CLOUDFLARE');
  });

  it('GET /?url=http://example.com', async () => {
    const url = `${serverAddress}?url=http://example.com`;
    const result = await axios.get<string>(url);
    expect(result.status).to.eq(200);
  });

  it('GET /?url=https://google.com not allowed endpoint', async () => {
    const url = `${serverAddress}?url=https://google.com`;
    try {
      await axios.get<string>(url);
    } catch (e) {
      expect(e.response.status).eq(403);
    }
  });
});
