export const REVIEW_RESERVATION_MS = 5 * 60 * 1000;

export function getReviewReservationExpiry(now = new Date()) {
  return new Date(now.getTime() + REVIEW_RESERVATION_MS);
}

export function isReviewReservationActive(reservedUntil: string | null | undefined, now = new Date()) {
  return reservedUntil ? new Date(reservedUntil).getTime() > now.getTime() : false;
}
