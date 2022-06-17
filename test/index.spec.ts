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
      expect(text).toContain("CLOUDFLARE");
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
    expect(text).toContain("CLOUDFLARE");
  });

  it("GET /?url=http://example.com", async () => {
    const env = getMiniflareBindings();
    env.ENDPOINT_ALLOWLIST = `["example.com"]`;
    const url = `http://localhost?url=http://example.com`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), env);
    expect(result.status).toBe(200);
  });

  it("GET /?url=https://google.com not allowed endpoint", async () => {
    const env = getMiniflareBindings();
    const url = `http://localhost?url=https://www.google.com`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), env);
    expect(result.status).toBe(403);
  });
});
