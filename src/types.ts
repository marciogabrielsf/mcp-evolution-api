// Interfaces para a Evolution API v2 (validadas contra a versão 2.3.7)

// ===== GERAL =====

export interface ApiInfo {
  status: number;
  message: string;
  version: string;
  clientName?: string;
  manager?: string;
  documentation?: string;
  whatsappWebVersion?: string;
}

// ===== INSTÂNCIA =====

export interface InstanceStatus {
  instance: {
    instanceName: string;
    state: "open" | "connecting" | "close" | string;
  };
}

export interface InstanceInfo {
  id: string;
  name: string;
  connectionStatus: string;
  ownerJid: string | null;
  profileName: string | null;
  profilePicUrl: string | null;
  integration: string;
  number: string | null;
}

export type Presence = "available" | "unavailable" | "composing" | "recording" | "paused";

export interface SettingsConfig {
  rejectCall?: boolean;
  msgCall?: string;
  groupsIgnore?: boolean;
  alwaysOnline?: boolean;
  readMessages?: boolean;
  readStatus?: boolean;
  syncFullHistory?: boolean;
}

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  headers?: Record<string, string>;
  byEvents?: boolean;
  base64?: boolean;
  events?: string[];
}

export interface InstanceConfig extends SettingsConfig {
  token?: string;
  number?: string;
  qrcode?: boolean;
  integration?: "WHATSAPP-BAILEYS" | "WHATSAPP-BUSINESS" | "EVOLUTION";
  webhook?: WebhookConfig;
}

// ===== MENSAGENS =====

export interface MessageKey {
  id: string;
  remoteJid: string;
  fromMe: boolean;
}

// Opções comuns aceitas pelos endpoints /message/*
export interface MessageOptions {
  delay?: number;
  quoted?: {
    key: { id: string; remoteJid?: string; fromMe?: boolean };
    message?: Record<string, unknown>;
  };
  everyOne?: boolean;
  mentioned?: string[];
}

export interface SendMessageResponse {
  key: MessageKey;
  message?: Record<string, unknown>;
  messageTimestamp?: number | string;
  status?: string;
}

export interface SendTextMessageRequest extends MessageOptions {
  number: string;
  text: string;
  linkPreview?: boolean;
}

export interface SendMediaRequest extends MessageOptions {
  number: string;
  mediatype: "image" | "document" | "video" | "audio";
  media: string; // URL ou base64
  mimetype?: string;
  fileName?: string;
  caption?: string;
}

// Enviado como mensagem de voz (PTT)
export interface SendAudioRequest extends MessageOptions {
  number: string;
  audio: string; // URL ou base64
}

export interface SendStickerRequest extends MessageOptions {
  number: string;
  sticker: string; // URL ou base64
}

export interface SendLocationRequest extends MessageOptions {
  number: string;
  latitude: number;
  longitude: number;
  name: string;
  address: string;
}

export interface ContactCard {
  fullName: string;
  phoneNumber: string;
  wuid?: string;
  organization?: string;
  email?: string;
  url?: string;
}

export interface SendContactRequest {
  number: string;
  contact: ContactCard[];
}

export interface SendReactionRequest {
  key: MessageKey;
  reaction: string;
}

export interface SendPollRequest extends MessageOptions {
  number: string;
  name: string;
  selectableCount: number;
  values: string[];
}

