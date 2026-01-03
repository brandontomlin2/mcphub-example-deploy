#!/usr/bin/env node
/**
 * Text Utilities MCP Server
 * 
 * A local MCP server providing text manipulation tools.
 * Uses stdio transport for MCPB bundle compatibility.
 * 
 * Tools provided:
 * - reverse_text: Reverse character order
 * - uppercase_text: Convert to uppercase
 * - lowercase_text: Convert to lowercase
 * - word_count: Count words
 * - character_count: Count characters
 * - shuffle_text: Randomly shuffle characters
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Server configuration
const SERVER_NAME = "text-utilities-mcp";
const SERVER_VERSION = "1.0.0";

// Tool timeout in milliseconds (30 seconds default)
const TOOL_TIMEOUT_MS = 30000;

// Maximum input length to prevent memory issues
const MAX_INPUT_LENGTH = 1000000; // 1MB of text

/**
 * Validate input text for security and performance
 */
function validateInput(text, toolName) {
  if (typeof text !== "string") {
    throw new Error(`Invalid input type for ${toolName}: expected string, got ${typeof text}`);
  }
  
  if (text.length > MAX_INPUT_LENGTH) {
    throw new Error(
      `Input too large for ${toolName}: ${text.length} characters exceeds maximum of ${MAX_INPUT_LENGTH}`
    );
  }
  
  return text;
}

/**
 * Create a timeout wrapper for tool execution
 */
function withTimeout(promise, timeoutMs, toolName) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Tool ${toolName} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Fisher-Yates shuffle algorithm for randomizing text
 */
function fisherYatesShuffle(text) {
  const chars = text.split("");
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/**
 * Tool implementations
 */
const toolHandlers = {
  reverse_text: (text) => {
    const reversed = text.split("").reverse().join("");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            tool: "reverse_text",
            input_length: text.length,
            result: reversed,
          }),
        },
      ],
    };
  },

  uppercase_text: (text) => {
    const uppercased = text.toUpperCase();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            tool: "uppercase_text",
            input_length: text.length,
            result: uppercased,
          }),
        },
      ],
    };
  },

  lowercase_text: (text) => {
    const lowercased = text.toLowerCase();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            tool: "lowercase_text",
            input_length: text.length,
            result: lowercased,
          }),
        },
      ],
    };
  },

  word_count: (text) => {
    const words = text.trim().split(/\s+/).filter((word) => word.length > 0);
    const count = words.length;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            tool: "word_count",
            input_length: text.length,
            word_count: count,
            result: `${count} word${count !== 1 ? "s" : ""}`,
          }),
        },
      ],
    };
  },

  character_count: (text) => {
    const total = text.length;
    const withoutSpaces = text.replace(/\s/g, "").length;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            tool: "character_count",
            total_characters: total,
            characters_without_spaces: withoutSpaces,
            result: `${total} total character${total !== 1 ? "s" : ""} (${withoutSpaces} without spaces)`,
          }),
        },
      ],
    };
  },

  shuffle_text: (text) => {
    const shuffled = fisherYatesShuffle(text);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            tool: "shuffle_text",
            input_length: text.length,
            result: shuffled,
          }),
        },
      ],
    };
  },
};

/**
 * Tool definitions for MCP protocol
 */
const toolDefinitions = [
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
    description:
      "Counts the number of characters (including spaces) in the given text",
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
    description: "Randomly shuffles the characters in the given text using Fisher-Yates algorithm",
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
];

// Create the MCP server instance
const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: toolDefinitions };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Log tool invocation for debugging (to stderr, not stdout which is for MCP protocol)
  console.error(`[${new Date().toISOString()}] Tool invoked: ${name}`);

  // Validate tool exists
  if (!toolHandlers[name]) {
    const error = `Unknown tool: ${name}. Available tools: ${Object.keys(toolHandlers).join(", ")}`;
    console.error(`[${new Date().toISOString()}] Error: ${error}`);
    throw new Error(error);
  }

  try {
    // Validate and extract input
    const text = validateInput(args?.text || "", name);

    // Execute tool with timeout
    const result = await withTimeout(
      Promise.resolve(toolHandlers[name](text)),
      TOOL_TIMEOUT_MS,
      name
    );

    console.error(`[${new Date().toISOString()}] Tool ${name} completed successfully`);
    return result;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Tool ${name} failed: ${error.message}`);
    
    // Return structured error response
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            tool: name,
            error: error.message,
          }),
        },
      ],
      isError: true,
    };
  }
});

// Graceful shutdown handler
function shutdown() {
  console.error(`[${new Date().toISOString()}] Shutting down ${SERVER_NAME}...`);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error(`[${new Date().toISOString()}] Uncaught exception: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(`[${new Date().toISOString()}] Unhandled rejection at:`, promise);
  console.error("Reason:", reason);
});

// Start the server with stdio transport
async function main() {
  console.error(`[${new Date().toISOString()}] Starting ${SERVER_NAME} v${SERVER_VERSION}...`);
  console.error(`[${new Date().toISOString()}] Available tools: ${toolDefinitions.map((t) => t.name).join(", ")}`);
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error(`[${new Date().toISOString()}] ${SERVER_NAME} is running on stdio transport`);
}

main().catch((error) => {
  console.error(`[${new Date().toISOString()}] Fatal error starting server: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
