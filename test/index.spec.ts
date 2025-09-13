import worker from "../src/index";

describe("handler returns response with request method", () => {
  const methods = ["GET", "HEAD", "POST", "OPTIONS"];
  methods.forEach((method) => {
    it(method, async () => {
      const env = getMiniflareBindings();
      const result = await worker.fetch(
        new Request("http://localhost/", { method }),
        env
      );
      const text = await result.text();
      expect(text).toContain("CLOUDCORS");
    });
  });
});

describe("general methods", () => {
  it("GET /", async () => {
    const env = getMiniflareBindings();
    const result = await worker.fetch(
      new Request("http://localhost", { method: "GET" }),
      env
    );
    const text = await result.text();
    expect(text).toContain("CLOUDCORS");
  });

  it("GET /?url=http://example.com", async () => {
    const env = getMiniflareBindings();
    env.ENDPOINT_ALLOWLIST = `["example.com"]`;
    env.CONTENT_TYPE_ALLOWLIST = "";
    const url = `http://localhost?url=http://example.com`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), env);
    expect(result.status).toBe(200);
  });

  it("GET /http://example.com", async () => {
    const env = getMiniflareBindings();
    env.ENDPOINT_ALLOWLIST = `["example.com"]`;
    env.CONTENT_TYPE_ALLOWLIST = "";
    const url = `http://localhost/http://example.com`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), env);
    expect(result.status).toBe(200);
  });

  it("GET /?url=https://google.com not allowed endpoint", async () => {
    const env = getMiniflareBindings();
    const url = `http://localhost?url=https://www.google.com`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), env);
    expect(result.status).toBe(403);
    const text = await result.text();
    expect(text).toContain("google");
  });

  it("GET /?url=http://example.com not allowed content type", async () => {
    const env = getMiniflareBindings();
    env.CONTENT_TYPE_ALLOWLIST = `["application/pdf"]`;
    const url = `http://localhost?url=http://example.com`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), env);
    expect(result.status).toBe(403);
    const text = await result.text();
    expect(text).toContain("text/html");
  });

  it("GET /?url=http://example.com allowed content type", async () => {
    const env = getMiniflareBindings();
    env.CONTENT_TYPE_ALLOWLIST = `["text/html"]`;
    const url = `http://localhost?url=http://example.com`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), env);
    expect(result.status).toBe(200);
  });

  it("GET /?url=http://example.com/test?query=true allowed path", async () => {
    const env = getMiniflareBindings();
    env.PATH_ALLOWLIST = `["\/test$"]`;
    const url = `http://localhost?url=http://example.com/test?query=true`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), env);
    expect(result.status).not.toBe(403);
  });

  it("GET /?url=http://example.com/failure?query=true allowed path not allowed", async () => {
    const env = getMiniflareBindings();
    env.ENDPOINT_ALLOWLIST = "[]";
    env.PATH_ALLOWLIST = `["\/test$"]`;
    const url = `http://localhost?url=http://example.com/failure?query=true`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), env);
    expect(result.status).toBe(403);
    const text = await result.text();
    expect(text).toContain("failure");
  });

  it("GET /?url=http://example.com/ignore?query=true allowed endpoint ignores path", async () => {
    const env = getMiniflareBindings();
    env.ENDPOINT_ALLOWLIST = `["example.com"]`;
    env.PATH_ALLOWLIST = `["\/test$"]`;
    const url = `http://localhost?url=http://example.com/ignore?query=true`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), env);
    expect(result.status).not.toBe(403);
  });

  it("GET /?url=http://example.com/api/v3/list allowed path with prefix", async () => {
    const env = getMiniflareBindings();
    env.ENDPOINT_ALLOWLIST = `["example.com"]`;
    env.PATH_ALLOWLIST = `["^\/api\/v3"]`;
    const url = `http://localhost?url=http://example.com/api/v3/list`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), env);
    expect(result.status).not.toBe(403);
  });
});
