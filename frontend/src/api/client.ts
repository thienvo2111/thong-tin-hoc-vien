import { layToken, xoaToken } from '@/auth/tokenStore';
import { baoPhienHetHan } from '@/auth/session';
import type { ApiErrorBody, ApiFieldError } from './types';

export class ApiError extends Error {
  status: number;
  code: string;
  fields: ApiFieldError[];
  khoaDenLuc?: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.fields = body.fields ?? [];
    this.khoaDenLuc = body.khoa_den;
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

interface TuyChon extends RequestInit {
  /** false cho các endpoint công khai: đăng nhập, đăng ký, kiểm tra trùng */
  coXacThuc?: boolean;
}

export async function apiFetch<T>(path: string, tuyChon: TuyChon = {}): Promise<T> {
  const { coXacThuc = true, headers, body, ...rest } = tuyChon;
  const finalHeaders = new Headers(headers);
  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  if (coXacThuc) {
    const token = layToken();
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...rest, body, headers: finalHeaders });
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.' });
  }

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => undefined) : undefined;

  if (!res.ok) {
    if (res.status === 401 && coXacThuc) {
      xoaToken();
      baoPhienHetHan();
    }
    if (res.status === 429) {
      throw new ApiError(429, { code: 'TOO_MANY_REQUESTS', message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút' });
    }
    const errBody: ApiErrorBody = data?.error ?? { code: 'INTERNAL', message: 'Đã có lỗi xảy ra, thử lại sau.' };
    throw new ApiError(res.status, errBody);
  }

  return data as T;
}

/** Tải file nhị phân (Excel) — dùng cho các endpoint `/xuat-excel`, `/file-loi`, `/mau-excel`, và
 * POST xác nhận nạp tài khoản đơn vị (trả file mật khẩu tạm). Khác apiFetch: không set Content-Type,
 * trả về Blob thay vì JSON. */
export async function apiFetchBlob(path: string, init: Pick<RequestInit, 'method'> = {}): Promise<Blob> {
  const headers = new Headers();
  const token = layToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.' });
  }

  if (!res.ok) {
    if (res.status === 401) {
      xoaToken();
      baoPhienHetHan();
    }
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json().catch(() => undefined) : undefined;
    const errBody: ApiErrorBody = data?.error ?? { code: 'INTERNAL', message: 'Đã có lỗi xảy ra, thử lại sau.' };
    throw new ApiError(res.status, errBody);
  }

  return res.blob();
}
