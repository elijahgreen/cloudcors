import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import worker from "../src/index";

describe("handler returns response with request method", () => {
  const methods = ["GET", "HEAD", "POST", "OPTIONS"];
  methods.forEach((method) => {
    it(method, async () => {
      const ctx = createExecutionContext();
      const result = await worker.fetch(
        new Request("http://localhost/", { method }),
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);
      const text = await result.text();
      expect(text).toContain("CLOUDCORS");
    });
  });
});

describe("general methods", () => {
  it("GET /", async () => {
    const ctx = createExecutionContext();
    const result = await worker.fetch(
      new Request("http://localhost", { method: "GET" }),
      env,
      ctx
    );
    await waitOnExecutionContext(ctx);
    const text = await result.text();
    expect(text).toContain("CLOUDCORS");
  });

  it("GET /?url=http://example.com", async () => {
    const testEnv = { ...env, ENDPOINT_ALLOWLIST: `["example.com"]`, CONTENT_TYPE_ALLOWLIST: "" };
    const ctx = createExecutionContext();
    const url = `http://localhost?url=http://example.com`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(result.status).toBe(200);
  });

  it("GET /http://example.com", async () => {
    const testEnv = { ...env, ENDPOINT_ALLOWLIST: `["example.com"]`, CONTENT_TYPE_ALLOWLIST: "" };
    const ctx = createExecutionContext();
    const url = `http://localhost/http://example.com`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(result.status).toBe(200);
  });

  it("GET /?url=https://google.com not allowed endpoint", async () => {
    const ctx = createExecutionContext();
    const url = `http://localhost?url=https://www.google.com`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(result.status).toBe(403);
    const text = await result.text();
    expect(text).toContain("google");
  });

  it("GET /?url=http://example.com not allowed content type", async () => {
    const testEnv = { ...env, ENDPOINT_ALLOWLIST: `["example.com"]`, CONTENT_TYPE_ALLOWLIST: `["application/pdf"]` };
    const ctx = createExecutionContext();
    const url = `http://localhost?url=http://example.com`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(result.status).toBe(403);
    const text = await result.text();
    expect(text).toContain("text/html");
  });

  it("GET /?url=http://example.com allowed content type", async () => {
    const testEnv = { ...env, ENDPOINT_ALLOWLIST: `["example.com"]`, CONTENT_TYPE_ALLOWLIST: `["text/html"]` };
    const ctx = createExecutionContext();
    const url = `http://localhost?url=http://example.com`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(result.status).toBe(200);
  });

  it("GET /?url=http://example.com/test?query=true allowed path", async () => {
    const testEnv = { ...env, PATH_ALLOWLIST: `["\\/test$"]` };
    const ctx = createExecutionContext();
    const url = `http://localhost?url=http://example.com/test?query=true`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(result.status).not.toBe(403);
  });

  it("GET /?url=http://example.com/failure?query=true allowed path not allowed", async () => {
    const testEnv = { ...env, ENDPOINT_ALLOWLIST: "[]", PATH_ALLOWLIST: `["\\/test$"]` };
    const ctx = createExecutionContext();
    const url = `http://localhost?url=http://example.com/failure?query=true`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(result.status).toBe(403);
    const text = await result.text();
    expect(text).toContain("failure");
  });

  it("GET /?url=http://example.com/ignore?query=true allowed endpoint ignores path", async () => {
    const testEnv = { ...env, ENDPOINT_ALLOWLIST: `["example.com"]`, PATH_ALLOWLIST: `["\\/test$"]` };
    const ctx = createExecutionContext();
    const url = `http://localhost?url=http://example.com/ignore?query=true`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(result.status).not.toBe(403);
  });

  it("GET /?url=http://example.com/api/v3/list allowed path with prefix", async () => {
    const testEnv = { ...env, ENDPOINT_ALLOWLIST: `["example.com"]`, PATH_ALLOWLIST: `["^\\/api\\/v3"]` };
    const ctx = createExecutionContext();
    const url = `http://localhost?url=http://example.com/api/v3/list`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(result.status).not.toBe(403);
  });

  it("GET /?url= with an unparseable url", async () => {
    const ctx = createExecutionContext();
    const url = `http://localhost?url=${encodeURIComponent("https://exa mple.com:99999")}`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(result.status).toBe(400);
  });

  it("GET /?url= blocks non-http protocols", async () => {
    const testEnv = { ...env, ENDPOINT_ALLOWLIST: "", PATH_ALLOWLIST: "" };
    const ctx = createExecutionContext();
    const url = `http://localhost?url=${encodeURIComponent("ftp://example.com/x")}`;
    const result = await worker.fetch(new Request(url, { method: "GET" }), testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(result.status).toBe(403);
    expect(await result.text()).toContain("ftp:");
  });
});

describe("redirects", () => {
  const redirectTo = (target: string) =>
    `http://localhost?url=${encodeURIComponent(
      `https://httpbin.org/redirect-to?url=${encodeURIComponent(target)}`
    )}`;

  it("blocks a redirect to a host off the allowlist", async () => {
    const testEnv = { ...env, ENDPOINT_ALLOWLIST: `["httpbin.org"]`, CONTENT_TYPE_ALLOWLIST: "" };
    const ctx = createExecutionContext();
    const result = await worker.fetch(
      new Request(redirectTo("https://example.com/"), { method: "GET" }),
      testEnv,
      ctx
    );
    await waitOnExecutionContext(ctx);
    expect(result.status).toBe(403);
    expect(await result.text()).toBe("Redirect blocked. Forbidden Endpoint: example.com");
  });

  it("follows a redirect to an allowed host", async () => {
    const testEnv = {
      ...env,
      ENDPOINT_ALLOWLIST: `["httpbin.org", "example.com"]`,
      CONTENT_TYPE_ALLOWLIST: "",
    };
    const ctx = createExecutionContext();
    const result = await worker.fetch(
      new Request(redirectTo("https://example.com/"), { method: "GET" }),
      testEnv,
      ctx
    );
    await waitOnExecutionContext(ctx);
    expect(result.status).toBe(200);
    expect(await result.text()).toContain("Example Domain");
  });
});

describe("request headers", () => {
  const echo = (extra = "") =>
    `http://localhost?url=${encodeURIComponent("https://httpbin.org/headers")}${extra}`;
  const testEnv = { ...env, ENDPOINT_ALLOWLIST: `["httpbin.org"]`, CONTENT_TYPE_ALLOWLIST: "" };

  it("sends a default User-Agent", async () => {
    const ctx = createExecutionContext();
    const result = await worker.fetch(new Request(echo()), testEnv, ctx);
    await waitOnExecutionContext(ctx);
    const body = (await result.json()) as { headers: Record<string, string> };
    expect(body.headers["User-Agent"]).toBe("cloudcors");
  });

  it("keeps a User-Agent passed in setRequestHeaders", async () => {
    const ctx = createExecutionContext();
    const headers = encodeURIComponent(JSON.stringify({ "User-Agent": "custom" }));
    const result = await worker.fetch(
      new Request(echo(`&setRequestHeaders=${headers}`)),
      testEnv,
      ctx
    );
    await waitOnExecutionContext(ctx);
    const body = (await result.json()) as { headers: Record<string, string> };
    expect(body.headers["User-Agent"]).toBe("custom");
  });
});
