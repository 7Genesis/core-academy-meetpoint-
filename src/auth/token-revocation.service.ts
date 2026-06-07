import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import net from 'node:net';
import tls from 'node:tls';

type RespValue = string | number | null;

@Injectable()
export class TokenRevocationService {
  private readonly logger = new Logger(TokenRevocationService.name);
  private readonly revokedJtis = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {}

  async revokeJti(jti: string | undefined, expiresAtUnixSeconds?: number) {
    if (!jti) return;

    const now = Math.floor(Date.now() / 1000);
    const ttlSeconds = Math.max((expiresAtUnixSeconds ?? now + 60) - now, 1);
    this.revokedJtis.set(jti, now + ttlSeconds);

    if (!this.configService.get<string>('REDIS_URL')) return;

    try {
      await this.redisCommand([
        'SET',
        this.key(jti),
        '1',
        'EX',
        String(ttlSeconds),
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to persist JWT revocation in Redis: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async isRevoked(jti: string | undefined) {
    if (!jti) return true;

    const now = Math.floor(Date.now() / 1000);
    const localExpiration = this.revokedJtis.get(jti);
    if (localExpiration && localExpiration > now) return true;
    if (localExpiration && localExpiration <= now) this.revokedJtis.delete(jti);

    if (!this.configService.get<string>('REDIS_URL')) return false;

    try {
      return (await this.redisCommand(['GET', this.key(jti)])) !== null;
    } catch (error) {
      this.logger.error(
        `Failed to check JWT revocation in Redis: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return false;
    }
  }

  private key(jti: string) {
    return `meetpoint:revoked-jti:${jti}`;
  }

  private async redisCommand(args: string[]): Promise<RespValue> {
    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
    const parsed = new URL(redisUrl);
    const port = Number(parsed.port || (parsed.protocol === 'rediss:' ? 6380 : 6379));
    const host = parsed.hostname;
    const authCommands: string[][] = [];

    if (parsed.password) {
      const username = decodeURIComponent(parsed.username || '');
      const password = decodeURIComponent(parsed.password);
      authCommands.push(username ? ['AUTH', username, password] : ['AUTH', password]);
    }

    const commands = [...authCommands, args, ['QUIT']];
    const commandResultIndex = commands.length - 2;
    const payload = commands.map(encodeRespCommand).join('');

    return new Promise((resolve, reject) => {
      const socket =
        parsed.protocol === 'rediss:'
          ? tls.connect({ host, port, servername: host })
          : net.connect({ host, port });
      const chunks: Buffer[] = [];

      socket.setTimeout(1_500);
      socket.on('connect', () => socket.write(payload));
      socket.on('data', (chunk: Buffer) => chunks.push(chunk));
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Redis command timeout'));
      });
      socket.on('error', reject);
      socket.on('end', () => {
        try {
          const responses = parseRespResponses(Buffer.concat(chunks));
          resolve(responses[commandResultIndex] ?? null);
        } catch (error) {
          reject(error);
        }
      });
      socket.on('close', () => {
        if (chunks.length === 0) reject(new Error('Redis connection closed'));
      });
    });
  }
}

function encodeRespCommand(args: string[]) {
  return `*${args.length}\r\n${args
    .map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`)
    .join('')}`;
}

function parseRespResponses(buffer: Buffer): RespValue[] {
  const text = buffer.toString('utf8');
  const responses: RespValue[] = [];
  let offset = 0;

  while (offset < text.length) {
    const type = text[offset];
    const lineEnd = text.indexOf('\r\n', offset);
    if (lineEnd === -1) break;
    const line = text.slice(offset + 1, lineEnd);

    if (type === '+') {
      responses.push(line);
      offset = lineEnd + 2;
      continue;
    }
    if (type === '-') {
      throw new Error(line);
    }
    if (type === ':') {
      responses.push(Number(line));
      offset = lineEnd + 2;
      continue;
    }
    if (type === '$') {
      const length = Number(line);
      if (length === -1) {
        responses.push(null);
        offset = lineEnd + 2;
        continue;
      }
      const start = lineEnd + 2;
      responses.push(text.slice(start, start + length));
      offset = start + length + 2;
      continue;
    }

    throw new Error('Unsupported Redis RESP response');
  }

  return responses;
}
