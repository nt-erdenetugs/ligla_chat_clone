export const generateLiffUrl = ({ loginLiffId, id }: { loginLiffId: string; id: string }) => {
  return `https://liff.line.me/${loginLiffId}?redirect_to=talk_room&operator_id=${id}`;
};

/**
 * Extracts the LINE channel ID from a LIFF ID.
 *
 * LINE issues LIFF IDs in the form `{numericChannelId}-{suffix}` (e.g. `1234567890-abcdef`),
 * where the numeric prefix is the channel ID used as `client_id` when verifying ID tokens
 * via the LINE verify endpoint. We derive the channel ID from `fileUploadLiffId` so each
 * organization can be verified against its own channel without storing it as a separate column.
 *
 * Returns `null` when the input is missing, has no dash, or the prefix is non-numeric —
 * callers must treat that as an unauthenticated request, since we cannot safely guess the
 * channel ID from a malformed LIFF ID.
 */
export function extractChannelIdFromLiffId(liffId: string | null): string | null {
  if (!liffId) return null;
  const dashIndex = liffId.indexOf('-');
  if (dashIndex <= 0) return null;
  const channelId = liffId.slice(0, dashIndex);
  return /^\d+$/.test(channelId) ? channelId : null;
}
