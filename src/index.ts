import { handleRequest } from "./handler";

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    return handleRequest(request, env);
  },
};
