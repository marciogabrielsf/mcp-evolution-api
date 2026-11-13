import axios from "axios";
import { config } from "../config.js";
import type {
  ApiInfo,
  InstanceStatus,
  InstanceInfo,
  InstanceConfig,
  Presence,
  SettingsConfig,
  WebhookConfig,
  MessageKey,
  SendMessageResponse,
  SendTextMessageRequest,
  SendMediaRequest,
  SendAudioRequest,
  SendStickerRequest,
  SendLocationRequest,
  SendContactRequest,
  SendReactionRequest,
  SendPollRequest,
  SendListRequest,
  SendStatusRequest,
  SendTemplateRequest,
  CheckNumberResult,
  Contact,
  Chat,
  ProfileInfo,
  PrivacySettings,
  CreateGroupRequest,
  GroupInfo,
  GroupUpdateParticipantsRequest,
  GroupSettingRequest,
  EphemeralExpiration,
  ChatwootConfig,
  TypebotConfig,
  TypebotStartRequest,
  TypebotSessionStatus
} from "../types.js";

// Cliente Axios configurado para a Evolution API
const apiClient = axios.create({
  baseURL: config.evolutionApi.baseUrl,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
    "apikey": config.evolutionApi.apiKey
  }
});

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type QueryParams = Record<string, string | number | boolean | undefined>;

// Monta um erro legível com a mensagem da Evolution API.
// Não reaproveita o erro do axios porque ele carrega os headers da requisição (incluindo a apikey).
function toEvolutionError(error: unknown): Error {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  const status = error.response?.status;
  const data = error.response?.data as
    | { response?: { message?: unknown }; message?: unknown; error?: unknown }
    | undefined;
  const raw = data?.response?.message ?? data?.message ?? data?.error;
  const detail = Array.isArray(raw)
    ? raw.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("; ")
    : typeof raw === "string"
      ? raw
      : error.message;

  return new Error(status ? `${detail} (HTTP ${status})` : detail);
}

// Classe de serviço para a Evolution API v2
export class EvolutionApiService {
  constructor(private readonly instanceName: string = config.evolutionApi.instanceId) {}

  private get instance(): string {
    return encodeURIComponent(this.instanceName);
  }

  private async request<T>(action: string, method: HttpMethod, path: string, data?: unknown, params?: QueryParams): Promise<T> {
    try {
      const response = await apiClient.request<T>({ method, url: path, data, params });
      return response.data;
    } catch (error) {
      const evolutionError = toEvolutionError(error);
      console.error(`Erro ao ${action}: ${evolutionError.message}`);
      throw evolutionError;
    }
  }

  // ===== FUNÇÕES GERAIS DA API =====

  async getApiInfo(): Promise<ApiInfo> {
    return this.request("obter informações da API", "GET", "/");
  }

  // ===== GESTÃO DE INSTÂNCIAS =====

  async getInstanceStatus(): Promise<InstanceStatus> {
    return this.request("verificar status da instância", "GET", `/instance/connectionState/${this.instance}`);
  }

  async fetchInstanceInfo(): Promise<InstanceInfo> {
    const instances = await this.request<InstanceInfo[]>(
      "buscar dados da instância", "GET", "/instance/fetchInstances", undefined, { instanceName: this.instanceName }
    );
    const info = instances?.[0];
    if (!info) {
      throw new Error(`Instância "${this.instanceName}" não encontrada na Evolution API`);
    }
    return info;
  }

  async createInstance(instanceName: string, instanceConfig: InstanceConfig = {}): Promise<unknown> {
    return this.request("criar instância", "POST", "/instance/create", {
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      ...instanceConfig
    });
  }

  async deleteInstance(): Promise<unknown> {
    return this.request("excluir instância", "DELETE", `/instance/delete/${this.instance}`);
  }

  async restartInstance(): Promise<unknown> {
    return this.request("reiniciar instância", "POST", `/instance/restart/${this.instance}`);
  }

  async setPresence(presence: Presence): Promise<unknown> {
    return this.request("definir presença", "POST", `/instance/setPresence/${this.instance}`, { presence });
  }

