/** Metadata del proveedor Google Gemini (AI Studio). Compatible con API OpenAI vía el endpoint oficial /v1beta/openai. La llamada real ocurre en api/ai/generate.js */
export const gemini = {
  name: "gemini",
  displayName: "Google Gemini",
  model: "gemini-2.5-flash",
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
  serverEnvVar: "GEMINI_API_KEY",
  supportsStreaming: true,
  maxTokensLimit: 65536,
  compatibleWith: "openai",
};
