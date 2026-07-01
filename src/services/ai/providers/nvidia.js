/** Metadata del proveedor NVIDIA NIM. Compatible con API OpenAI. La llamada real ocurre en api/ai/generate.js */
export const nvidia = {
  name: "nvidia",
  displayName: "NVIDIA NIM",
  model: "nvidia/nemotron-3-ultra-550b-a55b",
  baseURL: "https://integrate.api.nvidia.com/v1",
  serverEnvVar: "NVIDIA_API_KEY",
  supportsStreaming: true,
  maxTokensLimit: 32768,
  compatibleWith: "openai",
};
