import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "./config.js";
import { EvolutionApiService } from "./services/evolutionApiService.js";
import { describeMessage, formatTimestamp } from "./messageFormat.js";
import { startMcpHttpServer } from "./httpServer.js";
import "dotenv/config";

// Inicializa o serviço da Evolution API
const evolutionService = new EvolutionApiService();

// Converte número em JID de usuário; JIDs (com "@") são mantidos
function toJid(value: string): string {
  return value.includes("@") ? value : `${value.replace(/\D/g, "")}@s.whatsapp.net`;
}

const RECIPIENT_DESCRIPTION =
  "Destinatário: número no formato internacional (ex: 5511999999999) ou o remoteJid da conversa retornado por listChats (ex: ...@s.whatsapp.net, ...@lid ou ...@g.us)";

const REMOTE_JID_DESCRIPTION =
  "Conversa: use o remoteJid retornado por listChats (ex: 5511999999999@s.whatsapp.net, ...@lid ou 1203...@g.us)";

// Cria um servidor MCP com todas as ferramentas e recursos registrados.
// O McpServer só mantém um transporte ativo por vez, então cada transporte
// (STDIO ou conexão WebSocket) precisa da sua própria instância.
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: config.mcp.name,
    version: config.mcp.version
  });

  // ===== FERRAMENTAS PARA INFORMAÇÕES GERAIS =====

  // Adiciona ferramenta para verificar o status da API
  server.tool("getApiStatus",
    "Verifica se a Evolution API está online e retorna a versão.",
    {},
    async () => {
      try {
        const apiInfo = await evolutionService.getApiInfo();
        return {
          content: [{ 
            type: "text", 
            text: `Evolution API v${apiInfo.version} está rodando. Status: ${apiInfo.status}` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao conectar à Evolution API: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // ===== FERRAMENTAS PARA GESTÃO DE INSTÂNCIAS =====

  // Adiciona ferramenta para verificar status da instância
  server.tool("getInstanceStatus",
    "Retorna o status de conexão da instância do WhatsApp (open = conectada).",
    {},
    async () => {
      try {
        const status = await evolutionService.getInstanceStatus();
        return {
          content: [{ 
            type: "text", 
            text: `Status da instância: ${status.instance?.state || "Desconhecido"}` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao verificar status da instância: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para definir presença
  server.tool("setPresence",
    "Define a presença global da instância do WhatsApp (online, offline etc.).",
    { 
      presence: z.enum(["available", "unavailable", "composing", "recording", "paused"])
        .describe("Status de presença para definir")
    },
    async ({ presence }) => {
      try {
        await evolutionService.setPresence(presence);
        return {
          content: [{ 
            type: "text", 
            text: `Presença definida como "${presence}" com sucesso.` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao definir presença: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para logout da instância
  server.tool("logoutInstance",
    "Desconecta a instância do WhatsApp; reconectar exige ler o QR code de novo. Use só se for pedido explicitamente.",
    {},
    async () => {
      try {
        await evolutionService.logout();
        return {
          content: [{ 
            type: "text", 
            text: "Instância desconectada com sucesso." 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao desconectar instância: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para reiniciar a instância
  server.tool("restartInstance",
    "Reinicia a conexão da instância do WhatsApp.",
    {},
    async () => {
      try {
        await evolutionService.restartInstance();
        return {
          content: [{ 
            type: "text", 
            text: "Instância reiniciada com sucesso." 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao reiniciar instância: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // ===== FERRAMENTAS PARA MENSAGENS =====

  // Adiciona ferramenta para enviar mensagem de texto
  server.tool("sendTextMessage",
    "Envia uma mensagem de texto. Para responder uma conversa, use o remoteJid dela como destinatário; para citar uma mensagem, informe options.quotedMessageId.",
    { 
      number: z.string().min(1).describe(RECIPIENT_DESCRIPTION),
      text: z.string().min(1).describe("Texto da mensagem a ser enviada"),
      options: z.object({
        delay: z.number().optional().describe("Atraso em milissegundos (mostra 'digitando...' durante o atraso)"),
        quotedMessageId: z.string().optional().describe("ID da mensagem a ser citada")
      }).optional().describe("Opções adicionais para o envio")
    },
    async ({ number, text, options }) => {
      try {
        const result = await evolutionService.sendTextMessage({
          number,
          text,
          delay: options?.delay,
          quoted: options?.quotedMessageId ? { key: { id: options.quotedMessageId } } : undefined
        });
        return {
          content: [{ 
            type: "text", 
            text: `Mensagem enviada com sucesso: ${result?.key?.id || "ID não disponível"}` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao enviar mensagem: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para enviar mídia
  server.tool("sendMedia",
    "Envia imagem, vídeo, documento ou áudio a partir de uma URL pública, com legenda opcional.",
    { 
      number: z.string().min(1).describe(RECIPIENT_DESCRIPTION),
      url: z.string().url().describe("URL da mídia a ser enviada"),
      caption: z.string().optional().describe("Legenda para a mídia"),
      fileName: z.string().optional().describe("Nome do arquivo"),
      mediaType: z.enum(["image", "document", "video", "audio"]).describe("Tipo de mídia")
    },
    async ({ number, url, caption, fileName, mediaType }) => {
      try {
        await evolutionService.sendMedia({
          number,
          mediatype: mediaType,
          media: url,
          caption,
          fileName
        });
        return {
          content: [{ 
            type: "text", 
            text: `Mídia enviada com sucesso.` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao enviar mídia: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para enviar mensagem de áudio
  server.tool("sendAudio",
    "Envia um áudio a partir de uma URL, como mensagem de voz (padrão) ou como arquivo.",
    { 
      number: z.string().min(1).describe(RECIPIENT_DESCRIPTION),
      url: z.string().url().describe("URL do áudio a ser enviado"),
      ptt: z.boolean().optional().describe("Se é uma mensagem de voz (Push-to-talk). Padrão: true")
    },
    async ({ number, url, ptt = true }) => {
      try {
        // A Evolution v2 envia /sendWhatsAppAudio sempre como mensagem de voz;
        // áudio comum (arquivo) vai por /sendMedia
        if (ptt) {
          await evolutionService.sendAudio({ number, audio: url });
        } else {
          await evolutionService.sendMedia({ number, mediatype: "audio", media: url });
        }
        return {
          content: [{ 
            type: "text", 
            text: `Áudio enviado com sucesso.` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao enviar áudio: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para enviar sticker
  server.tool("sendSticker",
    "Envia uma figurinha a partir da URL de uma imagem.",
    { 
      number: z.string().min(1).describe(RECIPIENT_DESCRIPTION),
      url: z.string().url().describe("URL do sticker a ser enviado")
    },
    async ({ number, url }) => {
      try {
        await evolutionService.sendSticker({
          number,
          sticker: url
        });
        return {
          content: [{ 
            type: "text", 
            text: `Sticker enviado com sucesso.` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao enviar sticker: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para enviar localização
  server.tool("sendLocation",
    "Envia uma localização (latitude e longitude).",
    { 
      number: z.string().min(1).describe(RECIPIENT_DESCRIPTION),
      lat: z.number().describe("Latitude"),
      lng: z.number().describe("Longitude"),
      title: z.string().optional().describe("Título da localização"),
      address: z.string().optional().describe("Endereço da localização")
    },
    async ({ number, lat, lng, title, address }) => {
      try {
        await evolutionService.sendLocation({
          number,
          latitude: lat,
          longitude: lng,
          name: title ?? "",
          address: address ?? ""
        });
        return {
          content: [{ 
            type: "text", 
            text: `Localização enviada com sucesso.` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao enviar localização: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para enviar contato
  server.tool("sendContact",
    "Envia um cartão de contato.",
    { 
      number: z.string().min(1).describe(RECIPIENT_DESCRIPTION),
      fullName: z.string().min(1).describe("Nome completo do contato"),
      wuid: z.string().optional().describe("ID do WhatsApp do contato (só dígitos, ex: 5511999999999). Padrão: derivado do telefone"),
      phoneNumber: z.string().min(1).describe("Número de telefone do contato")
    },
    async ({ number, fullName, wuid, phoneNumber }) => {
      try {
        await evolutionService.sendContact({
          number,
          contact: [{ fullName, wuid, phoneNumber }]
        });
        return {
          content: [{ 
            type: "text", 
            text: `Contato enviado com sucesso.` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao enviar contato: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para enviar enquete
  server.tool("sendPoll",
    "Envia uma enquete.",
    { 
      number: z.string().min(1).describe(RECIPIENT_DESCRIPTION),
      name: z.string().min(1).describe("Pergunta da enquete"),
      options: z.array(z.string()).min(2).describe("Opções de resposta"),
      multipleChoice: z.boolean().optional().describe("Permite múltiplas escolhas")
    },
    async ({ number, name, options, multipleChoice }) => {
      try {
        await evolutionService.sendPoll({
          number,
          name,
          values: options,
          selectableCount: multipleChoice ? options.length : 1
        });
        return {
          content: [{ 
            type: "text", 
            text: `Enquete enviada com sucesso.` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao enviar enquete: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // ===== FERRAMENTAS PARA GESTÃO DE CHAT =====

  // Adiciona ferramenta para verificar número de WhatsApp
  server.tool("checkWhatsAppNumber",
    "Verifica se um número tem WhatsApp.",
    { 
      phone: z.string().min(1).describe("Número a ser verificado no formato internacional (ex: 5511999999999)")
    },
    async ({ phone }) => {
      try {
        const [result] = await evolutionService.checkWhatsAppNumbers([phone]);
        const isWhatsApp = result?.exists || false;
        return {
          content: [{ 
            type: "text", 
            text: isWhatsApp 
              ? `O número ${phone} é um número de WhatsApp válido.` 
              : `O número ${phone} não é um número de WhatsApp válido.` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao verificar número: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para marcar mensagem como lida
  server.tool("markMessageAsRead",
    "Marca uma mensagem específica como lida. Para marcar a conversa inteira, use markChatAsRead.",
    { 
      messageId: z.string().min(1).describe("ID da mensagem a ser marcada como lida"),
      remoteJid: z.string().min(1).describe(REMOTE_JID_DESCRIPTION),
      fromMe: z.boolean().default(false).describe("Se a mensagem foi enviada por você")
    },
    async ({ messageId, remoteJid, fromMe }) => {
      try {
        await evolutionService.markMessageAsRead([{ id: messageId, remoteJid: toJid(remoteJid), fromMe }]);
        return {
          content: [{ 
            type: "text", 
            text: `Mensagem marcada como lida com sucesso.` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao marcar mensagem como lida: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para arquivar chat
  server.tool("archiveChat",
    "Arquiva ou desarquiva uma conversa.",
    { 
      number: z.string().min(1).describe(RECIPIENT_DESCRIPTION),
      shouldArchive: z.boolean().default(true).describe("True para arquivar, false para desarquivar")
    },
    async ({ number, shouldArchive }) => {
      try {
        await evolutionService.archiveChat(number, shouldArchive);
        return {
          content: [{ 
            type: "text", 
            text: shouldArchive 
              ? `Chat arquivado com sucesso.` 
              : `Chat desarquivado com sucesso.` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao ${shouldArchive ? 'arquivar' : 'desarquivar'} chat: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para excluir mensagem para todos
  server.tool("deleteMessageForEveryone",
    "Apaga uma mensagem para todos.",
    { 
      messageId: z.string().min(1).describe("ID da mensagem a ser excluída"),
      remoteJid: z.string().min(1).describe(REMOTE_JID_DESCRIPTION),
      fromMe: z.boolean().default(true).describe("Se a mensagem foi enviada por você")
    },
    async ({ messageId, remoteJid, fromMe }) => {
      try {
        await evolutionService.deleteMessageForEveryone({ id: messageId, remoteJid: toJid(remoteJid), fromMe });
        return {
          content: [{ 
            type: "text", 
            text: `Mensagem excluída para todos com sucesso.` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao excluir mensagem: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para listar conversas
  server.tool("listChats",
    "Lista as conversas mais recentes com a última mensagem de cada uma. Use onlyAwaitingReply=true para encontrar conversas que precisam de resposta.",
    {
      onlyAwaitingReply: z.boolean().default(false).describe("Só conversas cuja última mensagem veio do contato, ou seja, aguardando resposta"),
      search: z.string().optional().describe("Filtra pelo nome do contato/grupo ou pelo número"),
      limit: z.number().int().min(1).max(100).default(20).describe("Quantidade máxima de conversas (mais recentes primeiro)"),
      offset: z.number().int().min(0).default(0).describe("Quantas conversas pular, para paginação")
    },
    async ({ onlyAwaitingReply, search, limit, offset }) => {
      try {
        // A Evolution não filtra conversas por nome nem por remetente da última mensagem,
        // então busca todas (já ordenadas pela mais recente) e filtra aqui
        const term = search?.toLowerCase();
        const chats = (await evolutionService.fetchChats())
          .filter((chat) => chat.remoteJid !== "status@broadcast")
          .filter((chat) => !onlyAwaitingReply || (chat.lastMessage !== undefined && !chat.lastMessage.key?.fromMe))
          .filter((chat) => !term || (chat.pushName ?? "").toLowerCase().includes(term) || chat.remoteJid.includes(term));
        const page = chats.slice(offset, offset + limit);

        if (page.length === 0) {
          return {
            content: [{ type: "text", text: onlyAwaitingReply ? "Nenhuma conversa aguardando resposta." : "Nenhuma conversa encontrada." }]
          };
        }

        const lines = page.map((chat) => {
          const last = chat.lastMessage;
          const sender = last?.key?.fromMe ? "Você" : last?.pushName || "Contato";
          const unread = chat.unreadCount ? ` | ${chat.unreadCount} não lida(s)` : "";
          const preview = last ? ` | ${formatTimestamp(last.messageTimestamp)} ${sender}: ${describeMessage(last)}` : "";
          return `- ${chat.pushName || "Sem nome"} | remoteJid: ${chat.remoteJid}${unread}${preview}`;
        });

        return {
          content: [{
            type: "text",
            text: `Conversas${onlyAwaitingReply ? " aguardando resposta" : ""} (${offset + 1}-${offset + page.length} de ${chats.length}):\n${lines.join("\n")}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Erro ao listar conversas: ${(error as Error).message}`
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para ler as mensagens de uma conversa
  server.tool("getChatMessages",
    "Lê as mensagens de uma conversa em ordem cronológica, com o ID de cada uma (para citar, reagir ou marcar como lida).",
    {
      remoteJid: z.string().min(1).describe(REMOTE_JID_DESCRIPTION),
      limit: z.number().int().min(1).max(100).default(20).describe("Quantidade de mensagens por página"),
      page: z.number().int().min(1).default(1).describe("Página: 1 = mensagens mais recentes")
    },
    async ({ remoteJid, limit, page }) => {
      try {
        const jid = toJid(remoteJid);
        const { messages } = await evolutionService.findMessages({ key: { remoteJid: jid } }, { offset: limit, page });

        if (messages.records.length === 0) {
          return {
            content: [{ type: "text", text: `Nenhuma mensagem encontrada para ${jid}.` }]
          };
        }

        // A Evolution devolve da mais recente para a mais antiga; exibe em ordem cronológica
        const lines = [...messages.records].reverse().map((msg) => {
          const sender = msg.key.fromMe ? "Você" : msg.pushName || "Contato";
          return `[${formatTimestamp(msg.messageTimestamp)}] ${sender}: ${describeMessage(msg)} (id: ${msg.key.id})`;
        });

        return {
          content: [{
            type: "text",
            text: `Mensagens de ${jid} (página ${messages.currentPage} de ${messages.pages}, ${messages.total} no total):\n${lines.join("\n")}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Erro ao buscar mensagens: ${(error as Error).message}`
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para marcar uma conversa inteira como lida
  server.tool("markChatAsRead",
    "Marca como lidas as mensagens recebidas de uma conversa (o cliente vê os tiques azuis).",
    {
      remoteJid: z.string().min(1).describe(REMOTE_JID_DESCRIPTION)
    },
    async ({ remoteJid }) => {
      try {
        const jid = toJid(remoteJid);
        // Envia confirmação de leitura das mensagens recebidas mais recentes da conversa
        const { messages } = await evolutionService.findMessages({ key: { remoteJid: jid } }, { offset: 50, page: 1 });
        const incoming = messages.records
          .filter((msg) => !msg.key.fromMe)
          .map((msg) => ({ id: msg.key.id, remoteJid: msg.key.remoteJid, fromMe: false }));

        if (incoming.length === 0) {
          return {
            content: [{ type: "text", text: `Nenhuma mensagem recebida para marcar como lida em ${jid}.` }]
          };
        }

        await evolutionService.markMessageAsRead(incoming);
        return {
          content: [{ type: "text", text: `Conversa ${jid} marcada como lida (${incoming.length} mensagem(ns) recebida(s)).` }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Erro ao marcar conversa como lida: ${(error as Error).message}` }]
        };
      }
    }
  );

  // Adiciona ferramenta para reagir a uma mensagem
  server.tool("reactToMessage",
    "Reage a uma mensagem com um emoji (ex: 👍 para confirmar o recebimento).",
    {
      remoteJid: z.string().min(1).describe(REMOTE_JID_DESCRIPTION),
      messageId: z.string().min(1).describe("ID da mensagem (retornado por getChatMessages)"),
      emoji: z.string().describe("Emoji da reação (ex: 👍). Texto vazio remove a reação"),
      fromMe: z.boolean().default(false).describe("True se a mensagem foi enviada por você (aparece como 'Você' em getChatMessages)")
    },
    async ({ remoteJid, messageId, emoji, fromMe }) => {
      try {
        await evolutionService.sendReaction({
          key: { id: messageId, remoteJid: toJid(remoteJid), fromMe },
          reaction: emoji
        });
        return {
          content: [{ type: "text", text: emoji ? `Reação ${emoji} enviada.` : "Reação removida." }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Erro ao reagir à mensagem: ${(error as Error).message}` }]
        };
      }
    }
  );

  // Adiciona ferramenta para buscar contatos
  server.tool("searchContacts",
    "Busca contatos por parte do nome ou do número e retorna o remoteJid para enviar mensagens.",
    {
      search: z.string().min(1).describe("Parte do nome ou do número do contato"),
      limit: z.number().int().min(1).max(100).default(20).describe("Quantidade máxima de resultados")
    },
    async ({ search, limit }) => {
      try {
        // A Evolution só filtra por nome exato, então a busca parcial é feita aqui
        const term = search.toLowerCase();
        const digits = search.replace(/\D/g, "");
        const matches = (await evolutionService.fetchContacts())
          .filter((contact) => !contact.isGroup)
          .filter((contact) =>
            (contact.pushName ?? "").toLowerCase().includes(term) || (digits.length > 0 && contact.remoteJid.includes(digits))
          );

        if (matches.length === 0) {
          return {
            content: [{ type: "text", text: `Nenhum contato encontrado para "${search}".` }]
          };
        }

        const lines = matches.slice(0, limit).map((contact) => `- ${contact.pushName || "Sem nome"} | remoteJid: ${contact.remoteJid}`);
        return {
          content: [{
            type: "text",
            text: `Contatos encontrados (${Math.min(limit, matches.length)} de ${matches.length}):\n${lines.join("\n")}`
          }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Erro ao buscar contatos: ${(error as Error).message}` }]
        };
      }
    }
  );

  // ===== FERRAMENTAS DE PERFIL =====

  // Adiciona ferramenta para atualizar nome do perfil
  server.tool("updateProfileName",
    "Atualiza o nome do perfil do WhatsApp da instância.",
    { 
      name: z.string().min(1).describe("Novo nome para o perfil")
    },
    async ({ name }) => {
      try {
        await evolutionService.updateProfileName(name);
        return {
          content: [{ 
            type: "text", 
            text: `Nome do perfil atualizado para "${name}" com sucesso.` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao atualizar nome do perfil: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para atualizar status do perfil
  server.tool("updateProfileStatus",
    "Atualiza o recado (status) do perfil do WhatsApp da instância.",
    { 
      status: z.string().min(1).describe("Novo status para o perfil")
    },
    async ({ status }) => {
      try {
        await evolutionService.updateProfileStatus(status);
        return {
          content: [{ 
            type: "text", 
            text: `Status do perfil atualizado para "${status}" com sucesso.` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao atualizar status do perfil: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // ===== FERRAMENTAS DE GRUPO =====

  // Adiciona ferramenta para criar grupo
  server.tool("createGroup",
    "Cria um grupo com os participantes informados.",
    { 
      subject: z.string().min(1).describe("Nome do grupo"),
      participants: z.array(z.string()).min(1).describe("Lista de números de participantes"),
      description: z.string().optional().describe("Descrição do grupo")
    },
    async ({ subject, participants, description }) => {
      try {
        const result = await evolutionService.createGroup({
          subject,
          participants,
          description
        });
        return {
          content: [{ 
            type: "text", 
            text: `Grupo "${subject}" criado com sucesso. ID: ${result?.id ?? "não disponível"}` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao criar grupo: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // Adiciona ferramenta para adicionar participantes ao grupo
  server.tool("addGroupParticipants",
    "Adiciona participantes a um grupo.",
    { 
      groupId: z.string().min(1).describe("ID do grupo"),
      participants: z.array(z.string()).min(1).describe("Lista de números de participantes")
    },
    async ({ groupId, participants }) => {
      try {
        await evolutionService.updateGroupMembers({
          groupJid: groupId,
          action: "add",
          participants
        });
        return {
          content: [{ 
            type: "text", 
            text: `${participants.length} participante(s) adicionado(s) ao grupo com sucesso.` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Erro ao adicionar participantes: ${(error as Error).message}` 
          }]
        };
      }
    }
  );

  // ===== RECURSOS PARA CONSULTAR INFORMAÇÕES =====

  // Adiciona recurso para visualizar contatos
  server.resource(
    "contacts",
    new ResourceTemplate("contacts://list", { list: undefined }),
    async (uri) => {
      try {
        const contacts = await evolutionService.fetchContacts();
      
        return {
          contents: [{
            uri: uri.href,
            text: `Contatos disponíveis (${contacts.length}):\n${contacts
              .map((contact) => `- ${contact.pushName || "Sem nome"}: ${contact.remoteJid.split("@")[0]}`)
              .join("\n")}`
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            text: `Erro ao buscar contatos: ${(error as Error).message}`
          }]
        };
      }
    }
  );

  // Adiciona recurso para visualizar conversas
  server.resource(
    "chats",
    new ResourceTemplate("chats://list", { list: undefined }),
    async (uri) => {
      try {
        const chats = await evolutionService.fetchChats();
      
        return {
          contents: [{
            uri: uri.href,
            text: `Conversas disponíveis (${chats.length}):\n${chats
              .map((chat) => `- ${chat.pushName || "Sem nome"}: ${chat.remoteJid}${chat.unreadCount ? ` (${chat.unreadCount} não lidas)` : ""}`)
              .join("\n")}`
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            text: `Erro ao buscar conversas: ${(error as Error).message}`
          }]
        };
      }
    }
  );

  // Adiciona recurso para visualizar grupos
  server.resource(
    "groups",
    new ResourceTemplate("groups://list", { list: undefined }),
    async (uri) => {
      try {
        const groups = await evolutionService.fetchAllGroups();
      
        return {
          contents: [{
            uri: uri.href,
            text: `Grupos disponíveis (${groups.length}):\n${groups
              .map((group) => `- ${group.subject || "Grupo sem nome"}: ${group.id} (${group.size ?? 0} membros)`)
              .join("\n")}`
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            text: `Erro ao buscar grupos: ${(error as Error).message}`
          }]
        };
      }
    }
  );

  // Adiciona recurso para visualizar detalhes do perfil
  server.resource(
    "profile",
    new ResourceTemplate("profile://info", { list: undefined }),
    async (uri) => {
      try {
        // O fetchProfile sem número não traz nome/recado, então busca pelo número do dono da instância
        const info = await evolutionService.fetchInstanceInfo();
        const profile = info.ownerJid ? await evolutionService.fetchProfile(info.ownerJid.split("@")[0]) : undefined;
      
        return {
          contents: [{
            uri: uri.href,
            text: `Informações do perfil:\n- Instância: ${info.name} (${info.connectionStatus})\n- Número: ${info.ownerJid?.split("@")[0] || "Não conectado"}\n- Nome: ${info.profileName || "Não definido"}\n- Recado: ${profile?.status?.status || "Não definido"}\n- Conta comercial: ${profile?.isBusiness ? "Sim" : "Não"}`
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            text: `Erro ao buscar informações do perfil: ${(error as Error).message}`
          }]
        };
      }
    }
  );

  // Adiciona recurso para visualizar configurações de privacidade
  server.resource(
    "privacy",
    new ResourceTemplate("privacy://settings", { list: undefined }),
    async (uri) => {
      try {
        const privacy = await evolutionService.fetchPrivacySettings();
      
        return {
          contents: [{
            uri: uri.href,
            text: `Configurações de privacidade:\n- Confirmações de leitura: ${privacy.readreceipts}\n- Perfil: ${privacy.profile}\n- Status: ${privacy.status}\n- Online: ${privacy.online}\n- Último visto: ${privacy.last}\n- Adição a grupos: ${privacy.groupadd}`
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            text: `Erro ao buscar configurações de privacidade: ${(error as Error).message}`
          }]
        };
      }
    }
  );

  return server;
}

// Inicia o servidor usando stdin/stdout para comunicação.
// Logs vão para stderr porque o stdout é o canal do protocolo MCP.
export async function startServer() {
  console.error("Iniciando servidor MCP para Evolution API via STDIO...");
  try {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Servidor MCP STDIO iniciado com sucesso!");
    return server;
  } catch (error) {
    console.error("Erro ao iniciar servidor MCP STDIO:", error);
    throw error;
  }
}

// Inicia o servidor HTTP com as rotas MCP (/mcp, /sse e WebSocket)
export async function startHttpServer(port: number = 3000) {
  console.error(`Iniciando servidor MCP HTTP para Evolution API na porta ${port}...`);
  try {
    const result = await startMcpHttpServer(port, createMcpServer);
    console.error(`Servidor MCP HTTP iniciado na porta ${port}! Rotas: POST /mcp, GET /sse, WebSocket.`);
    return result;
  } catch (error) {
    console.error("Erro ao iniciar servidor MCP HTTP:", error);
    throw error;
  }
}

// Se este arquivo for executado diretamente, inicia o servidor
if (import.meta.url === `file://${process.argv[1]}`) {
  // ENABLE_WEBSOCKET habilita o servidor HTTP (rotas /mcp, /sse e WebSocket)
  const enableHttp = process.env.ENABLE_WEBSOCKET === 'true';
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  
  startServer().catch(console.error);
  
  if (enableHttp) {
    startHttpServer(port).catch(console.error);
  }
} 