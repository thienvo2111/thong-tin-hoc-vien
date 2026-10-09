import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ket_qua_khao_sat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  boSo0DauDeTimKiem,
  timHocVienIdTheoMaMoet,
} from '../common/utils/ma-moet.util';
import { ThangMucService, nhanMucGoc } from './thang-muc.service';
import {
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { paginate } from '../common/dto/pagination-query.dto';
import {
  BaoKetQuaDto,
  LOAI_KHAO_SAT,
  LoaiKhaoSat,
  LocTinhHinh,
  MucNangLuc,
  QueryTinhHinhKhaoSatDto,
  TrangThaiBaoVe,
} from './dto/ket-qua-khao-sat.dto';

// Kết quả khảo sát từ hệ thống khảo sát (2026-10-04, api-contract.md mục 10).
// Nguồn ghi: 'sso' (cổng tự ghi `da_mo` khi đổi mã), 'api' (máy chủ khảo sát
// báo về POST /sso/ket-qua), 'import' (quản trị nhập Excel dự phòng).
// Không tự cập nhật hoc_vien.muc_dau_vao — quản trị xác nhận riêng.

const SSO_URL_MAC_DINH = 'https://khaosatnls.hcmue.edu.vn/sso/start';

/** url_ket_qua phải là http(s) và CÙNG tên miền hệ thống khảo sát — học viên sẽ bấm mở link này. */
function kiemTraUrlKetQua(url: string): string {
  const loi = () =>
    new ValidationException('Đường dẫn kết quả không hợp lệ', [
      {
        field: 'url_ket_qua',
        message: 'Phải là http(s) thuộc tên miền hệ thống khảo sát',
      },
    ]);
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    throw loi();
  }
  const mienKhaoSat = new URL(process.env.SSO_KHAO_SAT_URL || SSO_URL_MAC_DINH)
    .host;
  if (!['http:', 'https:'].includes(u.protocol) || u.host !== mienKhaoSat) {
    throw loi();
  }
  return u.toString();
}

/** Đã mở / đang làm mà quá mốc này không có cập nhật -> "cần kiểm tra lại". */
export const NGUONG_CAN_KIEM_TRA_MS = 24 * 60 * 60 * 1000;

export type NguonKetQua = 'sso' | 'api' | 'import';

export interface KetQuaVao {
  loai: LoaiKhaoSat;
  trang_thai: TrangThaiBaoVe;
  thoi_diem?: Date;
  muc?: MucNangLuc | null;
  diem?: number | null;
  diem_toi_da?: number | null;
  muc_goc?: string | null;
  url_ket_qua?: string | null;
  chi_tiet?: Record<string, unknown> | null;
}

export interface TinhTrangBai {
  loai: LoaiKhaoSat;
  trang_thai: 'chua_lam' | 'da_mo' | 'dang_lam' | 'hoan_thanh';
  can_kiem_tra: boolean;
  mo_gan_nhat_luc: Date | null;
  hoan_thanh_luc: Date | null;
  muc: MucNangLuc | null;
  muc_goc: string | null;
  /** Nhãn hiển thị theo thang quản trị cấu hình, vd "M1 – Chưa đạt". */
  nhan_muc_goc: string | null;
  url_ket_qua: string | null;
}

function canKiemTra(
  kq: Pick<ket_qua_khao_sat, 'trang_thai' | 'cap_nhat_luc'>,
  now = Date.now(),
): boolean {
  return (
    kq.trang_thai !== 'hoan_thanh' &&
    now - kq.cap_nhat_luc.getTime() > NGUONG_CAN_KIEM_TRA_MS
  );
}

@Injectable()
export class KetQuaKhaoSatService {
  private readonly logger = new Logger(KetQuaKhaoSatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly thangMuc: ThangMucService,
  ) {}

