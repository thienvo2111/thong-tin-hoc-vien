import { Injectable } from '@nestjs/common';
import { loai_muc_kiem_tra, trang_thai_active } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { DiemHocService } from '../diem-hoc/diem-hoc.service';
import { layDotLop } from '../trang-lop/trang-lop.service';
import { mauDot, QUY_TAC, tinhHan, trangThaiMuc } from './quy-tac';

export interface LuuMucDto {
  ten?: string;
  mo_ta?: string | null;
  loai?: loai_muc_kiem_tra;
  ma_quy_tac?: string | null;
  han_truoc_ngay?: number | null;
  thu_tu?: number;
  trang_thai?: trang_thai_active;
}

// ADR 0004 G5b (issue #17): bảng kiểm chuẩn bị đợt trực tiếp, động theo khóa.
@Injectable()
export class BangKiemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diemHoc: DiemHocService,
  ) {}

  dsQuyTac() {
    return Object.entries(QUY_TAC).map(([ma, q]) => ({ ma, ten: q.ten }));
  }

  /** Bộ mục đang áp dụng: mục riêng của khóa nếu có, ngược lại bộ mặc định. */
  async boCuaKhoa(khoaId: string | null, kemNgung = false) {
    const loc = kemNgung ? {} : { trang_thai: 'active' as const };
    if (khoaId) {
      const rieng = await this.prisma.muc_kiem_tra.findMany({
        where: { khoa_id: khoaId, ...loc },
        orderBy: { thu_tu: 'asc' },
      });
      const coRieng =
        rieng.length > 0 ||
        (await this.prisma.muc_kiem_tra.count({ where: { khoa_id: khoaId } })) >
          0;
      if (coRieng) return { nguon: 'rieng' as const, muc: rieng };
    }
    const macDinh = await this.prisma.muc_kiem_tra.findMany({
      where: { khoa_id: null, ...loc },
      orderBy: { thu_tu: 'asc' },
    });
    return { nguon: 'mac_dinh' as const, muc: macDinh };
  }

  async tuyChinhChoKhoa(khoaId: string) {
    const khoa = await this.prisma.khoa_boi_duong.count({
      where: { id: khoaId },
    });
    if (!khoa) throw new NotFoundAppException('Không tìm thấy khóa bồi dưỡng');
    if (await this.prisma.muc_kiem_tra.count({ where: { khoa_id: khoaId } })) {
      throw new ConflictAppException('Khóa đã có bảng kiểm riêng');
    }
    const macDinh = await this.prisma.muc_kiem_tra.findMany({
      where: { khoa_id: null, trang_thai: 'active' },
      orderBy: { thu_tu: 'asc' },
    });
    await this.prisma.muc_kiem_tra.createMany({
      data: macDinh.map(({ id: _i, created_at: _c, ...m }) => {
        void _i;
        void _c;
        return { ...m, khoa_id: khoaId };
      }),
    });
    return this.boCuaKhoa(khoaId, true);
  }

  private kiemTraMuc(dto: LuuMucDto, loaiCu?: loai_muc_kiem_tra) {
    const loai = dto.loai ?? loaiCu;
    if (loai === 'tu_dong') {
      if (
        dto.ma_quy_tac !== undefined &&
        (!dto.ma_quy_tac || !QUY_TAC[dto.ma_quy_tac])
      ) {
        throw new ValidationException(
          'Quy tắc tự động không có trong danh mục',
          [{ field: 'ma_quy_tac', message: 'Không hợp lệ' }],
        );
      }
    }
    if (
      dto.han_truoc_ngay != null &&
      (dto.han_truoc_ngay < 0 || dto.han_truoc_ngay > 365)
    ) {
      throw new ValidationException('Hạn phải từ 0 đến 365 ngày', [
        { field: 'han_truoc_ngay', message: 'Không hợp lệ' },
      ]);
    }
  }

  /** Thêm mục vào bộ mặc định (khoaId null) hoặc bộ riêng của khóa (phải tùy chỉnh trước). */
  async themMuc(khoaId: string | null, dto: LuuMucDto) {
    if (!dto.ten?.trim() || !dto.loai) {
      throw new ValidationException('Thiếu tên hoặc loại mục', [
        { field: 'ten', message: 'Bắt buộc' },
      ]);
    }
    if (dto.loai === 'tu_dong' && !dto.ma_quy_tac) {
      throw new ValidationException('Mục tự động phải chọn quy tắc', [
        { field: 'ma_quy_tac', message: 'Bắt buộc' },
      ]);
    }
    this.kiemTraMuc(dto);
    if (
      khoaId &&
      !(await this.prisma.muc_kiem_tra.count({ where: { khoa_id: khoaId } }))
    ) {
      throw new ConflictAppException(
        'Khóa đang dùng bộ mặc định — bấm "Tùy chỉnh cho khóa" trước',
      );
    }
    const cuoi = await this.prisma.muc_kiem_tra.aggregate({
      where: { khoa_id: khoaId },
      _max: { thu_tu: true },
    });
    return this.prisma.muc_kiem_tra.create({
      data: {
        khoa_id: khoaId,
        thu_tu: dto.thu_tu ?? (cuoi._max.thu_tu ?? 0) + 1,
        ten: dto.ten.trim(),
        mo_ta: dto.mo_ta?.trim() || null,
        loai: dto.loai,
        ma_quy_tac: dto.loai === 'tu_dong' ? dto.ma_quy_tac : null,
        han_truoc_ngay: dto.han_truoc_ngay ?? null,
      },
    });
  }

  // Sửa tên/hạn/thứ tự/ngưng giữ nguyên trạng thái đã đánh dấu; không đổi loại.
  async suaMuc(mucId: string, dto: LuuMucDto) {
    const cu = await this.prisma.muc_kiem_tra.findUnique({
      where: { id: mucId },
    });
    if (!cu) throw new NotFoundAppException('Không tìm thấy mục bảng kiểm');
    if (dto.loai && dto.loai !== cu.loai) {
      throw new ValidationException(
        'Không đổi loại mục — ngưng mục này và thêm mục mới',
      );
    }
    this.kiemTraMuc(dto, cu.loai);
    return this.prisma.muc_kiem_tra.update({
      where: { id: mucId },
      data: {
        ten: dto.ten?.trim() || undefined,
        mo_ta: dto.mo_ta,
        ma_quy_tac:
          cu.loai === 'tu_dong' ? (dto.ma_quy_tac ?? undefined) : undefined,
        han_truoc_ngay: dto.han_truoc_ngay,
        thu_tu: dto.thu_tu,
        trang_thai: dto.trang_thai,
      },
    });
  }

  /** Đánh giá bảng kiểm của 1 đợt (lớp × giai đoạn trực tiếp). */
  async danhGiaDot(lopId: string, gdId: string, bayGio = new Date()) {
    const dot = await layDotLop(this.prisma, lopId, gdId);
    const { nguon, muc } = await this.boCuaKhoa(dot.lop.khoa.id);
    const canhBaoSoPhong = (
      await Promise.all(
        dot.buoi
          .filter((b) => b.diem_hoc)
          .map((b) =>
            this.diemHoc.canhBaoVuotSoPhong({
              diem_hoc_id: b.diem_hoc!.id,
              lop_id: lopId,
              bat_dau: b.thoi_gian_bat_dau,
              ket_thuc: b.thoi_gian_ket_thuc,
            }),
          ),
      )
    ).flat();
    const thuCong = await this.prisma.trang_thai_muc_kiem_tra.findMany({
      where: {
        lop_id: lopId,
        giai_doan_id: gdId,
        muc_id: { in: muc.map((m) => m.id) },
      },
      include: { nguoi_sua: { select: { ho_ten: true } } },
    });
    const buoiDau = dot.buoi.length
      ? new Date(
          Math.min(...dot.buoi.map((b) => b.thoi_gian_bat_dau.getTime())),
        )
      : null;

    const ketQua = muc.map((m) => {
      const han = tinhHan(buoiDau, m.han_truoc_ngay);
      if (m.loai === 'tu_dong') {
        const q = QUY_TAC[m.ma_quy_tac ?? ''];
        const kq = q
          ? q.kiemTra({ dot, canhBaoSoPhong })
          : { dat: false, ly_do: 'Quy tắc không còn trong hệ thống' };
        return {
          muc_id: m.id,
          ten: m.ten,
          loai: m.loai,
          ma_quy_tac: m.ma_quy_tac,
          han,
          trang_thai: trangThaiMuc(kq.dat, han, bayGio),
          ly_do: kq.ly_do,
          ghi_chu: null as string | null,
          cap_nhat_boi: null as string | null,
          cap_nhat_luc: null as Date | null,
        };
      }
      const tt = thuCong.find((t) => t.muc_id === m.id);
      return {
        muc_id: m.id,
        ten: m.ten,
        loai: m.loai,
        ma_quy_tac: null,
        han,
        trang_thai: trangThaiMuc(!!tt?.da_xong, han, bayGio),
        ly_do: null,
        ghi_chu: tt?.ghi_chu ?? null,
        cap_nhat_boi: tt?.nguoi_sua?.ho_ten ?? null,
        cap_nhat_luc: tt?.cap_nhat_luc ?? null,
      };
    });
    return {
      lop: dot.lop,
      giai_doan: dot.giai_doan,
      buoi_dau: buoiDau,
      nguon,
      mau: mauDot(ketQua.map((k) => k.trang_thai)),
      muc: ketQua,
    };
  }

  /** Đánh dấu mục THỦ CÔNG của đợt (mục tự động → 400; mục không thuộc bộ của khóa → 404). */
  async danhDauThuCong(
    user: AuthenticatedUser,
    lopId: string,
    gdId: string,
    mucId: string,
    dto: { da_xong: boolean; ghi_chu?: string | null },
  ) {
    const lop = await this.prisma.lop_hoc.findUniqueOrThrow({
      where: { id: lopId },
      select: { khoa_id: true },
    });
    const { muc } = await this.boCuaKhoa(lop.khoa_id);
    const m = muc.find((x) => x.id === mucId);
    if (!m)
      throw new NotFoundAppException('Mục không thuộc bảng kiểm của khóa');
    if (m.loai === 'tu_dong') {
      throw new ValidationException(
        'Mục tự động do hệ thống tính — không đánh dấu tay',
      );
    }
    return this.prisma.trang_thai_muc_kiem_tra.upsert({
      where: {
        muc_id_lop_id_giai_doan_id: {
          muc_id: mucId,
          lop_id: lopId,
          giai_doan_id: gdId,
        },
      },
      create: {
        muc_id: mucId,
        lop_id: lopId,
        giai_doan_id: gdId,
        da_xong: dto.da_xong,
        ghi_chu: dto.ghi_chu?.trim() || null,
        cap_nhat_boi: user.id,
      },
      update: {
        da_xong: dto.da_xong,
        ghi_chu:
          dto.ghi_chu === undefined ? undefined : dto.ghi_chu?.trim() || null,
        cap_nhat_boi: user.id,
        cap_nhat_luc: new Date(),
      },
    });
  }
}