export interface ListRow {
  title: string;
  description?: string;
  rowId: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

export interface SendListRequest extends MessageOptions {
  number: string;
  title: string;
  description?: string;
  footerText: string;
  buttonText: string;
  sections: ListSection[];
}

export interface SendStatusRequest {
  type: "text" | "image" | "audio" | "video";
  content: string; // Texto ou URL
  caption?: string;
  backgroundColor?: string;
  font?: number;
  statusJidList?: string[];
  allContacts?: boolean;
}

// Disponível apenas para a integração WHATSAPP-BUSINESS (Cloud API)
export interface SendTemplateRequest {
  number: string;
  name: string;
  language: string;
  components?: unknown[];
  webhookUrl?: string;
}

// ===== CHAT =====

export interface CheckNumberResult {
  jid: string;
  exists: boolean;
  number: string;
  name?: string;
}

export interface Contact {
  id: string;
  remoteJid: string;
  pushName?: string | null;
  profilePicUrl?: string | null;
  isGroup?: boolean;
  isSaved?: boolean;
  type?: string;
}

export interface Chat {
  id: string | null;
  remoteJid: string;
  pushName?: string | null;
  profilePicUrl?: string | null;
  unreadCount?: number | null;
  lastMessage?: Partial<StoredMessage>;
  updatedAt?: string;
}

// Mensagem como armazenada pela Evolution (retorno de findChats/findMessages)
export interface StoredMessage {
  id: string;
  key: MessageKey & { participant?: string };
  pushName?: string | null;
  messageType: string;
  message: Record<string, any>;
  messageTimestamp: number;
}

export interface FindMessagesResponse {
  messages: {
    total: number;
    pages: number;
    currentPage: number;
    records: StoredMessage[];
  };
}

// ===== PERFIL =====

export interface ProfileInfo {
  wuid: string;
  name?: string;
  numberExists: boolean;
  picture?: string;
  status?: { status?: string; setAt?: string };
  isBusiness?: boolean;
  email?: string;
  description?: string;
  website?: string[];
}

type PrivacyValue = "all" | "contacts" | "contact_blacklist" | "none";

export interface PrivacySettings {
  readreceipts: "all" | "none";
  profile: PrivacyValue;
  status: PrivacyValue;
  online: "all" | "match_last_seen";
  last: PrivacyValue;
  groupadd: PrivacyValue;
}

// ===== GRUPOS =====

export interface CreateGroupRequest {
  subject: string;
  participants: string[];
  description?: string;
  profilePicture?: string;
  promoteParticipants?: boolean;
}

export interface GroupParticipant {
  id: string;
  admin?: "admin" | "superadmin" | null;
}

export interface GroupInfo {
  id: string;
  subject: string;
  subjectOwner?: string;
  pictureUrl?: string | null;
  size?: number;
  creation?: number;
  owner?: string;
  desc?: string;
  restrict?: boolean;
  announce?: boolean;
  participants?: GroupParticipant[];
}

export interface GroupUpdateParticipantsRequest {
  groupJid: string;
  action: "add" | "remove" | "promote" | "demote";
  participants: string[];
}

export interface GroupSettingRequest {
  groupJid: string;
  action: "announcement" | "not_announcement" | "locked" | "unlocked";
}

export type EphemeralExpiration = 0 | 86400 | 604800 | 7776000;

// ===== INTEGRAÇÕES =====

export interface ChatwootConfig {
  enabled: boolean;
  accountId: string;
  token: string;
  url: string;
  signMsg: boolean;
  reopenConversation: boolean;
  conversationPending: boolean;
  signDelimiter?: string | null;
  nameInbox?: string | null;
  autoCreate?: boolean;
  importContacts?: boolean;
  mergeBrazilContacts?: boolean;
  importMessages?: boolean;
  daysLimitImportMessages?: number;
  ignoreJids?: string[];
}

export interface TypebotConfig {
  enabled: boolean;
  url: string;
  typebot: string;
  triggerType: "all" | "keyword" | "none" | "advanced";
  description?: string;
  triggerOperator?: "equals" | "contains" | "startsWith" | "endsWith" | "regex";
  triggerValue?: string;
  expire?: number;
  keywordFinish?: string;
  delayMessage?: number;
  unknownMessage?: string;
  listeningFromMe?: boolean;
  stopBotFromMe?: boolean;
  ignoreJids?: string[];
}

export interface TypebotStartRequest {
  remoteJid: string;
  url: string;
  typebot: string;
  startSession?: boolean;
  variables?: Array<{ name: string; value: string }>;
}

export type TypebotSessionStatus = "opened" | "closed" | "paused" | "delete";