  // Gọi từ SsoService.doiMa — học viên vừa thực sự tới trang khảo sát. Chỉ
  // tăng bộ đếm, KHÔNG hạ trạng thái (đang làm / hoàn thành giữ nguyên). Lỗi ở
  // đây không được làm hỏng đăng nhập SSO, nên nuốt và ghi log.
  async ghiDaMo(hocVienId: string, loai: LoaiKhaoSat): Promise<void> {
    const now = new Date();
    try {
      await this.prisma.ket_qua_khao_sat.upsert({
        where: { hoc_vien_id_loai: { hoc_vien_id: hocVienId, loai } },
        create: {
          hoc_vien_id: hocVienId,
          loai,
          trang_thai: 'da_mo',
          so_lan_mo: 1,
          mo_lan_dau_luc: now,
          mo_gan_nhat_luc: now,
          nguon: 'sso',
          cap_nhat_luc: now,
        },
        update: {
          so_lan_mo: { increment: 1 },
          mo_gan_nhat_luc: now,
          cap_nhat_luc: now,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Không ghi được trạng thái đã mở khảo sát (${loai}): ${String(err)}`,
      );
    }
  }

  // POST /sso/ket-qua — đã qua kiểm tra API key ở controller.
  async nhanKetQua(dto: BaoKetQuaDto) {
    const hocVienId = await this.timHocVien(dto);
    const kq = await this.ghiKetQua(
      hocVienId,
      {
        loai: dto.loai,
        trang_thai: dto.trang_thai,
        thoi_diem: dto.thoi_diem ? new Date(dto.thoi_diem) : undefined,
        muc: dto.muc,
        diem: dto.diem,
        diem_toi_da: dto.diem_toi_da,
        muc_goc: dto.muc_goc,
        url_ket_qua: dto.url_ket_qua,
        chi_tiet: dto.chi_tiet,
      },
      'api',
    );
    return {
      hoc_vien_id: hocVienId,
      loai: kq.loai,
      trang_thai: kq.trang_thai,
      muc: kq.muc,
      muc_goc: kq.muc_goc,
    };
  }

  private async timHocVien(dto: BaoKetQuaDto): Promise<string> {
    if (!dto.hoc_vien_id && !dto.ma_dinh_danh_moet) {
      throw new ValidationException(
        'Cần hoc_vien_id hoặc ma_dinh_danh_moet để xác định học viên',
        [{ field: 'hoc_vien_id', message: 'Bắt buộc 1 trong 2 trường' }],
      );
    }
    if (!dto.hoc_vien_id) {
      // Spec 2026-10-09 Q-A: khớp cả khi lệch số 0 đầu (đúng 1 học viên).
      const id = await timHocVienIdTheoMaMoet(
        this.prisma,
        dto.ma_dinh_danh_moet,
      );
      if (!id) throw new NotFoundAppException('Không tìm thấy học viên');
      return id;
    }
    const hv = await this.prisma.hoc_vien.findUnique({
      where: { id: dto.hoc_vien_id },
      select: { id: true },
    });
    if (!hv) throw new NotFoundAppException('Không tìm thấy học viên');
    return hv.id;
  }

  // Quy tắc gộp (dùng chung API + import):
  //  - `dang_lam` không đè `hoan_thanh` (báo muộn / trùng lặp).
  //  - `hoan_thanh` luôn ghi đè mức/điểm (cho phép làm lại), TRỪ khi thời
  //    điểm báo cũ hơn lần hoàn thành đã ghi (gói tin đến trễ, lệch thứ tự).
  async ghiKetQua(
    hocVienId: string,
    vao: KetQuaVao,
    nguon: NguonKetQua,
  ): Promise<ket_qua_khao_sat> {
    if (
      vao.diem != null &&
      vao.diem_toi_da != null &&
      vao.diem > vao.diem_toi_da
    ) {
      throw new ValidationException('Điểm lớn hơn điểm tối đa', [
        { field: 'diem', message: 'Không được lớn hơn diem_toi_da' },
      ]);
    }
    if (vao.muc_goc) await this.thangMuc.kiemTraMa(vao.muc_goc);
    const urlKetQua = vao.url_ket_qua?.trim()
      ? kiemTraUrlKetQua(vao.url_ket_qua)
      : null;
    const now = new Date();
    const thoiDiem = vao.thoi_diem ?? now;
    const cu = await this.prisma.ket_qua_khao_sat.findUnique({
      where: { hoc_vien_id_loai: { hoc_vien_id: hocVienId, loai: vao.loai } },
    });

    if (cu?.trang_thai === 'hoan_thanh') {
      const boQua =
        vao.trang_thai === 'dang_lam' ||
        (cu.hoan_thanh_luc !== null && thoiDiem < cu.hoan_thanh_luc);
      if (boQua) return cu;
    }

    const data =
      vao.trang_thai === 'hoan_thanh'
        ? {
            trang_thai: 'hoan_thanh' as const,
            hoan_thanh_luc: thoiDiem,
            muc: vao.muc ?? null,
            diem: vao.diem ?? null,
            diem_toi_da: vao.diem_toi_da ?? null,
            muc_goc: vao.muc_goc ?? null,
            url_ket_qua: urlKetQua,
            chi_tiet: (vao.chi_tiet ?? Prisma.DbNull) as
              Prisma.InputJsonValue | typeof Prisma.DbNull,
          }
        : {
            trang_thai: 'dang_lam' as const,
            bat_dau_luc: cu?.bat_dau_luc ?? thoiDiem,
          };

    return this.prisma.ket_qua_khao_sat.upsert({
      where: { hoc_vien_id_loai: { hoc_vien_id: hocVienId, loai: vao.loai } },
      create: {
        hoc_vien_id: hocVienId,
        loai: vao.loai,
        nguon,
        cap_nhat_luc: now,
        ...data,
      },
      update: { nguon, cap_nhat_luc: now, ...data },
    });
  }

  // GET /sso/tinh-trang (học viên) — đủ mọi loại bài, không lộ điểm/chi tiết.
  async tinhTrangCuaHocVien(hocVienId: string): Promise<TinhTrangBai[]> {
    const [rows, thang] = await Promise.all([
      this.prisma.ket_qua_khao_sat.findMany({
        where: { hoc_vien_id: hocVienId },
      }),
      this.thangMuc.thang(),
    ]);
    const now = Date.now();
    return LOAI_KHAO_SAT.map((loai) => {
      const kq = rows.find((r) => r.loai === loai);
      if (!kq) {
        return {
          loai,
          trang_thai: 'chua_lam',
          can_kiem_tra: false,
          mo_gan_nhat_luc: null,
          hoan_thanh_luc: null,
          muc: null,
          muc_goc: null,
          nhan_muc_goc: null,
          url_ket_qua: null,
        };
      }
      return {
        loai,
        trang_thai: kq.trang_thai,
        can_kiem_tra: canKiemTra(kq, now),
        mo_gan_nhat_luc: kq.mo_gan_nhat_luc,
        hoan_thanh_luc: kq.hoan_thanh_luc,
        muc: kq.muc,
        muc_goc: kq.muc_goc,
        nhan_muc_goc: nhanMucGoc(kq.muc_goc, thang),
        url_ket_qua: kq.url_ket_qua,
      };
    });
  }

  private phamViHocVien(khoaId?: string): Prisma.hoc_vienWhereInput {
    return khoaId ? { dang_ky_hoc: { some: { khoa_id: khoaId } } } : {};
  }

  private locTrangThai(
    loai: LoaiKhaoSat,
    loc: LocTinhHinh,
  ): Prisma.hoc_vienWhereInput {
    if (loc === 'chua_lam') return { ket_qua_khao_sat: { none: { loai } } };
    if (loc === 'can_kiem_tra') {
      return {
        ket_qua_khao_sat: {
          some: {
            loai,
            trang_thai: { in: ['da_mo', 'dang_lam'] },
            cap_nhat_luc: {
              lt: new Date(Date.now() - NGUONG_CAN_KIEM_TRA_MS),
            },
          },
        },
      };
    }
    return { ket_qua_khao_sat: { some: { loai, trang_thai: loc } } };
  }

  // GET /ket-qua-khao-sat/thong-ke (quản trị): mỗi loại -> số theo trạng thái +
  // phân bố mức GỐC (muc_goc, theo thang quản trị cấu hình — không quy đổi
  // sang `muc`, xem ThangMucService).
  async thongKe(khoaId?: string) {
    const phamVi = this.phamViHocVien(khoaId);
    const [tong, nhom, mucGocNhom, canKiemTraNhom, thang] = await Promise.all([
      this.prisma.hoc_vien.count({ where: phamVi }),
      this.prisma.ket_qua_khao_sat.groupBy({
        by: ['loai', 'trang_thai'],
        where: { hoc_vien: phamVi },
        _count: { _all: true },
      }),
      this.prisma.ket_qua_khao_sat.groupBy({
        by: ['loai', 'muc_goc'],
        where: { hoc_vien: phamVi, trang_thai: 'hoan_thanh' },
        _count: { _all: true },
      }),
      this.prisma.ket_qua_khao_sat.groupBy({
        by: ['loai'],
        where: {
          hoc_vien: phamVi,
          trang_thai: { in: ['da_mo', 'dang_lam'] },
          cap_nhat_luc: { lt: new Date(Date.now() - NGUONG_CAN_KIEM_TRA_MS) },
        },
        _count: { _all: true },
      }),
      this.thangMuc.thang(),
    ]);

    return {
      tong_hoc_vien: tong,
      theo_loai: LOAI_KHAO_SAT.map((loai) => {
        const dem = (tt: string) =>
          nhom.find((n) => n.loai === loai && n.trang_thai === tt)?._count
            ._all ?? 0;
        const daMo = dem('da_mo');
        const dangLam = dem('dang_lam');
        const hoanThanh = dem('hoan_thanh');
        const demMucGoc = (ma: string | null) =>
          mucGocNhom.find((n) => n.loai === loai && n.muc_goc === ma)?._count
            ._all ?? 0;
        // Mã xuất hiện trong dữ liệu nhưng không còn trong thang hiện tại
        // (đã bị xóa khỏi cấu hình) -> vẫn hiện, nhãn = chính mã đó.
        const maKhac = Array.from(
          new Set(
            mucGocNhom
              .filter(
                (n) =>
                  n.loai === loai &&
                  n.muc_goc !== null &&
                  !thang.some((m) => m.ma === n.muc_goc),
              )
              .map((n) => n.muc_goc as string),
          ),
        );
        return {
          loai,
          chua_lam: tong - daMo - dangLam - hoanThanh,
          da_mo: daMo,
          dang_lam: dangLam,
          hoan_thanh: hoanThanh,
          can_kiem_tra:
            canKiemTraNhom.find((n) => n.loai === loai)?._count._all ?? 0,
          theo_muc_goc: [
            ...thang.map((m) => ({
              ma: m.ma,
              nhan: m.nhan,
              so_luong: demMucGoc(m.ma),
            })),
            ...maKhac.map((ma) => ({ ma, nhan: ma, so_luong: demMucGoc(ma) })),
          ],
          chua_xep_muc: demMucGoc(null),
        };
      }),
    };
  }

  // GET /ket-qua-khao-sat (quản trị): danh sách HỌC VIÊN (kể cả chưa làm) kèm
  // kết quả từng loại. Lọc trạng thái áp cho `loai` (mặc định 'khao-sat').
  async danhSach(query: QueryTinhHinhKhaoSatDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const dieuKien: Prisma.hoc_vienWhereInput[] = [
      this.phamViHocVien(query.khoa_id),
    ];
    if (query.trang_thai) {
      dieuKien.push(
        this.locTrangThai(query.loai ?? 'khao-sat', query.trang_thai),
      );
    }
    const q = query.q?.trim();
    if (q) {
      dieuKien.push({
        OR: [
          { ho_ten: { contains: q, mode: 'insensitive' } },
          { ma_dinh_danh_moet: { contains: boSo0DauDeTimKiem(q) } },
        ],
      });
    }
    const where: Prisma.hoc_vienWhereInput = { AND: dieuKien };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.hoc_vien.findMany({
        where,
        orderBy: [{ ho_ten: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          ho_ten: true,
          ma_dinh_danh_moet: true,
          doi_tuong: true,
          don_vi_cong_tac: { select: { ten_don_vi: true } },
          ket_qua_khao_sat: true,
        },
      }),
      this.prisma.hoc_vien.count({ where }),
    ]);

    const now = Date.now();
    const thang = await this.thangMuc.thang();
    const data = rows.map(
      ({ ket_qua_khao_sat: kqs, don_vi_cong_tac, ...hv }) => ({
        ...hv,
        ten_don_vi: don_vi_cong_tac.ten_don_vi,
        ket_qua: kqs.map((kq) => ({
          loai: kq.loai,
          trang_thai: kq.trang_thai,
          can_kiem_tra: canKiemTra(kq, now),
          so_lan_mo: kq.so_lan_mo,
          mo_gan_nhat_luc: kq.mo_gan_nhat_luc,
          hoan_thanh_luc: kq.hoan_thanh_luc,
          muc: kq.muc,
          diem: kq.diem === null ? null : Number(kq.diem),
          diem_toi_da: kq.diem_toi_da === null ? null : Number(kq.diem_toi_da),
          muc_goc: kq.muc_goc,
          nhan_muc_goc: nhanMucGoc(kq.muc_goc, thang),
          url_ket_qua: kq.url_ket_qua,
          chi_tiet: kq.chi_tiet,
          nguon: kq.nguon,
          cap_nhat_luc: kq.cap_nhat_luc,
        })),
      }),
    );
    return paginate(data, total, page, pageSize);
  }
}
