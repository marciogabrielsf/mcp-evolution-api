import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage, JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebSocket } from "ws";

/**
 * Transporte MCP para uma única conexão WebSocket do lado do servidor.
 * O SDK oficial só fornece o transporte WebSocket de cliente.
 */
export class WebSocketServerTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  private started = false;

  constructor(private readonly socket: WebSocket) {}

  async start(): Promise<void> {
    if (this.started) {
      throw new Error("WebSocketServerTransport já foi iniciado");
    }
    this.started = true;

    this.socket.on("message", (data) => {
      let message: JSONRPCMessage;
      try {
        message = JSONRPCMessageSchema.parse(JSON.parse(data.toString()));
      } catch (error) {
        this.onerror?.(error as Error);
        return;
      }
      this.onmessage?.(message);
    });
    this.socket.on("error", (error) => this.onerror?.(error));
    this.socket.on("close", () => this.onclose?.());
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket não está conectado");
    }
    await new Promise<void>((resolve, reject) => {
      this.socket.send(JSON.stringify(message), (error) => (error ? reject(error) : resolve()));
    });
  }

  async close(): Promise<void> {
    this.socket.close();
  }
}
