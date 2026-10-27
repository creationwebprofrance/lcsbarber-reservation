export const MEDIA_LIMITS = { imageBytes: 10 * 1024 * 1024, videoBytes: 50 * 1024 * 1024, videoSeconds: 60 };
export type PublicationStatus = 'draft' | 'processing' | 'published' | 'hidden' | 'error';
export function validateMedia(file: { type: string; size: number }, seconds?: number) {
  const image = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  const video = ['video/mp4', 'video/webm'].includes(file.type);
  if (!image && !video) return 'format';
  if (file.size <= 0 || file.size > (image ? MEDIA_LIMITS.imageBytes : MEDIA_LIMITS.videoBytes)) return 'size';
  if (video && seconds !== undefined && (!Number.isFinite(seconds) || seconds <= 0 || seconds > MEDIA_LIMITS.videoSeconds)) return 'duration';
  return null;
}
export function publicEligible(p: { status: PublicationStatus; ready: boolean; active: boolean; serviceActive: boolean; serviceProvider: string; provider: string }) {
  return p.status === 'published' && p.ready && p.active && p.serviceActive && p.serviceProvider === p.provider;
}
export function participantAllowed(userProvider: string | null, participants: string[]) {
  return userProvider !== null && participants.includes(userProvider);
}
export function bookingTarget(path: string | null, provider: string, service: string) {
  if (!path || path !== '/reservation') return null;
  return `${path}?blade_provider=${encodeURIComponent(provider)}&blade_service=${encodeURIComponent(service)}`;
}