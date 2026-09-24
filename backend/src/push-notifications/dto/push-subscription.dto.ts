import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const BLOCKED_HOSTNAME_SUFFIXES = /(^|\.)(local|internal|localhost)$/i;
const PRIVATE_IP_PATTERN =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0)/;
const NUMERIC_HOST = /^[0-9.]+$/;
const IPV6_LOOPBACK = /\[(::1|0:0:0:0:0:0:0:1)\]|\[::\]/;

/**
 * Push subscription endpoints can hold an arbitrary URL. Sending a push to an
 * attacker-chosen internal host is a classic SSRF vector, so subscriptions are
 * restricted to public HTTPS endpoints (no private/link-local hosts, no
 * *.local / *.internal names, no raw IP addresses).
 */
export function isSafePushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (!url.hostname || url.hostname.length > 253) return false;
  if (BLOCKED_HOSTNAME_SUFFIXES.test(url.hostname)) return false;
  if (PRIVATE_IP_PATTERN.test(url.hostname)) return false;
  if (NUMERIC_HOST.test(url.hostname)) return false;
  if (url.hostname.includes('[') && IPV6_LOOPBACK.test(url.hostname)) return false;
  return true;
}

@ValidatorConstraint({ name: 'isSafePushEndpoint', async: false })
class IsSafePushEndpointConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isSafePushEndpoint(value);
  }

  defaultMessage(): string {
    return 'endpoint must be a public HTTPS push endpoint';
  }
}

const KEY_PATTERN = /^[A-Za-z0-9+/_=-]{16,1024}$/;

export class CreatePushSubscriptionDto {
  @IsString()
  @MaxLength(2048)
  @Validate(IsSafePushEndpointConstraint)
  endpoint!: string;

  @IsString()
  @Matches(KEY_PATTERN)
  p256dh!: string;

  @IsString()
  @Matches(KEY_PATTERN)
  auth!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}

export class DeletePushSubscriptionDto {
  @IsString()
  @MaxLength(2048)
  endpoint!: string;
}