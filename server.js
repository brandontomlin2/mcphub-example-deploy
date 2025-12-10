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
    name: "hello-world-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define our single tool - a simple hello world function
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "say_hello",
        description: "Returns a Hello World message from Fly.io",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "say_hello") {
    return {
      content: [
        {
          type: "text",
          text: "Hello World from Fly.io! 🚀",
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
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
    name: "hello-world-mcp",
    activeSessions: activeTransports.size
  });
});

// SSE endpoint
app.get("/sse", async (req, res) => {
  console.log("New SSE connection established");

  const transport = new SSEServerTransport("/message", res);
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
  console.log(`Hello World MCP running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});
