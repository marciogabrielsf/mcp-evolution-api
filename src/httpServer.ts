import * as http from "http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { WebSocketServer } from "ws";
import { WebSocketServerTransport } from "./transports/websocketServerTransport.js";

type ServerFactory = () => McpServer;

const SSE_KEEP_ALIVE_MS = 15000;

function sendJsonRpcError(res: http.ServerResponse, status: number, message: string, headers: http.OutgoingHttpHeaders = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }));
}

/**
 * Sobe um servidor HTTP com as rotas MCP:
 * - POST /mcp       → Streamable HTTP (padrão atual do MCP, modo stateless)
 * - GET  /sse       → SSE legado (cliente envia mensagens para POST /messages)
 * - WebSocket       → upgrade em qualquer caminho
 * - GET  / e /health → healthcheck
 */
export async function startMcpHttpServer(port: number, createServer: ServerFactory) {
  const sseTransports = new Map<string, SSEServerTransport>();

  async function handleStreamableHttp(req: http.IncomingMessage, res: http.ServerResponse) {
    // Modo stateless: não há sessão para abrir stream via GET nem para encerrar via DELETE
    if (req.method !== "POST") {
      sendJsonRpcError(res, 405, "Método não permitido. Use POST.", { Allow: "POST" });
      return;
    }

    // Transporte stateless não pode ser reutilizado: um servidor + transporte por requisição
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  }

  async function handleSse(res: http.ServerResponse) {
    const server = createServer();
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    sseTransports.set(sessionId, transport);

    const keepAlive = setInterval(() => res.write(": keepalive\n\n"), SSE_KEEP_ALIVE_MS);
    res.on("close", () => {
      clearInterval(keepAlive);
      sseTransports.delete(sessionId);
      server.close();
    });

    await server.connect(transport);
  }

  async function handleSseMessage(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
    const transport = sseTransports.get(url.searchParams.get("sessionId") ?? "");
    if (!transport) {
      sendJsonRpcError(res, 404, "Sessão SSE não encontrada.");
      return;
    }
    await transport.handlePostMessage(req, res);
  }

  async function route(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/mcp") {
      return handleStreamableHttp(req, res);
    }
    if (url.pathname === "/sse" && req.method === "GET") {
      return handleSse(res);
    }
    if (url.pathname === "/messages" && req.method === "POST") {
      return handleSseMessage(req, res, url);
    }
    if (url.pathname === "/" || url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("MCP Evolution API: use POST /mcp (Streamable HTTP), GET /sse (SSE) ou WebSocket.");
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Rota não encontrada.");
  }

  const httpServer = http.createServer((req, res) => {
    route(req, res).catch((error) => {
      console.error("Erro ao processar requisição MCP:", error);
      if (!res.headersSent) {
        sendJsonRpcError(res, 500, "Erro interno do servidor.");
      } else {
        res.end();
      }
    });
  });

  const wss = new WebSocketServer({ server: httpServer });
  wss.on("connection", (socket) => {
    const server = createServer();
    const transport = new WebSocketServerTransport(socket);
    server.connect(transport).catch((error) => {
      console.error("Erro ao conectar cliente WebSocket:", error);
      socket.close();
    });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, () => {
      httpServer.off("error", reject);
      resolve();
    });
  });

  return { httpServer, wss };
}
