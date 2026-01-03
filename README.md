# Text Utilities MCP Bundle

A powerful MCP Bundle (MCPB) providing text manipulation tools for AI assistants like Claude.

## Features

This bundle provides 6 text manipulation tools:

| Tool | Description |
|------|-------------|
| `reverse_text` | Reverses the order of characters in text |
| `uppercase_text` | Converts text to UPPERCASE |
| `lowercase_text` | Converts text to lowercase |
| `word_count` | Counts words in text |
| `character_count` | Counts characters (with and without spaces) |
| `shuffle_text` | Randomly shuffles characters using Fisher-Yates algorithm |

## Installation

### Option 1: Install as MCPB Bundle (Recommended)

1. Download or pack the bundle:
   ```bash
   npx @anthropic-ai/mcpb pack
   ```

2. Open the generated `.mcpb` file with Claude for Desktop to install.

### Option 2: Manual Configuration

Add to your Claude Desktop config (`~/.config/claude/claude_desktop_config.json` on Linux/macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "text-utilities": {
      "command": "node",
      "args": ["/path/to/mcphub-example-deploy/server/index.js"]
    }
  }
}
```

## Development

### Prerequisites

- Node.js >= 16.0.0
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Validate the manifest
npm run validate

# Pack the bundle
npm run pack
```

### Testing

```bash
# Run the server directly (for testing)
npm start

# Run with HTTP/SSE transport (for cloud deployment)
npm run start:http
```

### Project Structure

```
mcphub-example-deploy/
├── manifest.json        # MCPB manifest (required)
├── package.json         # Node.js dependencies
├── server/
│   └── index.js         # MCP server (stdio transport)
├── server-http.js       # Alternative HTTP/SSE server
├── node_modules/        # Bundled dependencies
├── .mcpbignore          # Files to exclude from bundle
└── README.md            # This file
```

## API Reference

### Tool Responses

All tools return JSON-structured responses:

```json
{
  "success": true,
  "tool": "tool_name",
  "input_length": 123,
  "result": "processed text or value"
}
```

### Error Handling

Errors are returned with structured information:

```json
{
  "success": false,
  "tool": "tool_name",
  "error": "Error description"
}
```

### Security Features

- **Input validation**: Maximum 1MB text input
- **Timeout protection**: 30-second tool execution limit
- **Graceful shutdown**: SIGINT/SIGTERM handling
- **Error isolation**: Errors don't crash the server

## Example Usage

Once installed, you can ask Claude:

- "Reverse this text: Hello World"
- "How many words are in this paragraph?"
- "Shuffle the letters in 'abcdefg'"
- "Convert 'HELLO' to lowercase"

## Compatibility

- **Claude Desktop**: >= 0.10.0
- **Platforms**: macOS (darwin), Windows (win32), Linux
- **Node.js**: >= 16.0.0

## License

MIT License - See [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
