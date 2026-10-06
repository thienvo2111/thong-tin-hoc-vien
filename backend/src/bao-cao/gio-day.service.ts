import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ForbiddenAppException,
  NotFoundAppException,
} from '../common/exceptions/app.exceptions';

export class GioDayQueryDto {
  @IsOptional()
  @IsUUID()
  khoa_id?: string;

  @IsOptional()
  @IsDateString()
  tu_ngay?: string;

  @IsOptional()
  @IsDateString()
  den_ngay?: string;
}

export interface GioDayRow {
  giang_vien_id: string;
  ho_ten: string;
  /** Chỉ Quản trị thấy (dữ liệu cá nhân giảng viên) — vai trò khác: không có field. */
  so_dien_thoai?: string;
  email?: string | null;
  ma_khoa: string;
  ten_lop: string;
  so_buoi: number;
  so_buoi_da_xac_nhan: number;
  tong_gio_da_xac_nhan: number;
}

export interface GioDayResult {
  rows: GioDayRow[];
  tong: {
    so_buoi: number;
    so_buoi_da_xac_nhan: number;
    tong_gio_da_xac_nhan: number;
  };
}

// T11 (issue #3, quyết định 2026-10-01): báo cáo giờ dạy — mỗi dòng =
// giảng viên × lớp. Chỉ CỘNG giờ của phân công da_xac_nhan_gio. Phạm vi:
// Quản trị mọi khóa; Sở/Phòng VHXH/Trường chỉ khóa xem được (R1/R2,
// getKhoaIdsXemDuoc) và KHÔNG thấy SĐT/email giảng viên.
@Injectable()
export class GioDayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
  ) {}

  async baoCao(
    query: GioDayQueryDto,
    caller: AuthenticatedUser,
  ): Promise<GioDayResult> {
    const laQuanTri = caller.vai_tro === 'quan_tri';
    const khoaIds = laQuanTri
      ? ('ALL' as const)
      : await this.scopeService.getKhoaIdsXemDuoc(caller);
    if (query.khoa_id) {
      const khoa = await this.prisma.khoa_boi_duong.findUnique({
        where: { id: query.khoa_id },
        select: { id: true },
      });
      if (!khoa)
        throw new NotFoundAppException('Không tìm thấy khóa bồi dưỡng');
      if (khoaIds !== 'ALL' && !khoaIds.includes(khoa.id)) {
        throw new ForbiddenAppException(
          'Khóa này nằm ngoài phạm vi quyền của tài khoản hiện tại',
        );
      }
    }

    const lop: Prisma.lop_hocWhereInput = query.khoa_id
      ? { khoa_id: query.khoa_id }
      : khoaIds === 'ALL'
        ? {}
        : { khoa_id: { in: khoaIds } };
    const gio: Prisma.DateTimeFilter = {};
    if (query.tu_ngay) gio.gte = new Date(query.tu_ngay);
    if (query.den_ngay) gio.lte = new Date(query.den_ngay);

    const dsPhanCong = await this.prisma.phan_cong_giang_day.findMany({
      where: {
        lich_hoc: {
          lop,
          ...(query.tu_ngay || query.den_ngay
            ? { thoi_gian_bat_dau: gio }
            : {}),
        },
      },
      select: {
        so_gio: true,
        da_xac_nhan_gio: true,
        giang_vien: {
          select: { id: true, ho_ten: true, so_dien_thoai: true, email: true },
        },
        lich_hoc: {
          select: {
            lop: {
              select: {
                id: true,
                ten_lop: true,
                khoa: { select: { ma_khoa: true } },
              },
            },
          },
        },
      },
    });

    const theoDong = new Map<string, GioDayRow>();
    for (const pc of dsPhanCong) {
      const {
        giang_vien: gv,
        lich_hoc: { lop: l },
      } = pc;
      const khoa = `${gv.id}|${l.id}`;
      let dong = theoDong.get(khoa);
      if (!dong) {
        dong = {
          giang_vien_id: gv.id,
          ho_ten: gv.ho_ten,
          ...(laQuanTri
            ? { so_dien_thoai: gv.so_dien_thoai, email: gv.email }
            : {}),
          ma_khoa: l.khoa.ma_khoa,
          ten_lop: l.ten_lop,
          so_buoi: 0,
          so_buoi_da_xac_nhan: 0,
          tong_gio_da_xac_nhan: 0,
        };
        theoDong.set(khoa, dong);
      }
      dong.so_buoi++;
      if (pc.da_xac_nhan_gio) {
        dong.so_buoi_da_xac_nhan++;
        dong.tong_gio_da_xac_nhan += Number(pc.so_gio ?? 0);
      }
    }
    const rows = [...theoDong.values()].sort(
      (a, b) =>
        a.ho_ten.localeCompare(b.ho_ten, 'vi') ||
        a.ma_khoa.localeCompare(b.ma_khoa) ||
        a.ten_lop.localeCompare(b.ten_lop, 'vi'),
    );
    const tong = rows.reduce(
      (t, r) => ({
        so_buoi: t.so_buoi + r.so_buoi,
        so_buoi_da_xac_nhan: t.so_buoi_da_xac_nhan + r.so_buoi_da_xac_nhan,
        tong_gio_da_xac_nhan: t.tong_gio_da_xac_nhan + r.tong_gio_da_xac_nhan,
      }),
      { so_buoi: 0, so_buoi_da_xac_nhan: 0, tong_gio_da_xac_nhan: 0 },
    );
    return { rows, tong };
  }
}

export async function buildGioDayWorkbook(
  result: GioDayResult,
  laQuanTri: boolean,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Giờ dạy');
  sheet.addRow([
    'Giảng viên',
    ...(laQuanTri ? ['Số điện thoại', 'Email'] : []),
    'Mã khóa',
    'Lớp',
    'Số buổi phân công',
    'Số buổi đã xác nhận giờ',
    'Tổng giờ đã xác nhận',
  ]);
  sheet.getRow(1).font = { bold: true };
  for (const r of result.rows) {
    sheet.addRow([
      r.ho_ten,
      ...(laQuanTri ? [r.so_dien_thoai ?? '', r.email ?? ''] : []),
      r.ma_khoa,
      r.ten_lop,
      r.so_buoi,
      r.so_buoi_da_xac_nhan,
      r.tong_gio_da_xac_nhan,
    ]);
  }
  sheet.addRow([
    'Tổng cộng',
    ...(laQuanTri ? ['', ''] : []),
    '',
    '',
    result.tong.so_buoi,
    result.tong.so_buoi_da_xac_nhan,
    result.tong.tong_gio_da_xac_nhan,
  ]);
  sheet.getRow(sheet.rowCount).font = { bold: true };
  sheet.columns.forEach((c) => (c.width = 20));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
