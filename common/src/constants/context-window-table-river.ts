/**
 * River's authenticated /v1/models publishes ids without windows. These exact
 * fallback rows are sourced from River's inference model documentation,
 * which reports a 1,048,576-token context window for each listed model.
 */
export const RIVER_CONTEXT_WINDOW_FALLBACKS: ReadonlyMap<string, number> =
  new Map([
    ['river/deepseek-ai/DeepSeek-V4.1-Flash', 1_048_576],
    ['river/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-NVFP4', 1_048_576],
    ['river/zai-org/GLM-5.3-Flash', 1_048_576],
  ])
