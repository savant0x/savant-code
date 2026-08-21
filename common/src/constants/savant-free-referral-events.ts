/**
 * Analytics events for SavantFree referral attribution and redemption.
 *
 * These values remain aliased through AnalyticsEvent so consumers retain the
 * existing public enum access and runtime event set.
 */
export enum SavantFreeReferralAnalyticsEvent {
  REFERRER_ATTRIBUTED = 'savant-free.referrer_attributed',
  REFERRAL_REDEEMED = 'savant-free.referral.redeemed',
  REFERRAL_REDEEM_FAILED = 'savant-free.referral.redeem_failed',
  REFERRAL_SOCK_SIGNAL = 'savant-free.referral.sock_signal',
  REFERRAL_COMPLETED = 'savant-free.referral.completed',
  REFERRAL_SWEEP = 'savant-free.referral.sweep',
}
