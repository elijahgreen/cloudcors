import { expect } from 'chai';
import { handleRequest } from '../src/handler';
import * as fs from 'fs';
import * as path from 'path';
import * as CloudWorker from '@dollarshaveclub/cloudworker';
import { AddressInfo } from 'net';
import axios from 'axios';

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
  beforeEach(() => {
    const worker = new CloudWorker(workerScript);
    const server = worker.listen();
    serverAddress = `http://localhost:${
      (server.address() as AddressInfo).port
    }`;
  });
  it('GET /', async () => {
    const url = `${serverAddress}`;
    const result = await axios.get<string>(serverAddress);
    const text = result.data;
    expect(text).to.include('CLOUDFLARE');
  });
});
