import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TelaClient } from "../client.js";
import { getPage } from "../tools/get-page.js";

// `tela://page/{id}` matches the wikilink scheme Tela writes into markdown
// (`[Title](tela://page/{id})`) so resource @-mentions round-trip with links
// the agent reads inside page bodies. `list: undefined` skips eager
// enumeration — spaces can hold thousands of pages and Claude Code uses
// completion, not list, for resource discovery.

export function registerPageResource(server: McpServer, client: TelaClient): void {
  server.registerResource(
    "page",
    new ResourceTemplate("tela://page/{id}", { list: undefined }),
    {
      title: "Tela page",
      description: "A page in a Tela space, addressable by numeric id.",
      mimeType: "text/markdown",
    },
    async (uri, params) => {
      const raw = params.id;
      const idStr = Array.isArray(raw) ? raw[0] : raw;
      const id = Number(idStr);
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error(`invalid page id: ${idStr}`);
      }
      const page = await getPage(client, { id });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: `# ${page.title}\n\n${page.body}`,
          },
        ],
      };
    },
  );
}
