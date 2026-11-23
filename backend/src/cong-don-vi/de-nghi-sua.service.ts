import { Injectable } from '@nestjs/common';
import type { Prisma, de_nghi_sua_danh_sach } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import {
  ConflictAppException,
  NotFoundAppException,
} from '../common/exceptions/app.exceptions';
import {
  GiaTriDeNghi,
  LoaiDeNghi,
  TY_LE_SUAT,
  TrangThaiDeNghi,
  YKienTruong,
  trangThaiSauXuLyDeNghi,
} from './quy-tac-hop-dong';
import { SuaDong, apDungSua, khacBiet } from './sua-dong-danh-sach';
import { banChup, giaTriGoc } from './danh-sach-tham-gia.service';
import { chuoiSangNgay } from './dot-trien-khai.service';
import {
  BanChupDongDeNghi,
  banChupDongDeNghi,
} from './truong-danh-sach.service';
import {
  DA_NOP_QUAN_TRI,
  Tx,
  datTrangThaiTheoSaiLech,
  khoaHopDong,
} from './giao-dich-hop-dong';
import { DongBoHoSoNlsService } from './dong-bo-ho-so-nls.service';
import {
  KetQuaDongBo,
  giaTriCaNhanDaDoi,
  nhatKyDongBo,
} from './dong-bo-ho-so-nls';

/** 1 mục trong hàng đợi đề nghị của Quản trị. */
export interface MucDeNghi {
  id: string;
  don_vi: { id: string; ten: string };
  loai: LoaiDeNghi;
  dong_id: string | null;
  /** Giá trị hiện tại của dòng (null nếu thêm người hoặc dòng đã bị xóa). hoc_vien_id: dòng NLS (Y2). */
  dong_hien_tai:
    | (BanChupDongDeNghi & {
        y_kien_truong: YKienTruong | null;
        hoc_vien_id: string | null;
      })
    | null;
  gia_tri: GiaTriDeNghi;
  gia_tri_cu: BanChupDongDeNghi | null;
  ly_do: string | null;
  trang_thai: TrangThaiDeNghi;
  ly_do_tu_choi: string | null;
  gui_luc: string;
  gui_boi: { id: string; ho_ten: string; ten_dang_nhap: string };
  xu_ly_luc: string | null;
  xu_ly_boi: { id: string; ho_ten: string } | null;
}

const KHONG_THAY_DE_NGHI = 'Không tìm thấy đề nghị';
const DA_XU_LY = 'Đề nghị đã được xử lý';
const DONG_DA_XOA = 'Dòng đã bị xóa — hãy Từ chối đề nghị';
const DONG_KHAC_TRUONG =
  'Dòng đã chuyển sang trường khác — hãy Từ chối đề nghị';

const KEM = {
  dong: true,
  don_vi: { select: { id: true, ten_don_vi: true } },
  gui_boi_user: { select: { id: true, ho_ten: true, ten_dang_nhap: true } },
  xu_ly_boi_user: { select: { id: true, ho_ten: true } },
} satisfies Prisma.de_nghi_sua_danh_sachInclude;

type DeNghiDayDu = Prisma.de_nghi_sua_danh_sachGetPayload<{
  include: typeof KEM;
}>;

function toMuc(d: DeNghiDayDu): MucDeNghi {
  return {
    id: d.id,
    don_vi: { id: d.don_vi.id, ten: d.don_vi.ten_don_vi },
    loai: d.loai,
    dong_id: d.dong_id,
    dong_hien_tai: d.dong
      ? {
          ...banChupDongDeNghi(d.dong),
          y_kien_truong: d.dong.y_kien_truong as YKienTruong | null,
          hoc_vien_id: d.dong.hoc_vien_id,
        }
      : null,
    gia_tri: d.gia_tri as GiaTriDeNghi,
    gia_tri_cu: d.gia_tri_cu as unknown as BanChupDongDeNghi | null,
    ly_do: d.ly_do,
    trang_thai: d.trang_thai,
    ly_do_tu_choi: d.ly_do_tu_choi,
    gui_luc: d.gui_luc.toISOString(),
    gui_boi: d.gui_boi_user,
    xu_ly_luc: d.xu_ly_luc ? d.xu_ly_luc.toISOString() : null,
    xu_ly_boi: d.xu_ly_boi_user,
  };
}

