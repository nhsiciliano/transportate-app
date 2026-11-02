/** Data URL base64 (import `?inline`) → bytes. */
export function fixtureBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
