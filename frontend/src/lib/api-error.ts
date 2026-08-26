export function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const err = error as {
      response?: { data?: { message?: string | string[]; error?: { message?: string } } };
    };
    const nestedMessage = err.response?.data?.error?.message;
    if (typeof nestedMessage === 'string' && nestedMessage) return nestedMessage;
    const message = err.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}
