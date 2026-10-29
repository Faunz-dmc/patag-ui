export type RecoveryLink = { tokenHash: string } | { accessToken: string } | { error: string };
export function readRecoveryLink(search: string, hash: string): RecoveryLink {
  const query = new URLSearchParams(search), fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const tokenHash = query.get('token_hash'), accessToken = fragment.get('access_token');
  if (query.has('error') || fragment.has('error') || (tokenHash && accessToken) ||
      (tokenHash && query.has('type') && query.get('type') !== 'recovery') ||
      (accessToken && fragment.get('type') !== 'recovery')) {
    return { error: 'This recovery link is invalid or expired. Request a new link from the sign-in page.' };
  }
  if (tokenHash) return { tokenHash };
  if (accessToken) return { accessToken };
  return { error: 'This recovery link is missing its token. Request a new link from the sign-in page.' };
}
