import type { StoredMessage } from "./types.js";

const MEDIA_LABELS: Record<string, string> = {
  imageMessage: "[imagem]",
  videoMessage: "[vídeo]",
  ptvMessage: "[vídeo]",
  audioMessage: "[áudio]",
  documentMessage: "[documento]",
  documentWithCaptionMessage: "[documento]",
  stickerMessage: "[figurinha]",
  locationMessage: "[localização]",
  liveLocationMessage: "[localização]",
  contactMessage: "[contato]",
  contactsArrayMessage: "[contatos]",
  pollCreationMessage: "[enquete]",
  pollCreationMessageV3: "[enquete]",
  reactionMessage: "[reação]"
};

// Extrai um texto legível de uma mensagem do WhatsApp (texto, legenda ou tipo de mídia)
export function describeMessage(message: Partial<Pick<StoredMessage, "message" | "messageType">> | undefined): string {
  const m = message?.message ?? {};
  const type = message?.messageType ?? "";
  const text =
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    m.documentMessage?.fileName ??
    m.documentWithCaptionMessage?.message?.documentMessage?.caption ??
    m.pollCreationMessage?.name ??
    m.pollCreationMessageV3?.name ??
    m.reactionMessage?.text ??
    m.locationMessage?.name ??
    m.contactMessage?.displayName ??
    m.buttonsResponseMessage?.selectedDisplayText ??
    m.listResponseMessage?.title;

  const label = MEDIA_LABELS[type];
  if (!text) {
    return label ?? `[${type || "mensagem"}]`;
  }
  // Uma mensagem por linha na saída das tools
  const singleLine = String(text).replace(/\s*\n+\s*/g, " ⏎ ").trim();
  return label ? `${label} ${singleLine}` : singleLine;
}

// Timestamp do WhatsApp (segundos) em data/hora local. Fuso configurável via TZ.
export function formatTimestamp(seconds: number | string | undefined): string {
  if (!seconds) {
    return "data desconhecida";
  }
  return new Date(Number(seconds) * 1000).toLocaleString("pt-BR", {
    timeZone: process.env.TZ || "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short"
  });
}