/** Kết quả thay đổi danh sách khi Áp dụng — cho nhật ký. */
interface KetQuaApDung {
  dong_id: string | null;
  truoc: Record<string, unknown> | null;
  sau: Record<string, unknown> | null;
}

/** Issue #69 / Y2: response Áp dụng kèm kết quả đồng bộ hồ sơ (null = không đồng bộ). */
export type MucDeNghiSauApDung = MucDeNghi & { dong_bo: KetQuaDongBo | null };

const LY_DO_DONG_BO = 'Cổng đơn vị: áp dụng đề nghị sửa danh sách tham gia';

// Issue #62 / ADR 0015 X2: hàng đợi đề nghị của trường — Quản trị Áp dụng / Từ chối. Không phải đặt lại
// kiểu X1: các dòng khác giữ nguyên ý kiến (trangThaiSauXuLyDeNghi).
// Issue #64 / X5: trường đã nộp hợp đồng → Áp dụng / Từ chối trả 409 (phải Mở lại hợp đồng trước).
// Issue #69 / ADR 0015 Y2: Áp dụng đề nghị sửa trên dòng NLS (hoc_vien_id) — Quản trị chọn cập nhật luôn hồ sơ
// học viên (họ tên, ngày sinh, giới tính) trong cùng transaction; dòng HSG là dữ liệu gốc nên không đồng bộ.
@Injectable()
export class DeNghiSuaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nhatKy: NhatKyService,
    private readonly dongBoHoSo: DongBoHoSoNlsService,
  ) {}

  /** Hàng đợi theo đợt: mặc định 'cho' (cũ nhất trước); đã xử lý thì mới nhất trước. Kèm tổng số chờ của đợt. */
  async danhSach(
    dotId: string,
    trangThai: TrangThaiDeNghi = 'cho',
    donViId?: string,
  ): Promise<{ items: MucDeNghi[]; so_cho: number }> {
    const dot = await this.prisma.dot_trien_khai.findUnique({
      where: { id: dotId },
      select: { id: true },
    });
    if (!dot) throw new NotFoundAppException('Không tìm thấy đợt triển khai');
    const thuTu = trangThai === 'cho' ? 'asc' : 'desc';
    const [ds, so_cho] = await Promise.all([
      this.prisma.de_nghi_sua_danh_sach.findMany({
        where: {
          dot_trien_khai_id: dotId,
          trang_thai: trangThai,
          ...(donViId ? { don_vi_id: donViId } : {}),
        },
        include: KEM,
        orderBy: [{ gui_luc: thuTu }, { id: 'asc' }],
      }),
      this.prisma.de_nghi_sua_danh_sach.count({
        where: { dot_trien_khai_id: dotId, trang_thai: 'cho' },
      }),
    ]);
    return { items: ds.map(toMuc), so_cho };
  }

  /** Áp dụng: ghi giá trị đề nghị vào danh sách; dòng (sửa/thêm) thành Đồng ý; bớt → xóa dòng. */
  async apDung(
    id: string,
    adminId: string,
    dongBoHoSo = false,
  ): Promise<MucDeNghiSauApDung> {
    const dn = await this.layChoXuLy(id);
    if (dongBoHoSo) this.dongBoHoSo.chanLoaiDeNghi(dn.loai);
    const { dongBo, ...kq } = await this.prisma.$transaction(async (tx) => {
      await khoaHopDong(
        tx,
        dn.dot_trien_khai_id,
        dn.don_vi_id,
        DA_NOP_QUAN_TRI,
      );
      let ketQua: KetQuaApDung;
      let dongBo: KetQuaDongBo | null = null;
      if (dn.loai === 'them') {
        ketQua = await this.themTuDeNghi(tx, dn, adminId);
        await this.danhDauDaXuLy(tx, dn.id, adminId, 'da_ap_dung');
      } else {
        const dong = await this.dongCuaDeNghi(tx, dn);
        if (dn.loai === 'sua') {
          if (!dong) throw new ConflictAppException(DONG_DA_XOA);
          ketQua = await this.suaTuDeNghi(tx, dn, dong);
          if (dongBoHoSo) {
            dongBo = await this.dongBoHoSo.dongBo(
              tx,
              dong.hoc_vien_id,
              giaTriCaNhanDaDoi(ketQua.sau),
              adminId,
              LY_DO_DONG_BO,
            );
          }
          await this.danhDauDaXuLy(tx, dn.id, adminId, 'da_ap_dung');
        } else {
          // Đánh dấu trước rồi mới xóa: dong_id của đề nghị về NULL theo FK.
          await this.danhDauDaXuLy(tx, dn.id, adminId, 'da_ap_dung');
          if (dong) {
            await tx.danh_sach_tham_gia.delete({ where: { id: dong.id } });
          }
          ketQua = {
            dong_id: dn.dong_id,
            truoc: dong ? banChup(dong) : null,
            sau: null,
          };
        }
      }
      await this.sauXuLy(tx, dn, adminId);
      return { ...ketQua, dongBo };
    });
    await this.nhatKy.ghi({
      hanh_dong: 'ap_dung_de_nghi_sua_danh_sach',
      chi_tiet: {
        dot_trien_khai_id: dn.dot_trien_khai_id,
        don_vi_id: dn.don_vi_id,
        de_nghi_id: dn.id,
        loai: dn.loai,
        ...kq,
        ...nhatKyDongBo(dongBo),
      },
    });
    return { ...(await this.layMuc(id)), dong_bo: dongBo };
  }

  /** Từ chối (bắt buộc lý do): dòng sửa/bớt về chưa có ý kiến; danh sách không đổi. */
  async tuChoi(id: string, lyDo: string, adminId: string): Promise<MucDeNghi> {
    const dn = await this.layChoXuLy(id);
    await this.prisma.$transaction(async (tx) => {
      await khoaHopDong(
        tx,
        dn.dot_trien_khai_id,
        dn.don_vi_id,
        DA_NOP_QUAN_TRI,
      );
      await this.danhDauDaXuLy(tx, dn.id, adminId, 'tu_choi', lyDo);
      // Dòng sửa/bớt (nếu còn, và còn thuộc trường đề nghị) về chưa có ý kiến.
      if (dn.dong_id) {
        await tx.danh_sach_tham_gia.updateMany({
          where: {
            id: dn.dong_id,
            dot_trien_khai_id: dn.dot_trien_khai_id,
            don_vi_id: dn.don_vi_id,
          },
          data: { y_kien_truong: null, updated_at: new Date() },
        });
      }
      await this.sauXuLy(tx, dn, adminId);
    });
    await this.nhatKy.ghi({
      hanh_dong: 'tu_choi_de_nghi_sua_danh_sach',
      chi_tiet: {
        dot_trien_khai_id: dn.dot_trien_khai_id,
        don_vi_id: dn.don_vi_id,
        de_nghi_id: dn.id,
        loai: dn.loai,
        dong_id: dn.dong_id,
        ly_do: lyDo,
      },
    });
    return this.layMuc(id);
  }

  /** Đề nghị phải tồn tại (404) và còn chờ (409) — kiểm lại trong transaction bằng updateMany có điều kiện. */
  private async layChoXuLy(id: string): Promise<de_nghi_sua_danh_sach> {
    const dn = await this.prisma.de_nghi_sua_danh_sach.findUnique({
      where: { id },
    });
    if (!dn) throw new NotFoundAppException(KHONG_THAY_DE_NGHI);
    if (dn.trang_thai !== 'cho') throw new ConflictAppException(DA_XU_LY);
    return dn;
  }

  private async danhDauDaXuLy(
    tx: Tx,
    id: string,
    adminId: string,
    trangThai: 'da_ap_dung' | 'tu_choi',
    lyDoTuChoi: string | null = null,
  ) {
    const luc = new Date();
    const { count } = await tx.de_nghi_sua_danh_sach.updateMany({
      where: { id, trang_thai: 'cho' },
      data: {
        trang_thai: trangThai,
        ly_do_tu_choi: lyDoTuChoi,
        xu_ly_boi: adminId,
        xu_ly_luc: luc,
        updated_at: luc,
      },
    });
    // Đua với lần xử lý khác / tự từ chối khi Quản trị xóa dòng.
    if (count === 0) throw new ConflictAppException(DA_XU_LY);
  }

  /** Dòng của đề nghị sửa/bớt; null nếu đã bị xóa. Dòng đã chuyển sang trường/đợt khác → 409. */
  private async dongCuaDeNghi(tx: Tx, dn: de_nghi_sua_danh_sach) {
    if (!dn.dong_id) return null;
    const dong = await tx.danh_sach_tham_gia.findUnique({
      where: { id: dn.dong_id },
    });
    if (!dong) return null;
    if (
      dong.don_vi_id !== dn.don_vi_id ||
      dong.dot_trien_khai_id !== dn.dot_trien_khai_id
    ) {
      throw new ConflictAppException(DONG_KHAC_TRUONG);
    }
    return dong;
  }

  /** Sửa: chỉ các trường đề nghị; đổi giai đoạn → suất theo giai đoạn (như Quản trị PATCH); dòng → Đồng ý. */
  private async suaTuDeNghi(
    tx: Tx,
    dn: de_nghi_sua_danh_sach,
    dong: Parameters<typeof giaTriGoc>[0],
  ): Promise<KetQuaApDung> {
    const goc = giaTriGoc(dong);
    const sau = {
      ...apDungSua(goc, dn.gia_tri as SuaDong),
      y_kien_truong: 'dong_y',
    };
    await tx.danh_sach_tham_gia.update({
      where: { id: dong.id },
      data: {
        ho_ten: sau.ho_ten,
        ngay_sinh: chuoiSangNgay(sau.ngay_sinh),
        gioi_tinh: sau.gioi_tinh,
        lop: sau.lop,
        giai_doan: sau.giai_doan,
        ty_le_suat: sau.ty_le_suat,
        y_kien_truong: sau.y_kien_truong,
        updated_at: new Date(),
      },
    });
    const doi = khacBiet(goc, sau);
    return {
      dong_id: dong.id,
      truoc: doi?.truoc ?? {},
      sau: doi?.sau ?? {},
    };
  }

  /** Thêm người: dòng mới của trường đề nghị, suất theo giai đoạn, Đồng ý sẵn. */
  private async themTuDeNghi(
    tx: Tx,
    dn: de_nghi_sua_danh_sach,
    adminId: string,
  ): Promise<KetQuaApDung> {
    const gt = dn.gia_tri as GiaTriDeNghi;
    const giai_doan = gt.giai_doan ?? 'ca_hai';
    const moi = await tx.danh_sach_tham_gia.create({
      data: {
        dot_trien_khai_id: dn.dot_trien_khai_id,
        don_vi_id: dn.don_vi_id,
        ho_ten: gt.ho_ten,
        ngay_sinh: chuoiSangNgay(gt.ngay_sinh ?? null),
        gioi_tinh: gt.gioi_tinh ?? null,
        lop: gt.lop ?? null,
        giai_doan,
        ty_le_suat: TY_LE_SUAT[giai_doan],
        y_kien_truong: 'dong_y',
        created_by: adminId,
      },
    });
    // CHECK cấm gắn dong_id vào đề nghị thêm người → id dòng mới chỉ nằm trong nhật ký.
    return {
      dong_id: moi.id,
      truoc: null,
      sau: { ...banChup(moi), dong_id: moi.id },
    };
  }

  private sauXuLy(tx: Tx, dn: de_nghi_sua_danh_sach, adminId: string) {
    return datTrangThaiTheoSaiLech(
      tx,
      dn.dot_trien_khai_id,
      [dn.don_vi_id],
      adminId,
      trangThaiSauXuLyDeNghi,
    );
  }

  private async layMuc(id: string): Promise<MucDeNghi> {
    const d = await this.prisma.de_nghi_sua_danh_sach.findUniqueOrThrow({
      where: { id },
      include: KEM,
    });
    return toMuc(d);
  }
}
