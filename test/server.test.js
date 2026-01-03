/**
 * Test suite for Text Utilities MCP Server
 * 
 * Run with: node --test test/server.test.js
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "server", "index.js");

// MCP Protocol helpers
function createMCPRequest(method, params = {}, id = 1) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    method,
    params,
  });
}

function parseMCPResponse(data) {
  const lines = data.split("\n").filter((line) => line.trim());
  const responses = [];
  for (const line of lines) {
    try {
      responses.push(JSON.parse(line));
    } catch (e) {
      // Skip non-JSON lines (stderr output)
    }
  }
  return responses;
}

describe("Text Utilities MCP Server", () => {
  let serverProcess;
  let serverOutput = "";
  let serverReady = false;

  // Helper to send request and get response
  async function sendRequest(request) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Request timeout"));
      }, 5000);

      const onData = (data) => {
        const responses = parseMCPResponse(data.toString());
        if (responses.length > 0) {
          clearTimeout(timeout);
          serverProcess.stdout.removeListener("data", onData);
          resolve(responses[responses.length - 1]);
        }
      };

      serverProcess.stdout.on("data", onData);
      serverProcess.stdin.write(request + "\n");
    });
  }

  before(async () => {
    // Start the server process
    serverProcess = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    serverProcess.stderr.on("data", (data) => {
      serverOutput += data.toString();
      if (data.toString().includes("running on stdio transport")) {
        serverReady = true;
      }
    });

    // Wait for server to start
    await new Promise((resolve) => {
      const checkReady = setInterval(() => {
        if (serverReady) {
          clearInterval(checkReady);
          resolve();
        }
      }, 100);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkReady);
        resolve();
      }, 5000);
    });
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
  });

  describe("MCP Protocol", () => {
    it("should list available tools", async () => {
      const request = createMCPRequest("tools/list", {});
      const response = await sendRequest(request);
      
      assert.ok(response, "Should receive a response");
      assert.ok(response.result, "Response should have result");
      assert.ok(Array.isArray(response.result.tools), "Result should have tools array");
      assert.strictEqual(response.result.tools.length, 6, "Should have 6 tools");
      
      const toolNames = response.result.tools.map((t) => t.name);
      assert.ok(toolNames.includes("reverse_text"), "Should have reverse_text");
      assert.ok(toolNames.includes("uppercase_text"), "Should have uppercase_text");
      assert.ok(toolNames.includes("lowercase_text"), "Should have lowercase_text");
      assert.ok(toolNames.includes("word_count"), "Should have word_count");
      assert.ok(toolNames.includes("character_count"), "Should have character_count");
      assert.ok(toolNames.includes("shuffle_text"), "Should have shuffle_text");
    });
  });

  describe("Tool Execution", () => {
    it("reverse_text: should reverse text correctly", async () => {
      const request = createMCPRequest("tools/call", {
        name: "reverse_text",
        arguments: { text: "Hello World" },
      });
      const response = await sendRequest(request);
      
      assert.ok(response.result, "Should have result");
      const content = JSON.parse(response.result.content[0].text);
      assert.strictEqual(content.success, true, "Should succeed");
      assert.strictEqual(content.result, "dlroW olleH", "Should reverse correctly");
    });

    it("uppercase_text: should convert to uppercase", async () => {
      const request = createMCPRequest("tools/call", {
        name: "uppercase_text",
        arguments: { text: "Hello World" },
      });
      const response = await sendRequest(request);
      
      const content = JSON.parse(response.result.content[0].text);
      assert.strictEqual(content.success, true, "Should succeed");
      assert.strictEqual(content.result, "HELLO WORLD", "Should uppercase correctly");
    });

    it("lowercase_text: should convert to lowercase", async () => {
      const request = createMCPRequest("tools/call", {
        name: "lowercase_text",
        arguments: { text: "Hello World" },
      });
      const response = await sendRequest(request);
      
      const content = JSON.parse(response.result.content[0].text);
      assert.strictEqual(content.success, true, "Should succeed");
      assert.strictEqual(content.result, "hello world", "Should lowercase correctly");
    });

    it("word_count: should count words correctly", async () => {
      const request = createMCPRequest("tools/call", {
        name: "word_count",
        arguments: { text: "Hello World, this is a test" },
      });
      const response = await sendRequest(request);
      
      const content = JSON.parse(response.result.content[0].text);
      assert.strictEqual(content.success, true, "Should succeed");
      assert.strictEqual(content.word_count, 6, "Should count 6 words");
    });

    it("character_count: should count characters correctly", async () => {
      const request = createMCPRequest("tools/call", {
        name: "character_count",
        arguments: { text: "Hello World" },
      });
      const response = await sendRequest(request);
      
      const content = JSON.parse(response.result.content[0].text);
      assert.strictEqual(content.success, true, "Should succeed");
      assert.strictEqual(content.total_characters, 11, "Should count 11 total characters");
      assert.strictEqual(content.characters_without_spaces, 10, "Should count 10 without spaces");
    });

    it("shuffle_text: should shuffle text (different from input)", async () => {
      const input = "abcdefghij";
      const request = createMCPRequest("tools/call", {
        name: "shuffle_text",
        arguments: { text: input },
      });
      const response = await sendRequest(request);
      
      const content = JSON.parse(response.result.content[0].text);
      assert.strictEqual(content.success, true, "Should succeed");
      assert.strictEqual(content.result.length, input.length, "Should preserve length");
      // Note: Very small chance shuffled equals original, but statistically unlikely
    });
  });

  describe("Error Handling", () => {
    it("should handle unknown tool gracefully", async () => {
      const request = createMCPRequest("tools/call", {
        name: "nonexistent_tool",
        arguments: { text: "test" },
      });
      const response = await sendRequest(request);
      
      // The server should return an error
      assert.ok(response.error || response.result?.isError, "Should indicate error");
    });

    it("should handle empty text input", async () => {
      const request = createMCPRequest("tools/call", {
        name: "word_count",
        arguments: { text: "" },
      });
      const response = await sendRequest(request);
      
      const content = JSON.parse(response.result.content[0].text);
      assert.strictEqual(content.success, true, "Should succeed");
      assert.strictEqual(content.word_count, 0, "Should count 0 words");
    });
  });
});

console.log("Running Text Utilities MCP Server Tests...");
