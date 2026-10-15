// Default values for browser actions
export const BROWSER_DEFAULTS = {
  // Common defaults
  headless: true,
  debug: false,
  timeout: 15000, // 15 seconds
  userDataDir: '_browser_profile', // Will be relative to project data dir
  retryOptions: {
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    retryOnErrors: ['TimeoutError', 'TargetClosedError', 'DetachedFrameError'],
  },

  // Viewport defaults
  viewportWidth: 1280,
  viewportHeight: 720,

  // Navigation defaults
  waitUntil: 'networkidle0' as const,

  // Click defaults
  waitForNavigation: false,
  button: 'left' as const,

  // Type defaults
  delay: 100, // 100ms between keystrokes

  // Screenshot defaults
  fullPage: false,
  screenshotCompression: 'jpeg' as const,
  screenshotCompressionQuality: 25,
  compressScreenshotData: true,

  // Advanced configuration defaults
  maxConsecutiveErrors: 3,
  totalErrorThreshold: 10,
} as const