  async logout(): Promise<unknown> {
    return this.request("desconectar instância", "DELETE", `/instance/logout/${this.instance}`);
  }

  // ===== WEBHOOK =====

  async setWebhook(webhook: WebhookConfig): Promise<unknown> {
    return this.request("configurar webhook", "POST", `/webhook/set/${this.instance}`, { webhook });
  }

  async getWebhook(): Promise<unknown> {
    return this.request("buscar webhook", "GET", `/webhook/find/${this.instance}`);
  }

  // ===== CONFIGURAÇÕES =====

  async setSettings(settings: SettingsConfig): Promise<unknown> {
    return this.request("definir configurações", "POST", `/settings/set/${this.instance}`, settings);
  }

  async getSettings(): Promise<SettingsConfig> {
    return this.request("buscar configurações", "GET", `/settings/find/${this.instance}`);
  }

  // ===== ENVIO DE MENSAGENS =====

  async sendTextMessage(data: SendTextMessageRequest): Promise<SendMessageResponse> {
    return this.request("enviar mensagem de texto", "POST", `/message/sendText/${this.instance}`, data);
  }

  async sendTemplate(data: SendTemplateRequest): Promise<SendMessageResponse> {
    return this.request("enviar template", "POST", `/message/sendTemplate/${this.instance}`, data);
  }

  async sendStatus(data: SendStatusRequest): Promise<SendMessageResponse> {
    return this.request("enviar status", "POST", `/message/sendStatus/${this.instance}`, data);
  }

  async sendMedia(data: SendMediaRequest): Promise<SendMessageResponse> {
    return this.request("enviar mídia", "POST", `/message/sendMedia/${this.instance}`, data);
  }

  async sendAudio(data: SendAudioRequest): Promise<SendMessageResponse> {
    return this.request("enviar áudio", "POST", `/message/sendWhatsAppAudio/${this.instance}`, data);
  }

  async sendSticker(data: SendStickerRequest): Promise<SendMessageResponse> {
    return this.request("enviar sticker", "POST", `/message/sendSticker/${this.instance}`, data);
  }

  async sendLocation(data: SendLocationRequest): Promise<SendMessageResponse> {
    return this.request("enviar localização", "POST", `/message/sendLocation/${this.instance}`, data);
  }

  async sendContact(data: SendContactRequest): Promise<SendMessageResponse> {
    return this.request("enviar contato", "POST", `/message/sendContact/${this.instance}`, data);
  }

  async sendReaction(data: SendReactionRequest): Promise<SendMessageResponse> {
    return this.request("enviar reação", "POST", `/message/sendReaction/${this.instance}`, data);
  }

  async sendPoll(data: SendPollRequest): Promise<SendMessageResponse> {
    return this.request("enviar enquete", "POST", `/message/sendPoll/${this.instance}`, data);
  }

  async sendList(data: SendListRequest): Promise<SendMessageResponse> {
    return this.request("enviar lista", "POST", `/message/sendList/${this.instance}`, data);
  }

  // ===== CONTROLADOR DE CHAT =====

  async checkWhatsAppNumbers(numbers: string[]): Promise<CheckNumberResult[]> {
    return this.request("verificar números de WhatsApp", "POST", `/chat/whatsappNumbers/${this.instance}`, { numbers });
  }

  async markMessageAsRead(readMessages: MessageKey[]): Promise<unknown> {
    return this.request("marcar mensagem como lida", "POST", `/chat/markMessageAsRead/${this.instance}`, { readMessages });
  }

  // `chat` aceita número ou JID; a Evolution usa a última mensagem do chat para arquivar
  async archiveChat(chat: string, archive: boolean): Promise<unknown> {
    return this.request("arquivar chat", "POST", `/chat/archiveChat/${this.instance}`, { chat, archive });
  }

  async deleteMessageForEveryone(key: MessageKey & { participant?: string }): Promise<unknown> {
    return this.request("excluir mensagem para todos", "DELETE", `/chat/deleteMessageForEveryone/${this.instance}`, key);
  }

