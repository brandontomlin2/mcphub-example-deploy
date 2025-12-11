import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Create the MCP server instance
const server = new Server(
  {
    name: "text-utilities-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define multiple text utility tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "reverse_text",
        description: "Reverses the order of characters in the given text",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "The text to reverse",
            },
          },
          required: ["text"],
        },
      },
      {
        name: "uppercase_text",
        description: "Converts text to uppercase",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "The text to convert to uppercase",
            },
          },
          required: ["text"],
        },
      },
      {
        name: "lowercase_text",
        description: "Converts text to lowercase",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "The text to convert to lowercase",
            },
          },
          required: ["text"],
        },
      },
      {
        name: "word_count",
        description: "Counts the number of words in the given text",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "The text to count words in",
            },
          },
          required: ["text"],
        },
      },
      {
        name: "character_count",
        description: "Counts the number of characters (including spaces) in the given text",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "The text to count characters in",
            },
          },
          required: ["text"],
        },
      },
      {
        name: "shuffle_text",
        description: "Randomly shuffles the characters in the given text",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "The text to shuffle",
            },
          },
          required: ["text"],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "reverse_text": {
      const text = args?.text || "";
      const reversed = text.split("").reverse().join("");
      return {
        content: [
          {
            type: "text",
            text: `Reversed text: ${reversed}`,
          },
        ],
      };
    }

    case "uppercase_text": {
      const text = args?.text || "";
      const uppercased = text.toUpperCase();
      return {
        content: [
          {
            type: "text",
            text: `Uppercase: ${uppercased}`,
          },
        ],
      };
    }

    case "lowercase_text": {
      const text = args?.text || "";
      const lowercased = text.toLowerCase();
      return {
        content: [
          {
            type: "text",
            text: `Lowercase: ${lowercased}`,
          },
        ],
      };
    }

    case "word_count": {
      const text = args?.text || "";
      const words = text.trim().split(/\s+/).filter(word => word.length > 0);
      const count = words.length;
      return {
        content: [
          {
            type: "text",
            text: `Word count: ${count} word${count !== 1 ? 's' : ''}`,
          },
        ],
      };
    }

    case "character_count": {
      const text = args?.text || "";
      const count = text.length;
      return {
        content: [
          {
            type: "text",
            text: `Character count: ${count} character${count !== 1 ? 's' : ''}`,
          },
        ],
      };
    }

    case "shuffle_text": {
      const text = args?.text || "";
      const chars = text.split("");
      // Fisher-Yates shuffle
      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      const shuffled = chars.join("");
      return {
        content: [
          {
            type: "text",
            text: `Shuffled text: ${shuffled}`,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Create an Express HTTP server
const app = express();
const PORT = process.env.PORT || 8081;

app.use(express.json());

const activeTransports = new Map();

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    name: "text-utilities-mcp",
    version: "1.0.0",
    tools: ["reverse_text", "uppercase_text", "lowercase_text", "word_count", "character_count", "shuffle_text"],
    activeSessions: activeTransports.size
  });
});

// SSE endpoint
app.get("/sse", async (req, res) => {
  console.log("New SSE connection established");

  // Use MESSAGE_ENDPOINT env var to support path-based routing through Cloudflare Worker
  const messageEndpoint = process.env.MESSAGE_ENDPOINT || "/message";
  const transport = new SSEServerTransport(messageEndpoint, res);
  const sessionId = transport.sessionId;
  console.log(`Session created: ${sessionId}`);

  activeTransports.set(sessionId, transport);

  const cleanup = () => {
    activeTransports.delete(sessionId);
    console.log(`Session closed: ${sessionId}`);
  };

  res.on("close", cleanup);
  transport.onclose = cleanup;

  await server.connect(transport);
});

// Message endpoint
app.post("/message", async (req, res) => {
  const sessionId = req.query.sessionId;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId query parameter required" });
  }

  const transport = activeTransports.get(sessionId);

  if (!transport) {
    return res.status(400).json({ error: "No active session found" });
  }

  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error("Error handling message:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Start the HTTP server
app.listen(PORT, () => {
  console.log(`Text Utilities MCP running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Available tools: reverse_text, uppercase_text, lowercase_text, word_count, character_count, shuffle_text`);
});
