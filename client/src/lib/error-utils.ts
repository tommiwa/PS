/**
 * Extract a user-friendly error message from an error object
 * Handles errors in the format: "statusCode: {json}" or plain strings
 */
export function getErrorMessage(error: unknown, fallback: string = "An error occurred"): string {
  if (!error) {
    return fallback;
  }

  // If it's an Error object, extract the message
  let message: string;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    return fallback;
  }

  // Try to extract JSON from the error message (format: "statusCode: {json}")
  try {
    const jsonStart = message.indexOf('{');
    if (jsonStart !== -1) {
      const jsonPart = message.substring(jsonStart);
      const errorData = JSON.parse(jsonPart);
      
      // Try different common error message fields
      if (errorData.message) {
        return errorData.message;
      }
      if (errorData.error) {
        return errorData.error;
      }
      if (errorData.details) {
        return errorData.details;
      }
    }
  } catch {
    // JSON parsing failed, continue to fallback logic
  }

  // Check if the message contains a status code prefix
  const statusCodeMatch = message.match(/^\d+:\s*(.+)/);
  if (statusCodeMatch) {
    const cleanMessage = statusCodeMatch[1].trim();
    // If it's not JSON (parsing failed above), return the clean message
    if (!cleanMessage.startsWith('{')) {
      return cleanMessage;
    }
  }

  // Return the original message if no parsing worked
  if (message && message.length > 0) {
    return message;
  }

  return fallback;
}