  async sendPresence(number: string, presence: Presence, delay: number): Promise<unknown> {
    return this.request("definir presença no chat", "POST", `/chat/sendPresence/${this.instance}`, { number, presence, delay });
  }

  async fetchProfilePictureUrl(number: string): Promise<{ wuid: string; profilePictureUrl: string | null }> {
    return this.request("buscar foto de perfil", "POST", `/chat/fetchProfilePictureUrl/${this.instance}`, { number });
  }

  async fetchContacts(where: Record<string, string> = {}): Promise<Contact[]> {
    return this.request("buscar contatos", "POST", `/chat/findContacts/${this.instance}`, { where });
  }

  async findMessages(where: Record<string, unknown> = {}, limit?: number): Promise<unknown> {
    return this.request("buscar mensagens", "POST", `/chat/findMessages/${this.instance}`, { where, limit });
  }

  async findStatusMessages(where: Record<string, unknown> = {}, limit?: number): Promise<unknown> {
    return this.request("buscar mensagens de status", "POST", `/chat/findStatusMessage/${this.instance}`, { where, limit });
  }

  async updateMessage(number: string, key: MessageKey, text: string): Promise<unknown> {
    return this.request("atualizar mensagem", "POST", `/chat/updateMessage/${this.instance}`, { number, key, text });
  }

  async fetchChats(where: Record<string, string> = {}): Promise<Chat[]> {
    return this.request("buscar conversas", "POST", `/chat/findChats/${this.instance}`, { where });
  }

  // ===== PERFIL (rotas /chat na v2) =====

  async fetchBusinessProfile(number: string): Promise<unknown> {
    return this.request("buscar perfil de negócios", "POST", `/chat/fetchBusinessProfile/${this.instance}`, { number });
  }

  async fetchProfile(number: string): Promise<ProfileInfo> {
    return this.request("buscar perfil", "POST", `/chat/fetchProfile/${this.instance}`, { number });
  }

  async updateProfileName(name: string): Promise<unknown> {
    return this.request("atualizar nome do perfil", "POST", `/chat/updateProfileName/${this.instance}`, { name });
  }

  async updateProfileStatus(status: string): Promise<unknown> {
    return this.request("atualizar status do perfil", "POST", `/chat/updateProfileStatus/${this.instance}`, { status });
  }

  async updateProfilePicture(picture: string): Promise<unknown> {
    return this.request("atualizar foto do perfil", "POST", `/chat/updateProfilePicture/${this.instance}`, { picture });
  }

  async removeProfilePicture(): Promise<unknown> {
    return this.request("remover foto do perfil", "DELETE", `/chat/removeProfilePicture/${this.instance}`);
  }

  async fetchPrivacySettings(): Promise<PrivacySettings> {
    return this.request("buscar configurações de privacidade", "GET", `/chat/fetchPrivacySettings/${this.instance}`);
  }

  async updatePrivacySettings(settings: PrivacySettings): Promise<unknown> {
    return this.request("atualizar configurações de privacidade", "POST", `/chat/updatePrivacySettings/${this.instance}`, settings);
  }

  // ===== GERENCIAMENTO DE GRUPOS =====
  // A Evolution aceita o groupJid na query string em todas as rotas de grupo

  async createGroup(data: CreateGroupRequest): Promise<GroupInfo> {
    return this.request("criar grupo", "POST", `/group/create/${this.instance}`, data);
  }

  async updateGroupPicture(groupJid: string, image: string): Promise<unknown> {
    return this.request("atualizar foto do grupo", "POST", `/group/updateGroupPicture/${this.instance}`, { image }, { groupJid });
  }

  async updateGroupSubject(groupJid: string, subject: string): Promise<unknown> {
    return this.request("atualizar assunto do grupo", "POST", `/group/updateGroupSubject/${this.instance}`, { subject }, { groupJid });
  }

  async updateGroupDescription(groupJid: string, description: string): Promise<unknown> {
    return this.request("atualizar descrição do grupo", "POST", `/group/updateGroupDescription/${this.instance}`, { description }, { groupJid });
  }

