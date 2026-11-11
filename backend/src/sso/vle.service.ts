import { Injectable, Logger } from '@nestjs/common';
import type { muc_nang_luc } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  VleChuaCauHinhException,
  VleChuaCoTaiKhoanException,
  VleChuaMoException,
} from '../common/exceptions/app.exceptions';
import { parseVleCourseMap } from './util/vle-course-map.util';
import { demLuotVaoVle, HANH_DONG_VAO_HOC_VLE } from './util/luot-vao-vle.util';
import {
  GIAI_DOAN_MOC_ARGS,
  giaiDoanPhanLop,
} from '../nhu-cau-muc/nhu-cau-muc-hoc-vien.service';
import { homNayVN, tinhMocNhuCau } from '../nhu-cau-muc/util/moc-nhu-cau.util';

// Vào học VLE (external-login P.CNTT, 2026-11-10, docs/api-contract.md mục
// 10.2). VLE (CakePHP, P.CNTT) nhận POST form-urlencoded
// key/email/username/id_course từ TRÌNH DUYỆT học viên (không phải máy
// chủ-máy chủ) — phiên VLE là cookie host-only nên request phải tới từ
// chính trình duyệt đó; rủi ro "key lộ ra trình duyệt" đã được chủ sản
// phẩm chấp nhận (xem docs/api-contract.md mục 10.2 "Rủi ro đã chấp
// nhận"). Khớp: có username (bảng dang_nhap_vle) -> gửi username, email
// rỗng; không có username nhưng có email_chup -> gửi email, username
// rỗng; không có gì -> chưa sẵn sàng (409 VLE_CHUA_CO_TAI_KHOAN).
// Công tắc 2 tầng (2026-11-11): VLE_LOGIN_KEY = công tắc tổng; công tắc
// khoa_boi_duong.mo_vao_hoc_vle của khóa ĐÃ DUYỆT gần nhất (cùng đăng ký
// layDangKyVle chọn để tính id_course) = bật/tắt theo khóa. Thứ tự kiểm:
// thiếu key (503) -> khóa chưa mở (409 VLE_CHUA_MO) -> chưa có tài khoản.

const VLE_LOGIN_URL_MAC_DINH = 'https://vlebdhvs.hcmue.edu.vn/users/external-login';
const THONG_BAO_CHUA_MO = 'Khóa học chưa mở vào học VLE.';
const THONG_BAO_CHUA_CO_TAI_KHOAN =
  'Chưa có tài khoản VLE. Vui lòng cập nhật email (không trùng người khác) để được cấp tài khoản.';

export interface TrangThaiVle {
  /** Có key VÀ khóa bật mo_vao_hoc_vle — false thì FE ẩn hẳn nút. */
  mo: boolean;
  san_sang: boolean;
  ly_do?: string;
  co_khoa_hoc: boolean;
  /** Số "lượt vào VLE" của học viên (CONTEXT.md) — không phải điểm danh. */
  so_lan_vao: number;
  /** ISO 8601, null khi chưa vào lần nào. */
  lan_vao_gan_nhat: string | null;
}

export interface FormVle {
  action: string;
  fields: {
    key: string;
    email: string;
    username: string;
    id_course?: string;
  };
}

interface DangKyVle {
  /** khoa.mo_vao_hoc_vle; không có đăng ký khóa đã duyệt -> false. */
  mo: boolean;
  muc: muc_nang_luc | null;
}

interface KetQuaKhop {
  loai: 'username' | 'email';
  gia_tri: string;
}

