import { createHash, timingSafeEqual } from 'crypto';
import {
  SsoChuaCauHinhException,
  UnauthorizedAppException,
} from '../common/exceptions/app.exceptions';

/** So khớp API key thời gian hằng (băm trước để 2 buffer luôn cùng độ dài). */
function khopApiKey(guiLen: string, dung: string): boolean {
  const a = createHash('sha256').update(guiLen).digest();
  const b = createHash('sha256').update(dung).digest();
  return timingSafeEqual(a, b);
}

/** Xác thực máy chủ khảo sát (header X-API-Key) — dùng chung cho mọi route server-to-server. */
export function kiemTraApiKeyKhaoSat(apiKey: string | undefined): void {
  const khoaDung = process.env.SSO_KHAO_SAT_API_KEY;
  if (!khoaDung) throw new SsoChuaCauHinhException();
  if (!apiKey || !khopApiKey(apiKey, khoaDung)) {
    throw new UnauthorizedAppException('API key không hợp lệ');
  }
}
