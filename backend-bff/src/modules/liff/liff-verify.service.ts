import { createHash } from 'crypto';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';

interface CacheEntry {
  sub: string;
  expiresAt: number;
  lastAccess: number;
}

interface LineVerifyResponse {
  sub?: string;
  exp?: number;
  error?: string;
  error_description?: string;
}

const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';
const REQUEST_TIMEOUT_MS = 3_000;
const CACHE_MAX_ENTRIES = 1_000;
const CACHE_MAX_TTL_MS = 5 * 60 * 1_000;
const CACHE_EXP_SAFETY_MS = 10_000;
const SWEEP_INTERVAL_MS = 60_000;

@Injectable()
export class LiffVerifyService {
  private readonly logger = new Logger(LiffVerifyService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly i18n: I18nService) {
    setInterval(() => this.sweep(), SWEEP_INTERVAL_MS).unref();
  }

  async verify(idToken: string, channelId: string): Promise<{ sub: string }> {
    const cacheKey = this.hashKey(idToken, channelId);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      cached.lastAccess = Date.now();
      this.logger.debug(`verify cache hit ${cacheKey.slice(0, 8)}`);
      return { sub: cached.sub };
    }

    const body = new URLSearchParams({ id_token: idToken, client_id: channelId });
    const started = Date.now();

    let response: Response;
    try {
      response = await fetch(LINE_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.warn(
        `verify network error after ${Date.now() - started}ms: ${(err as Error).message}`,
      );
      throw new UnauthorizedException(this.i18n.t('errors.auth.liffVerifyFailed'));
    }

    const latency = Date.now() - started;

    let payload: LineVerifyResponse;
    try {
      payload = (await response.json()) as LineVerifyResponse;
    } catch {
      this.logger.warn(`verify non-JSON response (status=${response.status}, ${latency}ms)`);
      throw new UnauthorizedException(this.i18n.t('errors.auth.liffVerifyFailed'));
    }

    if (!response.ok || payload.error) {
      this.logger.warn(
        `verify rejected (status=${response.status}, error=${payload.error ?? 'http-error'}, ${latency}ms)`,
      );
      throw new UnauthorizedException(this.i18n.t('errors.auth.invalidLiffToken'));
    }

    if (!payload.sub || typeof payload.exp !== 'number') {
      this.logger.warn(`verify payload missing sub/exp (${latency}ms)`);
      throw new UnauthorizedException(this.i18n.t('errors.auth.invalidLiffToken'));
    }

    const expiresAtFromToken = payload.exp * 1_000 - CACHE_EXP_SAFETY_MS;
    if (expiresAtFromToken <= Date.now()) {
      this.logger.warn(`verify returned already-expired token (${latency}ms)`);
      throw new UnauthorizedException(this.i18n.t('errors.auth.invalidLiffToken'));
    }

    const expiresAt = Math.min(Date.now() + CACHE_MAX_TTL_MS, expiresAtFromToken);
    this.putInCache(cacheKey, { sub: payload.sub, expiresAt, lastAccess: Date.now() });
    this.logger.log(`verify ok (${latency}ms, cache-size=${this.cache.size})`);

    return { sub: payload.sub };
  }

  private hashKey(idToken: string, channelId: string): string {
    return createHash('sha256').update(`${channelId}:${idToken}`).digest('hex');
  }

  private putInCache(key: string, entry: CacheEntry): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      let oldestKey: string | null = null;
      let oldestAccess = Infinity;
      for (const [k, v] of this.cache) {
        if (v.lastAccess < oldestAccess) {
          oldestAccess = v.lastAccess;
          oldestKey = k;
        }
      }
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, entry);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
  }
}