@Injectable()
export class VleService {
  private readonly logger = new Logger(VleService.name);
  private readonly loginUrl: string;
  private readonly loginKey: string | undefined;
  private readonly courseMap: Partial<Record<muc_nang_luc, number>>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly nhatKy: NhatKyService,
  ) {
    this.loginUrl = process.env.VLE_LOGIN_URL?.trim() || VLE_LOGIN_URL_MAC_DINH;
    this.loginKey = process.env.VLE_LOGIN_KEY?.trim() || undefined;
    const { map, canhBao } = parseVleCourseMap(process.env.VLE_COURSE_MAP);
    this.courseMap = map;
    canhBao.forEach((c) => this.logger.warn(c));
  }

  async trangThai(caller: AuthenticatedUser): Promise<TrangThaiVle> {
    // Lượt vào VLE tính cả khi chưa cấu hình/chưa có tài khoản (nút bị ẩn
    // hoặc disable thì FE không hiện, 0/null là đủ).
    const luot = await this.luotVao(caller.hoc_vien_id!);
    if (!this.loginKey) {
      return {
        mo: false,
        san_sang: false,
        ly_do: 'Chức năng vào học VLE chưa được cấu hình.',
        co_khoa_hoc: false,
        ...luot,
      };
    }
    const dk = await this.layDangKyVle(caller.hoc_vien_id!);
    // Khóa chưa mở -> không xét khớp tài khoản.
    if (!dk.mo) {
      return {
        mo: false,
        san_sang: false,
        ly_do: THONG_BAO_CHUA_MO,
        co_khoa_hoc: false,
        ...luot,
      };
    }
    const match = await this.timKhop(caller.hoc_vien_id!);
    if (!match) {
      return {
        mo: true,
        san_sang: false,
        ly_do: THONG_BAO_CHUA_CO_TAI_KHOAN,
        co_khoa_hoc: false,
        ...luot,
      };
    }
    return {
      mo: true,
      san_sang: true,
      co_khoa_hoc: this.idCourse(dk.muc) !== undefined,
      ...luot,
    };
  }

  async form(caller: AuthenticatedUser, ip: string | null): Promise<FormVle> {
    if (!this.loginKey) throw new VleChuaCauHinhException();
    const hocVienId = caller.hoc_vien_id!;
    const dk = await this.layDangKyVle(hocVienId);
    if (!dk.mo) throw new VleChuaMoException();
    const match = await this.timKhop(hocVienId);
    if (!match) throw new VleChuaCoTaiKhoanException(THONG_BAO_CHUA_CO_TAI_KHOAN);

    const idCourse = this.idCourse(dk.muc);
    const fields: FormVle['fields'] = {
      key: this.loginKey,
      email: match.loai === 'email' ? match.gia_tri : '',
      username: match.loai === 'username' ? match.gia_tri : '',
    };
    if (idCourse !== undefined) fields.id_course = String(idCourse);

    // Không log key/toàn bộ fields — chỉ ghi kiểu khớp + id_course (ADR mục
    // 10.2 "Audit log"). Dùng chung nhat-ky (ip tự lấy từ ngữ cảnh request).
    await this.nhatKy.ghi({
      hanh_dong: HANH_DONG_VAO_HOC_VLE,
      hoc_vien_id: hocVienId,
      chi_tiet: { khop_theo: match.loai, id_course: idCourse ?? null, ip },
    });

    return { action: this.loginUrl, fields };
  }

  private async luotVao(
    hocVienId: string,
  ): Promise<Pick<TrangThaiVle, 'so_lan_vao' | 'lan_vao_gan_nhat'>> {
    const l = (await demLuotVaoVle(this.prisma, [hocVienId])).get(hocVienId);
    return {
      so_lan_vao: l?.so_lan_vao ?? 0,
      lan_vao_gan_nhat: l?.lan_vao_gan_nhat?.toISOString() ?? null,
    };
  }

  private async timKhop(hocVienId: string): Promise<KetQuaKhop | null> {
    const dn = await this.prisma.dang_nhap_vle.findUnique({
      where: { hoc_vien_id: hocVienId },
    });
    if (dn?.username) return { loai: 'username', gia_tri: dn.username };
    if (dn?.email_chup) return { loai: 'email', gia_tri: dn.email_chup };
    return null;
  }

  private idCourse(muc: muc_nang_luc | null): number | undefined {
    return muc ? this.courseMap[muc] : undefined;
  }

  // Nguồn mức VLE: tái dùng tinhMocNhuCau/chonLopDangPhanCong (nhu-cau-muc,
  // ADR 0013) — mức của lớp VLE đang được phân công (đang diễn ra > sắp tới
  // gần nhất > đã qua gần nhất) của đăng ký thuộc khóa ĐÃ DUYỆT gần nhất
  // (cùng quy tắc "khóa gần nhất" của SsoService.doiMa); lớp chưa có mức ->
  // dùng mức đầu vào đã chốt (= "mức hiệu lực", ADR 0006). Chỉ lọc
  // phan_lop_giai_doan có lop.loai_lop = 'vle' trước khi đưa vào
  // tinhMocNhuCau — không re-implement logic chọn giai đoạn hiện tại.
  // Cùng 1 truy vấn lấy luôn công tắc khoa.mo_vao_hoc_vle của đăng ký đó.
  private async layDangKyVle(hocVienId: string): Promise<DangKyVle> {
    const dk = await this.prisma.dang_ky_hoc.findFirst({
      where: { hoc_vien_id: hocVienId, khoa: { trang_thai: 'da_duyet' } },
      orderBy: { khoa: { ngay_duyet: 'desc' } },
      select: {
        muc_dau_vao: true,
        khoa: {
          select: { mo_vao_hoc_vle: true, giai_doan: GIAI_DOAN_MOC_ARGS },
        },
        phan_lop_giai_doan: {
          where: { lop: { loai_lop: 'vle' } },
          select: {
            giai_doan_id: true,
            lop: { select: { id: true, ten_lop: true, muc_nang_luc: true } },
          },
        },
      },
    });
    if (!dk) return { mo: false, muc: null };
    const gds = giaiDoanPhanLop(dk.khoa.giai_doan, dk.phan_lop_giai_doan);
    return {
      mo: dk.khoa.mo_vao_hoc_vle,
      muc: tinhMocNhuCau(gds, dk.muc_dau_vao, homNayVN())?.muc ?? null,
    };
  }
}
