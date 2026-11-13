# Configuração do MCP Server para Evolution API no n8n

Este documento fornece instruções para configurar o MCP Server da Evolution API para uso com o n8n.

## Configuração via STDIO (Command Line)

1. No n8n, adicione um nó "MCP Client (STDIO)".
2. Configure os campos conforme abaixo:

### Para Windows:

**Command:**
```
powershell
```

**Arguments:**
```
/c cd C:\caminho\completo\para\mcp-evolution-api && node dist/index.js
```

**Environments:**
```
EVOLUTION_API_URL=https://seu-servidor-evolution-api.com
EVOLUTION_API_KEY=sua-chave-api
EVOLUTION_API_INSTANCE=sua-instancia
```

### Para Linux/Mac:

**Command:**
```
bash
```

**Arguments:**
```
-c "cd /caminho/completo/para/mcp-evolution-api && node dist/index.js"
```

**Environments:**
```
EVOLUTION_API_URL=https://seu-servidor-evolution-api.com
EVOLUTION_API_KEY=sua-chave-api
EVOLUTION_API_INSTANCE=sua-instancia
```

## Configuração via HTTP (recomendado para Docker/servidor remoto)

1. Primeiro, inicie o servidor MCP com o servidor HTTP habilitado:
```bash
cd /caminho/para/mcp-evolution-api
export ENABLE_WEBSOCKET=true
export PORT=3000
npm start
```

2. No n8n, adicione um nó "MCP Client Tool".
3. Escolha o transporte e a URL correspondente:

| Transporte no n8n | URL |
|-------------------|-----|
| HTTP Streamable (recomendado) | `https://seu-servidor/mcp` |
| Server Sent Events | `https://seu-servidor/sse` |

Em uma rede Docker local, use `http://nome-do-container:3000/mcp`.

## Solução de problemas

### Erro de conexão fechada

Se você encontrar o erro "Connection closed", verifique:

1. O servidor MCP está em execução?
2. Você configurou corretamente o caminho no n8n?
3. As variáveis de ambiente estão corretas?
4. Tente o método HTTP se o STDIO falhar

### Problemas com Docker

Se estiver executando o n8n em Docker, certifique-se de:

1. Usar o método HTTP em vez de STDIO
2. Configurar as redes Docker para que o contêiner n8n possa acessar o servidor MCP

### Testando a conexão

Você pode testar a conexão listando as ferramentas disponíveis. Após configurar, clique em "List Available Tools" no nó MCP Client. 