  async fetchInviteCode(groupJid: string): Promise<{ inviteUrl: string; inviteCode: string }> {
    return this.request("buscar código de convite", "GET", `/group/inviteCode/${this.instance}`, undefined, { groupJid });
  }

  async acceptInviteCode(inviteCode: string): Promise<unknown> {
    return this.request("aceitar código de convite", "GET", `/group/acceptInviteCode/${this.instance}`, undefined, { inviteCode });
  }

  async revokeInviteCode(groupJid: string): Promise<unknown> {
    return this.request("revogar código de convite", "POST", `/group/revokeInviteCode/${this.instance}`, undefined, { groupJid });
  }

  async sendGroupInvite(groupJid: string, numbers: string[], description: string): Promise<unknown> {
    return this.request("enviar convite de grupo", "POST", `/group/sendInvite/${this.instance}`, { groupJid, numbers, description });
  }

  async findGroupByInviteCode(inviteCode: string): Promise<GroupInfo> {
    return this.request("buscar grupo por código de convite", "GET", `/group/inviteInfo/${this.instance}`, undefined, { inviteCode });
  }

  async findGroupByJid(groupJid: string): Promise<GroupInfo> {
    return this.request("buscar grupo por JID", "GET", `/group/findGroupInfos/${this.instance}`, undefined, { groupJid });
  }

  async fetchAllGroups(getParticipants = false): Promise<GroupInfo[]> {
    return this.request("buscar todos os grupos", "GET", `/group/fetchAllGroups/${this.instance}`, undefined, {
      getParticipants: String(getParticipants)
    });
  }

  async findGroupMembers(groupJid: string): Promise<{ participants: unknown[] }> {
    return this.request("buscar membros do grupo", "GET", `/group/participants/${this.instance}`, undefined, { groupJid });
  }

  async updateGroupMembers({ groupJid, action, participants }: GroupUpdateParticipantsRequest): Promise<unknown> {
    return this.request("atualizar membros do grupo", "POST", `/group/updateParticipant/${this.instance}`, { action, participants }, { groupJid });
  }

  async updateGroupSetting({ groupJid, action }: GroupSettingRequest): Promise<unknown> {
    return this.request("atualizar configuração do grupo", "POST", `/group/updateSetting/${this.instance}`, { action }, { groupJid });
  }

  async toggleEphemeral(groupJid: string, expiration: EphemeralExpiration): Promise<unknown> {
    return this.request("alternar mensagens efêmeras", "POST", `/group/toggleEphemeral/${this.instance}`, { expiration }, { groupJid });
  }

  async leaveGroup(groupJid: string): Promise<unknown> {
    return this.request("sair do grupo", "DELETE", `/group/leaveGroup/${this.instance}`, undefined, { groupJid });
  }

  // ===== TYPEBOT =====

  async createTypebot(typebotConfig: TypebotConfig): Promise<unknown> {
    return this.request("criar Typebot", "POST", `/typebot/create/${this.instance}`, typebotConfig);
  }

  async findTypebots(): Promise<unknown> {
    return this.request("buscar Typebots", "GET", `/typebot/find/${this.instance}`);
  }

  async startTypebot(data: TypebotStartRequest): Promise<unknown> {
    return this.request("iniciar Typebot", "POST", `/typebot/start/${this.instance}`, data);
  }

  async changeTypebotStatus(remoteJid: string, status: TypebotSessionStatus): Promise<unknown> {
    return this.request("alterar status do Typebot", "POST", `/typebot/changeStatus/${this.instance}`, { remoteJid, status });
  }

  // ===== CHATWOOT =====

  async setChatwoot(chatwootConfig: ChatwootConfig): Promise<unknown> {
    return this.request("configurar Chatwoot", "POST", `/chatwoot/set/${this.instance}`, chatwootConfig);
  }

  async findChatwoot(): Promise<ChatwootConfig> {
    return this.request("buscar configuração do Chatwoot", "GET", `/chatwoot/find/${this.instance}`);
  }
}
