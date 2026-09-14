/**
 * Safe JSON Response parser & Fetch utilities
 * Prevents "Unexpected token 'T', The page c... is not valid JSON" errors
 * by validating Content-Type and gracefully extracting error messages from HTML/text responses.
 */

export interface SafeApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
  rawText?: string;
}

export async function parseApiResponse<T = any>(res: Response): Promise<SafeApiResponse<T>> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (isJson) {
    try {
      const json = await res.json();
      return {
        ok: res.ok,
        status: res.status,
        data: json?.data !== undefined ? json.data : json,
        message: json?.message,
        errors: json?.errors,
        rawText: typeof json === 'string' ? json : undefined,
      };
    } catch {
      // If parsing JSON header fails, fall back to text extraction below
    }
  }

  // Handle non-JSON responses (HTML error pages, 502/503 bad gateway, 404 text, etc.)
  try {
    const rawText = await res.text();
    
    // Attempt JSON parse in case content-type was missed
    try {
      const parsed = JSON.parse(rawText);
      return {
        ok: res.ok,
        status: res.status,
        data: parsed?.data !== undefined ? parsed.data : parsed,
        message: parsed?.message,
        errors: parsed?.errors,
        rawText,
      };
    } catch {
      // Plain text or HTML
    }

    // Strip HTML tags for clean error message display
    const cleanedText = rawText
      .replace(/<[^>]*>?/gm, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const displayMessage =
      cleanedText.length > 0 && cleanedText.length < 250
        ? cleanedText
        : `Server returned non-JSON response (HTTP ${res.status})`;

    return {
      ok: false, // HTML/non-JSON is not a successful API payload
      status: res.status,
      message: displayMessage,
      rawText,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: res.status,
      message: `HTTP ${res.status}: Failed to read response`,
    };
  }
}
