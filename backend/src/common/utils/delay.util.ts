export function calculateTypingDelay(text: string): number {
  if (!text) {
    return 0;
  }
  
  const baseDelay = text.length * 15;
  const jitter = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
  
  return baseDelay + jitter;
}
