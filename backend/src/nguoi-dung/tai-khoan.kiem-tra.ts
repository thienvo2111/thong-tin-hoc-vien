import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { laTenDangNhapHopLe } from './tai-khoan-don-vi.util';

// Kiểm tra dùng chung cho các loại tài khoản do Quản trị cấp: tài khoản đơn
// vị (ADR 0002) và người hỗ trợ học viên (ADR 0003).

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const THONG_DIEP_TAI_KHOAN = {
  TEN_SAI_DINH_DANG: 'Chỉ gồm chữ thường không dấu, số, . _ - (3–50 ký tự)',
  TEN_TRUNG: 'Tên đăng nhập đã được dùng',
  EMAIL_SAI: 'Email không hợp lệ',
  EMAIL_TRUNG: 'Email đã được dùng',
} as const;

export type LoiTaiKhoan = { field: string; message: string; status: 400 | 409 };

export function chuanHoaEmail(raw: string | undefined): string | null {
  const s = raw?.trim().toLowerCase();
  return s ? s : null;
}

export async function kiemTraTenDangNhap(
  prisma: PrismaService,
  ten: string,
  boQuaId?: string,
): Promise<LoiTaiKhoan[]> {
  if (!laTenDangNhapHopLe(ten)) {
    return [
      {
        field: 'ten_dang_nhap',
        message: THONG_DIEP_TAI_KHOAN.TEN_SAI_DINH_DANG,
        status: 400,
      },
    ];
  }
  const trung = await prisma.nguoi_dung.findFirst({
    where: {
      ten_dang_nhap: { equals: ten, mode: 'insensitive' },
      ...(boQuaId ? { id: { not: boQuaId } } : {}),
    },
    select: { id: true },
  });
  return trung
    ? [
        {
          field: 'ten_dang_nhap',
          message: THONG_DIEP_TAI_KHOAN.TEN_TRUNG,
          status: 409,
        },
      ]
    : [];
}

export async function kiemTraEmail(
  prisma: PrismaService,
  email: string,
  boQuaId?: string,
): Promise<LoiTaiKhoan[]> {
  if (!EMAIL_REGEX.test(email)) {
    return [
      { field: 'email', message: THONG_DIEP_TAI_KHOAN.EMAIL_SAI, status: 400 },
    ];
  }
  const trung = await prisma.nguoi_dung.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      ...(boQuaId ? { id: { not: boQuaId } } : {}),
    },
    select: { id: true },
  });
  return trung
    ? [
        {
          field: 'email',
          message: THONG_DIEP_TAI_KHOAN.EMAIL_TRUNG,
          status: 409,
        },
      ]
    : [];
}

// Lỗi định dạng (400) ưu tiên hơn lỗi trùng (409) khi có cả hai.
export function nemLoiTaiKhoan(loi: LoiTaiKhoan[]): never {
  const fields = loi.map(({ field, message }) => ({ field, message }));
  if (loi.some((l) => l.status === 400)) {
    throw new ValidationException('Dữ liệu tài khoản không hợp lệ', fields);
  }
  throw new ConflictAppException(loi[0].message, fields);
}

// Phòng tranh chấp đồng thời: kiểm tra trước đã qua nhưng unique của DB chặn.
// `khac` = field/message khi unique vi phạm không phải tên đăng nhập/email.
export function mapLoiUniqueTaiKhoan(
  e: unknown,
  khac: { field: string; message: string },
): unknown {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    const target = String(
      (e.meta?.target as string[] | string | undefined) ?? '',
    );
    const { field, message } = target.includes('ten_dang_nhap')
      ? { field: 'ten_dang_nhap', message: THONG_DIEP_TAI_KHOAN.TEN_TRUNG }
      : target.includes('email')
        ? { field: 'email', message: THONG_DIEP_TAI_KHOAN.EMAIL_TRUNG }
        : khac;
    return new ConflictAppException(message, [{ field, message }]);
  }
  return e;
}
