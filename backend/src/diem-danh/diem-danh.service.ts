import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { HoTroGiangVienScopeService } from '../ho-tro-giang-vien/ho-tro-giang-vien-scope.service';
import { quyenSuaDiemDanh } from './quyen-sua-diem-danh.util';
import { SuaDiemDanhDto } from './diem-danh.dto';

const CHON_O = {
  lich_hoc_id: true,
  trang_thai: true,
  nguon: true,
  ghi_chu: true,
  tu_diem_danh_luc: true,
  cap_nhat_luc: true,
  sua_boi: { select: { ho_ten: true } },
} as const;

function oDiemDanh(d: {
  trang_thai: string;
  nguon: string;
  ghi_chu: string | null;
  tu_diem_danh_luc: Date | null;
  cap_nhat_luc: Date;
  sua_boi: { ho_ten: string } | null;
}) {
  return {
    trang_thai: d.trang_thai,
    nguon: d.nguon,
    ghi_chu: d.ghi_chu,
    tu_diem_danh_luc: d.tu_diem_danh_luc,
    cap_nhat_luc: d.cap_nhat_luc,
    nguoi_sua: d.sua_boi?.ho_ten ?? null,
  };
}

// ADR 0005 Z3/Z7, spec 2026-10-09 §7 (issue #26): bảng điểm danh học viên ×
// buổi của 1 lớp ở 1 giai đoạn (mọi loại lớp) + sửa nhanh từng ô. Quyền kiểm
// lại mỗi request (phạm vi khóa qua HoTroGiangVienScopeService).
@Injectable()
export class DiemDanhService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: HoTroGiangVienScopeService,
  ) {}

  async bangDiemDanh(
    user: AuthenticatedUser,
    lopId: string,
    giaiDoanId?: string,
    now: Date = new Date(),
  ) {
    if (user.vai_tro === 'ho_tro_giang_vien') {
      await this.scope.damBaoLopTrongPhamVi(user.id, lopId);
    }
    const lop = await this.prisma.lop_hoc.findUnique({
      where: { id: lopId },
      select: {
        id: true,
        ten_lop: true,
        loai_lop: true,
        khoa: { select: { id: true, ma_khoa: true, ten_khoa: true } },
      },
    });
    if (!lop) throw new NotFoundAppException('Không tìm thấy lớp học');

    const dsGiaiDoan = await this.prisma.giai_doan_khoa.findMany({
      where: { khoa_id: lop.khoa.id, lich_hoc: { some: { lop_id: lopId } } },
      select: {
        id: true,
        thu_tu: true,
        ten_giai_doan: true,
        hinh_thuc: true,
        lich_hoc: {
          where: { lop_id: lopId, thoi_gian_bat_dau: { lte: now } },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { thu_tu: 'asc' },
    });
    // Mặc định: giai đoạn gần nhất đã có buổi diễn ra, chưa có thì giai đoạn đầu.
    const chon = giaiDoanId
      ? dsGiaiDoan.find((g) => g.id === giaiDoanId)
      : ([...dsGiaiDoan].reverse().find((g) => g.lich_hoc.length > 0) ??
        dsGiaiDoan[0]);
    if (giaiDoanId && !chon) {
      throw new NotFoundAppException('Lớp không có buổi học ở giai đoạn này');
    }
    const giaiDoan = dsGiaiDoan.map(({ lich_hoc: _b, ...g }) => {
      void _b;
      return g;
    });
    if (!chon) {
      return {
        lop,
        giai_doan: giaiDoan,
        giai_doan_id: null,
        buoi: [],
        hoc_vien: [],
      };
    }
    const gdId = chon.id;
    const trongDot = { lich_hoc: { lop_id: lopId, giai_doan_id: gdId } };

    const [dsBuoi, dsPhanLop] = await Promise.all([
      this.prisma.lich_hoc_lop.findMany({
        where: { lop_id: lopId, giai_doan_id: gdId },
        select: {
          id: true,
          buoi_so: true,
          thoi_gian_bat_dau: true,
          thoi_gian_ket_thuc: true,
        },
        orderBy: [{ buoi_so: 'asc' }, { thoi_gian_bat_dau: 'asc' }],
      }),
      this.prisma.phan_lop_giai_doan.findMany({
        where: { lop_id: lopId, giai_doan_id: gdId },
        select: {
          dang_ky_hoc: {
            select: {
              id: true,
              hoc_vien: {
                select: {
                  ho_ten: true,
                  don_vi_cong_tac: { select: { ten_don_vi: true } },
                },
              },
              diem_danh: { where: trongDot, select: CHON_O },
              bao_vang: {
                where: trongDot,
                select: { lich_hoc_id: true, ly_do: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      lop,
      giai_doan: giaiDoan,
      giai_doan_id: gdId,
      buoi: dsBuoi.map((b) => ({
        ...b,
        ...quyenSuaDiemDanh(user.vai_tro, b.thoi_gian_bat_dau, now),
      })),
      hoc_vien: dsPhanLop
        .map(({ dang_ky_hoc: dk }) => ({
          dang_ky_hoc_id: dk.id,
          ho_ten: dk.hoc_vien.ho_ten,
          don_vi: dk.hoc_vien.don_vi_cong_tac.ten_don_vi,
          diem_danh: Object.fromEntries(
            dk.diem_danh.map((d) => [d.lich_hoc_id, oDiemDanh(d)]),
          ),
          bao_vang: Object.fromEntries(
            dk.bao_vang.map((b) => [b.lich_hoc_id, b.ly_do]),
          ),
        }))
        .sort((a, b) => a.ho_ten.localeCompare(b.ho_ten, 'vi')),
    };
  }

  async suaO(
    user: AuthenticatedUser,
    lopId: string,
    dto: SuaDiemDanhDto,
    now: Date = new Date(),
  ) {
    const buoi = await this.prisma.lich_hoc_lop.findUnique({
      where: { id: dto.lich_hoc_id },
      select: {
        lop_id: true,
        giai_doan_id: true,
        thoi_gian_bat_dau: true,
        lop: { select: { khoa_id: true } },
      },
    });
    if (!buoi || buoi.lop_id !== lopId) {
      throw new NotFoundAppException('Không tìm thấy buổi học của lớp');
    }
    if (
      user.vai_tro === 'ho_tro_giang_vien' &&
      !(await this.scope.khoaTrongPhamVi(user.id, buoi.lop.khoa_id))
    ) {
      throw new ForbiddenAppException(
        'Buổi học không thuộc khóa Thầy/Cô được phân công hỗ trợ',
      );
    }
    const quyen = quyenSuaDiemDanh(user.vai_tro, buoi.thoi_gian_bat_dau, now);
    if (quyen.ly_do === 'chua_dien_ra') {
      throw new ValidationException('Buổi học chưa diễn ra');
    }
    if (quyen.ly_do === 'qua_han') {
      throw new ForbiddenAppException(
        'Đã quá 3 ngày sau buổi học — liên hệ Quản trị để sửa điểm danh',
      );
    }
    if (!quyen.sua_duoc) throw new ForbiddenAppException();

    const thuocLop = await this.prisma.phan_lop_giai_doan.count({
      where: {
        dang_ky_hoc_id: dto.dang_ky_hoc_id,
        giai_doan_id: buoi.giai_doan_id,
        lop_id: lopId,
      },
    });
    if (!thuocLop) {
      throw new ValidationException(
        'Học viên không thuộc lớp của buổi học này ở giai đoạn đó',
      );
    }

    // Sửa tay: nguon = thu_cong, ghi người sửa; KHÔNG đụng tu_diem_danh_luc.
    const ghiChu = dto.ghi_chu?.normalize('NFC').trim() || null;
    const ghi = {
      trang_thai: dto.trang_thai,
      nguon: 'thu_cong' as const,
      ghi_chu: ghiChu,
      nguoi_sua: user.id,
      cap_nhat_luc: now,
    };
    const dd = await this.prisma.diem_danh.upsert({
      where: {
        dang_ky_hoc_id_lich_hoc_id: {
          dang_ky_hoc_id: dto.dang_ky_hoc_id,
          lich_hoc_id: dto.lich_hoc_id,
        },
      },
      create: {
        dang_ky_hoc_id: dto.dang_ky_hoc_id,
        lich_hoc_id: dto.lich_hoc_id,
        ...ghi,
      },
      update: ghi,
      select: CHON_O,
    });
    return {
      dang_ky_hoc_id: dto.dang_ky_hoc_id,
      lich_hoc_id: dto.lich_hoc_id,
      ...oDiemDanh(dd),
    };
  }
}
