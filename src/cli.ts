#!/usr/bin/env node

import { startServer, startHttpServer } from './index.js';
import { config } from './config.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Exibe informações sobre o MCP Server (stderr, para não poluir o canal STDIO do MCP)
console.error(`
╔════════════════════════════════════════════════════╗
║            MCP SERVER PARA EVOLUTION API           ║
╠════════════════════════════════════════════════════╣
║ Versão: ${config.mcp.version}                             ║
║ Instância: ${config.evolutionApi.instanceId}        ║
╚════════════════════════════════════════════════════╝
`);

// Inicia os servidores
// ENABLE_WEBSOCKET habilita o servidor HTTP (rotas /mcp, /sse e WebSocket)
const enableHttp = process.env.ENABLE_WEBSOCKET === 'true';

async function init() {
  try {
    // Sempre inicia o servidor STDIO
    await startServer();
    
    if (enableHttp) {
      const port = process.env.PORT || 3000;
      await startHttpServer(Number(port));
    }
  } catch (error) {
    console.error('Erro ao iniciar servidores MCP:', error);
    process.exit(1);
  }
}

init(); 