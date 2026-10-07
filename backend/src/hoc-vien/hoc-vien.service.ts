import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  Prisma,
  cap_hoc,
  dia_danh,
  don_vi_cong_tac,
  dot_xac_nhan,
  hoc_vien,
  hoc_vien_chuyen_mon,
  mon_hoc,
  nguon_tao_ho_so,
  trinh_do_chuyen_mon,
  vai_tro_nguoi_dung,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ThongBaoService } from '../thong-bao/thong-bao.service';
import { DotXacNhanService } from '../dot-xac-nhan/dot-xac-nhan.service';
import { CauHinhKhaoSatService } from '../cau-hinh-khao-sat/cau-hinh-khao-sat.service';
import { normalizeNfcName } from '../common/utils/normalize-text.util';
import { dieuKienKhongDau } from '../common/utils/tim-kiem-khong-dau.util';
import { decryptVleMatKhau } from '../common/utils/vle-crypto.util';
import {
  layFrontendUrl,
  taoTokenXacThuc,
} from '../common/utils/token-xac-thuc.util';
import { paginate } from '../common/dto/pagination-query.dto';
import {
  ConflictAppException,
  DotXacNhanDongException,
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import {
  FieldMessage,
  matKhauMacDinhTuNgaySinh,
  validateEmail,
  validateHoTen,
  validateNgayThangNamSinh,
  validateSoDienThoai,
  validateSoDinhDanh,
} from './hoc-vien-validation.util';
import { CreateHocVienDto } from './dto/create-hoc-vien.dto';
import { UpdateHocVienDto } from './dto/update-hoc-vien.dto';
import { QueryHocVienDto } from './dto/query-hoc-vien.dto';
import { DuyetHocVienDto } from './dto/duyet-hoc-vien.dto';
import { ChuyenMonDto } from './dto/chuyen-mon.dto';

const BCRYPT_SALT_ROUNDS = 10;

// 2026-10-07: đối tượng "nhân viên" chỉ cung cấp thông tin cá nhân — khảo sát
// (đầu vào + đầu ra) chưa triển khai, SsoService.capMa cũng chặn theo cờ này.
export const THONG_BAO_KHAO_SAT_NHAN_VIEN =
  'Học viên chỉ cần cung cấp thông tin cá nhân cơ bản (chưa thực hiện khảo sát đánh giá năng lực và chưa tập huấn trong đợt này). Kế hoạch tập huấn: Việc khảo sát năng lực và tập huấn chuyên môn sẽ triển khai đồng loạt trên toàn tỉnh trong năm 2027.';
const KHAO_SAT_CHUA_TRIEN_KHAI = {
  chua_trien_khai: true as const,
  ly_do: [THONG_BAO_KHAO_SAT_NHAN_VIEN],
};

// Cấu trúc "hồ sơ sẽ có sau khi lưu" dùng chung cho validateHocVien — ở POST
// /hoc-vien đây chính là dto; ở PATCH /hoc-vien/toi đây là bản merge giữa hồ
// sơ hiện tại + field được sửa (xem capNhatHoSoCuaToi).
interface HocVienValidateInput {
  ho_ten?: string;
  so_dinh_danh_ca_nhan?: string | null;
  ngay_sinh?: number;
  thang_sinh?: number;
  nam_sinh?: number;
  noi_sinh_tinh?: string | null;
  noi_sinh_huyen?: string | null;
  noi_sinh_xa?: string | null;
  cu_tru_tinh_id?: string | null;
  cu_tru_phuong_xa_id?: string | null;
  don_vi_cong_tac_id?: string | null;
  so_dien_thoai_lien_he?: string | null;
  email_lien_he?: string | null;
  trinh_do_chuyen_mon?: trinh_do_chuyen_mon | null;
  trinh_do_chuyen_mon_khac?: string | null;
  cap_giang_day?: cap_hoc | null;
  mon_giang_day_id?: string | null;
  chuyen_mon?: string[];
}

type HocVienDayDu = hoc_vien & { chuyen_mon: hoc_vien_chuyen_mon[] };

// GET /hoc-vien/toi + GET /hoc-vien/{id} — kèm sẵn tên đã join cho mọi FK
// chọn-từ-danh-mục (docs/api-contract.md mục 2, "Thêm 2026-09-28"). 3/4 quan
// hệ nullable (noi_sinh/phuong_xa/mon_giang_day — FK optional trên hoc_vien),
// riêng don_vi_cong_tac NOT NULL nên luôn có.
type HocVienDayDuVoiTen = HocVienDayDu & {
  // Deprecated 2026-09-30: quan hệ FK cũ (đổi tên noi_sinh -> noi_sinh_dia_danh
  // vì "noi_sinh" giờ là cột text tự do trên hoc_vien) — vẫn include để trả
  // noi_sinh_ten cho hồ sơ còn dữ liệu cũ, không dùng cho luồng ghi mới.
  noi_sinh_dia_danh: dia_danh | null;
  phuong_xa: dia_danh | null;
  cu_tru_tinh: dia_danh | null;
  cu_tru_phuong_xa: dia_danh | null;
  don_vi_cong_tac: don_vi_cong_tac;
  mon_giang_day: mon_hoc | null;
};

const INCLUDE_HOC_VIEN_DAY_DU_VOI_TEN = {
  chuyen_mon: true,
  noi_sinh_dia_danh: true,
  phuong_xa: true,
  cu_tru_tinh: true,
  cu_tru_phuong_xa: true,
  don_vi_cong_tac: true,
  mon_giang_day: true,
} as const;

// Dịch vụ Học viên — docs/api-contract.md mục 2 + docs/validation-checklist.md
// #1-36f. Đây là module có nhiều quy tắc validate nhất hệ thống — validateHocVien()
// là bộ quy tắc DÙNG CHUNG cho tự đăng ký (requireFull=true) và bổ sung/sửa
// (PATCH, requireFull=false); luồng import CSDL MOET dùng bộ quy tắc RIÊNG
// (checkValidMoetImportRow) vì cấu trúc dữ liệu dòng import khác hẳn (không có
// nơi sinh/phường xã/trình độ/email — xem "Luồng import nhân sự từ CSDL MOET").
@Injectable()
export class HocVienService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
    private readonly thongBaoService: ThongBaoService,
    private readonly dotXacNhanService: DotXacNhanService,
    private readonly cauHinhKhaoSatService: CauHinhKhaoSatService,
  ) {}

  // ---------------------------------------------------------------------
  // Validate dùng chung (tu_dang_ky: create + PATCH + kiem-tra-truoc-xac-nhan)
  // ---------------------------------------------------------------------
  async validateHocVien(
    input: HocVienValidateInput,
    opts: { requireFull: boolean; excludeHocVienId?: string },
  ): Promise<{ loi: FieldMessage[]; canh_bao: FieldMessage[] }> {
    const loi: FieldMessage[] = [];
    const canhBao: FieldMessage[] = [];

    // Rule #1-5: họ và tên
    if (input.ho_ten !== undefined) {
      const r = validateHoTen(input.ho_ten);
      loi.push(...r.loi);
      canhBao.push(...r.canhBao);
    } else if (opts.requireFull) {
      loi.push({ field: 'ho_ten', message: 'Bắt buộc nhập' });
    }

    // Rule #6-7: ĐDCN
    if (input.so_dinh_danh_ca_nhan) {
      const dinhDangLoi = validateSoDinhDanh(input.so_dinh_danh_ca_nhan);
      loi.push(...dinhDangLoi);
      if (dinhDangLoi.length === 0) {
        const trung = await this.prisma.hoc_vien.findUnique({
          where: { so_dinh_danh_ca_nhan: input.so_dinh_danh_ca_nhan },
        });
        if (trung && trung.id !== opts.excludeHocVienId) {
          loi.push({
            field: 'so_dinh_danh_ca_nhan',
            message: 'Số định danh cá nhân đã được dùng bởi học viên khác',
          });
        }
      }
    } else if (opts.requireFull) {
      loi.push({ field: 'so_dinh_danh_ca_nhan', message: 'Bắt buộc nhập' });
    }

    // Rule #9-12: ngày/tháng/năm sinh
    if (
      input.ngay_sinh !== undefined &&
      input.thang_sinh !== undefined &&
      input.nam_sinh !== undefined
    ) {
      loi.push(
        ...validateNgayThangNamSinh(
          input.ngay_sinh,
          input.thang_sinh,
          input.nam_sinh,
        ),
      );
    } else if (opts.requireFull) {
      loi.push({
        field: 'ngay_sinh',
        message: 'Bắt buộc nhập đầy đủ ngày/tháng/năm sinh',
      });
    }

    // Rule #13b (T17, 2026-10-01): nơi sinh (noi_sinh_tinh/huyen/xa) là text
    // tự do, HOÀN TOÀN TÙY CHỌN cho mọi nguon_tao — không tính vào "Hồ sơ đầy
    // đủ" (trước đó cột "noi_sinh" 1 ô còn bắt buộc khi requireFull, đã bỏ
    // theo quyết định nghiệp vụ mới — xem docs/validation-checklist.md #13b).
    // Không còn gì để kiểm tra ở đây ngoài @MaxLength đã có ở DTO.

    // Thêm 2026-09-30: "Cư trú" — TÙY CHỌN, dùng đúng địa giới hành chính
    // HIỆN TẠI (2 cấp tỉnh/thành -> phường/xã, cùng cách làm CŨ của nơi sinh
    // ở trên) — không có nhánh requireFull vì cả 2 field đều không bắt buộc.
    if (input.cu_tru_tinh_id) {
      const diaDanh = await this.prisma.dia_danh.findUnique({
        where: { id: input.cu_tru_tinh_id },
      });
      if (!diaDanh) {
        loi.push({ field: 'cu_tru_tinh_id', message: 'Không tồn tại' });
      } else {
        if (diaDanh.cap !== 'tinh_thanh') {
          loi.push({
            field: 'cu_tru_tinh_id',
            message: 'Phải là địa danh cấp tỉnh/thành',
          });
        }
        if (diaDanh.trang_thai !== 'active') {
          loi.push({
            field: 'cu_tru_tinh_id',
            message: 'Địa danh đã ngừng sử dụng, không thể chọn mới',
          });
        }
      }
    }

    if (input.cu_tru_phuong_xa_id) {
      const diaDanh = await this.prisma.dia_danh.findUnique({
        where: { id: input.cu_tru_phuong_xa_id },
      });
      if (!diaDanh) {
        loi.push({ field: 'cu_tru_phuong_xa_id', message: 'Không tồn tại' });
      } else {
        if (diaDanh.cap !== 'phuong_xa_dac_khu') {
          loi.push({
            field: 'cu_tru_phuong_xa_id',
            message: 'Phải là địa danh cấp phường/xã',
          });
        }
        if (diaDanh.trang_thai !== 'active') {
          loi.push({
            field: 'cu_tru_phuong_xa_id',
            message: 'Địa danh đã ngừng sử dụng, không thể chọn mới',
          });
        }
        if (
          input.cu_tru_tinh_id &&
          diaDanh.parent_id !== input.cu_tru_tinh_id
        ) {
          loi.push({
            field: 'cu_tru_phuong_xa_id',
            message: 'Phải thuộc tỉnh/thành đã chọn ở cu_tru_tinh_id',
          });
        }
      }
    }

    // Rule #17-18: đơn vị công tác — luôn bắt buộc (NOT NULL cả 2 luồng)
    if (input.don_vi_cong_tac_id) {
      const donVi = await this.prisma.don_vi_cong_tac.findUnique({
        where: { id: input.don_vi_cong_tac_id },
      });
      if (!donVi) {
        loi.push({ field: 'don_vi_cong_tac_id', message: 'Không tồn tại' });
      } else {
        if (donVi.trang_thai !== 'active') {
          loi.push({
            field: 'don_vi_cong_tac_id',
            message: 'Đơn vị đã ngừng hoạt động',
          });
        }
        if (donVi.loai_don_vi !== 'truong') {
          loi.push({
            field: 'don_vi_cong_tac_id',
            message: 'Chỉ được chọn đơn vị loại Trường',
          });
        }
      }
    } else {
      loi.push({ field: 'don_vi_cong_tac_id', message: 'Bắt buộc chọn' });
    }

    // Rule #19-20: số điện thoại — luôn bắt buộc
    if (input.so_dien_thoai_lien_he) {
      loi.push(...validateSoDienThoai(input.so_dien_thoai_lien_he));
    } else {
      loi.push({
        field: 'so_dien_thoai_lien_he',
        message: 'Bắt buộc nhập',
      });
    }

    // Rule #19, #21: email
    if (input.email_lien_he) {
      loi.push(...validateEmail(input.email_lien_he));
    } else if (opts.requireFull) {
      loi.push({ field: 'email_lien_he', message: 'Bắt buộc nhập' });
    }

    // Rule #22-23: trình độ chuyên môn
    if (!input.trinh_do_chuyen_mon && opts.requireFull) {
      loi.push({ field: 'trinh_do_chuyen_mon', message: 'Bắt buộc chọn' });
    }
    if (
      input.trinh_do_chuyen_mon === 'khac' &&
      !input.trinh_do_chuyen_mon_khac
    ) {
      loi.push({
        field: 'trinh_do_chuyen_mon_khac',
        message: 'Bắt buộc nhập khi trình độ chuyên môn = khác',
      });
    }

    // Rule #25-26: cấp giảng dạy / môn giảng dạy (tùy chọn, phụ thuộc lẫn nhau)
    if (input.mon_giang_day_id) {
      if (!input.cap_giang_day) {
        loi.push({
          field: 'mon_giang_day_id',
          message: 'Chỉ chọn được khi đã có cấp giảng dạy',
        });
      } else {
        const mon = await this.prisma.mon_hoc.findUnique({
          where: { id: input.mon_giang_day_id },
        });
        if (!mon) {
          loi.push({ field: 'mon_giang_day_id', message: 'Không tồn tại' });
        } else {
          if (mon.trang_thai !== 'active') {
            loi.push({
              field: 'mon_giang_day_id',
              message: 'Môn học đã ngừng sử dụng',
            });
          }
          if (mon.cap_hoc !== input.cap_giang_day) {
            loi.push({
              field: 'mon_giang_day_id',
              message: 'Môn học không thuộc đúng cấp giảng dạy đã chọn',
            });
          }
        }
      }
    }

    // Rule #24: chuyên môn — chỉ kiểm tra khi requireFull (PATCH không mang
    // theo field này, quản lý riêng qua themChuyenMon/xoaChuyenMon)
    if (opts.requireFull) {
      const list = (input.chuyen_mon ?? [])
        .map((c) => c.trim())
        .filter(Boolean);
      if (list.length === 0) {
        loi.push({
          field: 'chuyen_mon',
          message: 'Bắt buộc có ít nhất 1 chuyên môn',
        });
      }
    }

    return { loi, canh_bao: canhBao };
  }

  // T14 (mo-rong-nls-an-giang.md): thay isEditable() cũ (boolean đơn giản)
  // — với import_moet, "sửa được" phụ thuộc đợt xác nhận đang mở (không còn
  // đúng-luôn như trước), nên cần trả về CHÍNH đợt đó (dùng để gắn dot_id
  // vào lich_su_thay_doi_ho_so + kiểm tra hủy xác nhận). null = tu_dang_ky
  // (không có khái niệm đợt) hoặc import_moet nhưng gọi từ luồng quan_tri
  // (PATCH /hoc-vien/{id}, không bị chặn bởi đợt).
  private async kiemTraEditableVaLayDot(hocVien: {
    id: string;
    trang_thai: hoc_vien['trang_thai'];
    nguon_tao: nguon_tao_ho_so;
  }): Promise<dot_xac_nhan | null> {
    if (hocVien.nguon_tao === 'import_moet') {
      const dot = await this.dotXacNhanService.dotDangMoCuaHocVien(hocVien.id);
      if (!dot) throw new DotXacNhanDongException();
      return dot;
    }
    if (hocVien.trang_thai !== 'nhap' && hocVien.trang_thai !== 'tu_choi') {
      throw new ConflictAppException(
        'Hồ sơ đang chờ duyệt hoặc đã duyệt, không thể sửa',
      );
    }
    return null;
  }

  // Các trường PATCH /hoc-vien/toi (UpdateHocVienDto) ghi 1 dòng lịch sử mỗi
  // khi giá trị thực sự đổi (T14). la_truong_goc_moet=true cho đúng 7 trường
  // liệt kê trong tài liệu — KHÔNG gồm so_dinh_danh_ca_nhan (CCCD chưa từng
  // có trong file MOET) dù CCCD cũng nằm trong danh sách trường được log.
  private static readonly TRUONG_GOC_MOET = new Set<string>([
    'ho_ten',
    'ngay_sinh',
    'thang_sinh',
    'nam_sinh',
    'don_vi_cong_tac_id',
    'chuc_vu',
    'so_dien_thoai_lien_he',
  ]);

  private static readonly DIFF_FIELDS: (keyof UpdateHocVienDto)[] = [
    'ho_ten',
    'so_dinh_danh_ca_nhan',
    'ngay_sinh',
    'thang_sinh',
    'nam_sinh',
    'gioi_tinh',
    'chuc_vu',
    'doi_tuong',
    'noi_sinh_tinh',
    'noi_sinh_huyen',
    'noi_sinh_xa',
    'cu_tru_tinh_id',
    'cu_tru_phuong_xa_id',
    'don_vi_cong_tac_id',
    'so_dien_thoai_lien_he',
    'email_lien_he',
    'trinh_do_chuyen_mon',
    'trinh_do_chuyen_mon_khac',
    'cap_giang_day',
    'mon_giang_day_id',
    'ghi_chu',
  ];

  // So sánh dto (những field caller THỰC SỰ gửi lên) với hồ sơ cũ — chỉ field
  // nào có mặt trong dto VÀ giá trị (sau chuẩn hóa cho ho_ten) khác giá trị
  // cũ mới tính là 1 thay đổi. Không dùng "merged" (đã lấp field thiếu bằng
  // giá trị cũ) vì merged luôn khác undefined nên sẽ luôn "trông như đổi".
  private tinhDiffHoSo(
    existing: hoc_vien,
    dto: UpdateHocVienDto,
    hoTenChuan: string,
  ): { field: string; oldValue: string | null; newValue: string | null }[] {
    const diffs: {
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }[] = [];
    const dtoRecord = dto as unknown as Record<string, unknown>;
    const existingRecord = existing as unknown as Record<string, unknown>;
    for (const field of HocVienService.DIFF_FIELDS) {
      if (dtoRecord[field] === undefined) continue;
      const newRaw = field === 'ho_ten' ? hoTenChuan : dtoRecord[field];
      const oldRaw = existingRecord[field];
      const oldStr =
        oldRaw === null || oldRaw === undefined ? null : String(oldRaw);
      const newStr =
        newRaw === null || newRaw === undefined ? null : String(newRaw);
      if (oldStr !== newStr) {
        diffs.push({ field, oldValue: oldStr, newValue: newStr });
      }
    }
    return diffs;
  }

  private toResponse(hocVien: HocVienDayDu) {
    const { chuyen_mon, ...rest } = hocVien;
    return { ...rest, chuyen_mon: chuyen_mon.map((c) => c.chuyen_mon) };
  }

  private toResponseVoiTen(hocVien: HocVienDayDuVoiTen) {
    const {
      noi_sinh_dia_danh,
      phuong_xa,
      cu_tru_tinh,
      cu_tru_phuong_xa,
      don_vi_cong_tac,
      mon_giang_day,
      ...rest
    } = hocVien;
    return {
      // rest đã có sẵn noi_sinh_tinh/huyen/xa (text tự do) — không cần
      // resolve tên.
      ...this.toResponse(rest),
      // Deprecated: giữ trả về cho hồ sơ còn dữ liệu cũ (xem noi_sinh_dia_danh).
      noi_sinh_ten: noi_sinh_dia_danh?.ten ?? null,
      phuong_xa_ten: phuong_xa?.ten ?? null,
      cu_tru_tinh_ten: cu_tru_tinh?.ten ?? null,
      cu_tru_phuong_xa_ten: cu_tru_phuong_xa?.ten ?? null,
      don_vi_cong_tac_ten: don_vi_cong_tac.ten_don_vi,
      mon_giang_day_ten: mon_giang_day?.ten_mon ?? null,
    };
  }

  private async getHocVienCuaToi(
    caller: AuthenticatedUser,
  ): Promise<HocVienDayDuVoiTen> {
    if (!caller.hoc_vien_id) {
      throw new ForbiddenAppException(
        'Tài khoản hiện tại không gắn với hồ sơ học viên nào',
      );
    }
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { id: caller.hoc_vien_id },
      include: INCLUDE_HOC_VIEN_DAY_DU_VOI_TEN,
    });
    if (!hocVien) {
      throw new NotFoundAppException('Không tìm thấy hồ sơ học viên');
    }
    return hocVien;
  }

  // ---------------------------------------------------------------------
  // POST /hoc-vien — Luồng đăng ký (docs/api-contract.md mục 2)
  // ---------------------------------------------------------------------
  async dangKy(dto: CreateHocVienDto) {
    // Kiểm tra trùng ĐDCN riêng, TRƯỚC bộ validateHocVien dùng chung — theo
    // đúng quy ước lỗi chung (docs/api-contract.md mục "Quy ước chung > Lỗi":
    // CONFLICT 409 dùng cho "trùng ĐDCN..."), trong khi validateHocVien() gộp
    // mọi quy tắc (kể cả kiểm tra trùng) vào 1 danh sách loi dùng chung cho
    // dry-run (kiem-tra-truoc-xac-nhan trả 200 kèm loi[], không phải mã lỗi
    // HTTP riêng cho từng field).
    const trungSdd = await this.prisma.hoc_vien.findUnique({
      where: { so_dinh_danh_ca_nhan: dto.so_dinh_danh_ca_nhan },
    });
    if (trungSdd) {
      throw new ConflictAppException(
        'Số định danh cá nhân đã được dùng bởi học viên khác',
        [{ field: 'so_dinh_danh_ca_nhan', message: 'Đã tồn tại' }],
      );
    }

    const { loi } = await this.validateHocVien(dto, { requireFull: true });
    if (loi.length > 0) {
      throw new ValidationException('Dữ liệu đăng ký không hợp lệ', loi);
    }

    const hoTenChuan = normalizeNfcName(dto.ho_ten);
    const matKhau = matKhauMacDinhTuNgaySinh(
      dto.ngay_sinh,
      dto.thang_sinh,
      dto.nam_sinh,
    );
    const matKhauHash = await bcrypt.hash(matKhau, BCRYPT_SALT_ROUNDS);
    const chuyenMonChuan = Array.from(
      new Set(dto.chuyen_mon.map((c) => normalizeNfcName(c)).filter(Boolean)),
    );

    try {
      const ketQua = await this.prisma.$transaction(async (tx) => {
        // Thứ tự tạo bảng ĐẢO NGƯỢC so với văn bản "Luồng đăng ký" của
        // api-contract.md (vốn mô tả tạo nguoi_dung trước): DB CHECK
        // chk_nguoi_dung_scope bắt buộc nguoi_dung.hoc_vien_id NOT NULL NGAY
        // khi vai_tro='hoc_vien', nên không thể tạo nguoi_dung trước với
        // hoc_vien_id=NULL như mô tả gốc — phải tạo hoc_vien trước (created_by
        // để trống), tạo nguoi_dung với hoc_vien_id trỏ sẵn, rồi backfill
        // hoc_vien.created_by. Cùng 3 bảng ghi, cùng 1 transaction, chỉ khác
        // thứ tự — kết quả cuối giống hệt spec. Flagged trong self-review.
        const hocVien = await tx.hoc_vien.create({
          data: {
            nguon_tao: 'tu_dang_ky',
            ho_ten: hoTenChuan,
            so_dinh_danh_ca_nhan: dto.so_dinh_danh_ca_nhan,
            ngay_sinh: dto.ngay_sinh,
            thang_sinh: dto.thang_sinh,
            nam_sinh: dto.nam_sinh,
            gioi_tinh: dto.gioi_tinh,
            chuc_vu: dto.chuc_vu,
            doi_tuong: dto.doi_tuong,
            noi_sinh_tinh: dto.noi_sinh_tinh,
            noi_sinh_huyen: dto.noi_sinh_huyen,
            noi_sinh_xa: dto.noi_sinh_xa,
            don_vi_cong_tac_id: dto.don_vi_cong_tac_id,
            so_dien_thoai_lien_he: dto.so_dien_thoai_lien_he,
            email_lien_he: dto.email_lien_he,
            trinh_do_chuyen_mon: dto.trinh_do_chuyen_mon,
            trinh_do_chuyen_mon_khac: dto.trinh_do_chuyen_mon_khac,
            cap_giang_day: dto.cap_giang_day,
            mon_giang_day_id: dto.mon_giang_day_id,
            ghi_chu: dto.ghi_chu,
            chuyen_mon: {
              create: chuyenMonChuan.map((c) => ({ chuyen_mon: c })),
            },
          },
        });
        const nguoiDung = await tx.nguoi_dung.create({
          data: {
            ho_ten: hoTenChuan,
            email: dto.email_lien_he,
            ten_dang_nhap: dto.so_dinh_danh_ca_nhan,
            vai_tro: 'hoc_vien',
            don_vi_id: null,
            hoc_vien_id: hocVien.id,
            mat_khau_hash: matKhauHash,
            phai_doi_mat_khau: true,
          },
        });
        await tx.hoc_vien.update({
          where: { id: hocVien.id },
          data: { created_by: nguoiDung.id },
        });
        return {
          hoc_vien_id: hocVien.id,
          ten_dang_nhap: nguoiDung.ten_dang_nhap,
        };
      });

      return {
        ...ketQua,
        luu_y:
          'Mật khẩu mặc định là ngày sinh (định dạng ddmmyyyy) — bắt buộc đổi khi đăng nhập lần đầu',
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictAppException(
          'Số định danh cá nhân hoặc tên đăng nhập đã tồn tại',
        );
      }
      throw e;
    }
  }

  // ---------------------------------------------------------------------
  // GET/PATCH /hoc-vien/toi + chuyên môn + xác nhận
  // ---------------------------------------------------------------------
  async layHoSoCuaToi(caller: AuthenticatedUser) {
    const hocVien = await this.getHocVienCuaToi(caller);
    return this.toResponseVoiTen(hocVien);
  }

  async capNhatHoSoCuaToi(caller: AuthenticatedUser, dto: UpdateHocVienDto) {
    const existing = await this.getHocVienCuaToi(caller);
    const dot = await this.kiemTraEditableVaLayDot(existing);
    return this.suaHoSo(
      existing,
      dto,
      { id: caller.id, vai_tro: caller.vai_tro },
      dot,
      existing.nguon_tao === 'import_moet',
    );
  }

  // PATCH /hoc-vien/{id} (T14, quan_tri) — sửa hồ sơ import_moet NGOÀI thời
  // gian đợt (học viên chỉ xem lúc đó). KHÔNG bị chặn bởi kiemTraEditableVaLayDot
  // (đó là gate riêng cho học viên tự sửa) — quan_tri sửa được bất kỳ lúc
  // nào, với mọi hồ sơ (không chỉ import_moet, dù trong thực tế đây chủ yếu
  // dùng cho import_moet — tu_dang_ky vẫn có PATCH /hoc-vien/toi riêng cho
  // chính học viên). Vẫn ghi lịch sử + hủy xác nhận nếu đang có đợt mở trùng
  // lúc sửa, để dữ liệu nhất quán dù ai sửa.
  async suaHoSoByAdmin(
    id: string,
    dto: UpdateHocVienDto,
    caller: AuthenticatedUser,
  ) {
    const existing = await this.prisma.hoc_vien.findUnique({
      where: { id },
      include: { chuyen_mon: true },
    });
    if (!existing) {
      throw new NotFoundAppException('Không tìm thấy hồ sơ học viên');
    }
    const dot =
      existing.nguon_tao === 'import_moet'
        ? await this.dotXacNhanService.dotDangMoCuaHocVien(existing.id)
        : null;
    return this.suaHoSo(
      existing,
      dto,
      { id: caller.id, vai_tro: caller.vai_tro },
      dot,
      existing.nguon_tao === 'import_moet',
    );
  }

  // ADR 0003 H7 (PATCH /ho-tro/hoc-vien/{id}): người hỗ trợ học viên sửa hộ
  // như quan_tri (bỏ qua cổng đợt, đợt mở trùng -> hủy xác nhận) nhưng LUÔN
  // ghi lịch sử kèm lý do (kể cả hồ sơ tu_dang_ky) để truy vết người sửa.
  // KHÔNG kiểm tra phạm vi cụm — nơi gọi đã chặn qua HoTroHocVienScopeService.
  async suaHoSoBoiHoTro(
    id: string,
    dto: UpdateHocVienDto,
    caller: AuthenticatedUser,
    lyDo: string,
  ) {
    const existing = await this.prisma.hoc_vien.findUnique({
      where: { id },
      include: { chuyen_mon: true },
    });
    if (!existing) {
      throw new NotFoundAppException('Không tìm thấy hồ sơ học viên');
    }
    const dot =
      existing.nguon_tao === 'import_moet'
        ? await this.dotXacNhanService.dotDangMoCuaHocVien(existing.id)
        : null;
    return this.suaHoSo(
      existing,
      dto,
      { id: caller.id, vai_tro: caller.vai_tro },
      dot,
      true,
      lyDo,
    );
  }

  // Lõi dùng chung cho capNhatHoSoCuaToi (học viên) + suaHoSoByAdmin (quan_tri)
  // — chỉ khác ở việc gate quyền TRƯỚC khi gọi vào đây. ghiLichSu=true CHỈ
  // cho hồ sơ import_moet (rule T14 chỉ thay đổi hành vi cho nguồn này —
  // tu_dang_ky giữ nguyên như trước, không ghi lịch sử).
  private async suaHoSo(
    existing: HocVienDayDu,
    dto: UpdateHocVienDto,
    nguoiSua: { id: string; vai_tro: vai_tro_nguoi_dung },
    dot: dot_xac_nhan | null,
    ghiLichSu: boolean,
    lyDo: string | null = null,
  ) {
    const merged: HocVienValidateInput = {
      ho_ten: dto.ho_ten ?? existing.ho_ten,
      so_dinh_danh_ca_nhan:
        dto.so_dinh_danh_ca_nhan ?? existing.so_dinh_danh_ca_nhan,
      ngay_sinh: dto.ngay_sinh ?? existing.ngay_sinh,
      thang_sinh: dto.thang_sinh ?? existing.thang_sinh,
      nam_sinh: dto.nam_sinh ?? existing.nam_sinh,
      noi_sinh_tinh: dto.noi_sinh_tinh ?? existing.noi_sinh_tinh,
      noi_sinh_huyen: dto.noi_sinh_huyen ?? existing.noi_sinh_huyen,
      noi_sinh_xa: dto.noi_sinh_xa ?? existing.noi_sinh_xa,
      cu_tru_tinh_id: dto.cu_tru_tinh_id ?? existing.cu_tru_tinh_id,
      cu_tru_phuong_xa_id:
        dto.cu_tru_phuong_xa_id ?? existing.cu_tru_phuong_xa_id,
      don_vi_cong_tac_id: dto.don_vi_cong_tac_id ?? existing.don_vi_cong_tac_id,
      so_dien_thoai_lien_he:
        dto.so_dien_thoai_lien_he ?? existing.so_dien_thoai_lien_he,
      email_lien_he: dto.email_lien_he ?? existing.email_lien_he,
      trinh_do_chuyen_mon:
        dto.trinh_do_chuyen_mon ?? existing.trinh_do_chuyen_mon,
      trinh_do_chuyen_mon_khac:
        dto.trinh_do_chuyen_mon_khac ?? existing.trinh_do_chuyen_mon_khac,
      cap_giang_day: dto.cap_giang_day ?? existing.cap_giang_day,
      mon_giang_day_id: dto.mon_giang_day_id ?? existing.mon_giang_day_id,
    };

    const { loi } = await this.validateHocVien(merged, {
      requireFull: false,
      excludeHocVienId: existing.id,
    });
    if (loi.length > 0) {
      throw new ValidationException('Dữ liệu cập nhật không hợp lệ', loi);
    }

    const hoTenChuan = merged.ho_ten
      ? normalizeNfcName(merged.ho_ten)
      : existing.ho_ten;
    // Rule T14: đổi ngày sinh KHÔNG đổi mật khẩu (mật khẩu đã đổi ở lần đăng
    // nhập đầu, rule #35) — không có logic nào ở đây tự đổi mật khẩu, chỉ ghi
    // chú lại lý do vì đây là điểm dễ nhầm khi thấy ngay_sinh đổi.
    const diffs = ghiLichSu ? this.tinhDiffHoSo(existing, dto, hoTenChuan) : [];

    // Thêm 2026-09-30: đổi email_lien_he (dù qua PATCH /hoc-vien/toi hay
    // PATCH /hoc-vien/{id} — cả 2 dùng chung suaHoSo) reset email_da_xac_minh
    // về false và gửi lại email xác minh tới địa chỉ MỚI. dto.email_lien_he
    // có thể là null (xóa email) — lúc đó chỉ reset cờ, không gửi email nào.
    const emailMoi = dto.email_lien_he;
    const doiEmail =
      emailMoi !== undefined && emailMoi !== existing.email_lien_he;

    try {
      const { updated, xacNhanBiHuy } = await this.prisma.$transaction(
        async (tx) => {
          const updated = await tx.hoc_vien.update({
            where: { id: existing.id },
            data: {
              ho_ten: merged.ho_ten ? hoTenChuan : undefined,
              so_dinh_danh_ca_nhan: merged.so_dinh_danh_ca_nhan,
              ngay_sinh: merged.ngay_sinh,
              thang_sinh: merged.thang_sinh,
              nam_sinh: merged.nam_sinh,
              gioi_tinh: dto.gioi_tinh,
              chuc_vu: dto.chuc_vu,
              doi_tuong: dto.doi_tuong,
              noi_sinh_tinh: merged.noi_sinh_tinh,
              noi_sinh_huyen: merged.noi_sinh_huyen,
              noi_sinh_xa: merged.noi_sinh_xa,
              cu_tru_tinh_id: merged.cu_tru_tinh_id,
              cu_tru_phuong_xa_id: merged.cu_tru_phuong_xa_id,
              don_vi_cong_tac_id: merged.don_vi_cong_tac_id ?? undefined,
              so_dien_thoai_lien_he: merged.so_dien_thoai_lien_he ?? undefined,
              email_lien_he: merged.email_lien_he,
              email_da_xac_minh: doiEmail ? false : undefined,
              trinh_do_chuyen_mon: merged.trinh_do_chuyen_mon,
              trinh_do_chuyen_mon_khac: merged.trinh_do_chuyen_mon_khac,
              cap_giang_day: merged.cap_giang_day,
              mon_giang_day_id: merged.mon_giang_day_id,
              ghi_chu: dto.ghi_chu,
              // Rule #27 (chỉ áp dụng tu_dang_ky — import_moet luôn da_duyet
              // sẵn, không đi qua trang_thai='tu_choi'): hồ sơ bị tu_choi thì
              // sửa xong tự mở lại nhap (coi như resubmit chờ xác nhận lại).
              trang_thai:
                existing.trang_thai === 'tu_choi' ? 'nhap' : undefined,
            },
            include: { chuyen_mon: true },
          });

          let xacNhanBiHuy = false;
          if (ghiLichSu && diffs.length > 0) {
            await tx.lich_su_thay_doi_ho_so.createMany({
              data: diffs.map((d) => ({
                hoc_vien_id: existing.id,
                truong: d.field,
                gia_tri_cu: d.oldValue,
                gia_tri_moi: d.newValue,
                la_truong_goc_moet: HocVienService.TRUONG_GOC_MOET.has(d.field),
                nguoi_sua_id: nguoiSua.id,
                vai_tro_nguoi_sua: nguoiSua.vai_tro,
                dot_id: dot?.id ?? null,
                ly_do: lyDo,
              })),
            });
            // Rule T14: sửa tiếp sau khi đã xác nhận ở đợt đang mở -> hủy
            // xác nhận đó. Chỉ có ý nghĩa khi đang có đợt MỞ (dot != null) —
            // sửa ngoài giờ đợt (quan_tri) không "hủy" gì vì không có đợt
            // đang mở để đối chiếu.
            if (dot) {
              xacNhanBiHuy = await this.dotXacNhanService.huyXacNhanNeuCo(
                tx,
                dot.id,
                existing.id,
              );
            }
          }
          return { updated, xacNhanBiHuy };
        },
      );
      // Side effect NGOÀI transaction (giống nguyên tắc "email là side
      // effect" ở xacNhan()) — gửi thất bại không được rollback việc lưu hồ
      // sơ đã thành công.
      if (doiEmail && emailMoi) {
        await this.taoVaGuiXacMinhEmail(existing.id, emailMoi);
      }
      return { ...this.toResponse(updated), xac_nhan_bi_huy: xacNhanBiHuy };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictAppException('Số định danh cá nhân đã tồn tại');
      }
      throw e;
    }
  }

  // Thêm 2026-09-30: tạo token_xac_thuc (loai='xac_minh_email', hết hạn sau
  // 24 giờ) + gửi email chứa link FRONTEND_URL/xac-minh-email?token=... —
  // dùng chung bởi suaHoSo() (đổi email_lien_he) và guiLaiXacMinhEmail() (gửi
  // lại theo yêu cầu học viên).
  private async taoVaGuiXacMinhEmail(
    hocVienId: string,
    email: string,
  ): Promise<void> {
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { id: hocVienId },
      select: { ho_ten: true },
    });
    const { token, tokenHash } = taoTokenXacThuc();
    await this.prisma.token_xac_thuc.create({
      data: {
        hoc_vien_id: hocVienId,
        loai: 'xac_minh_email',
        token_hash: tokenHash,
        het_han_luc: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const link = `${layFrontendUrl()}/xac-minh-email?token=${token}`;
    await this.thongBaoService.guiXacMinhEmail(
      email,
      hocVien?.ho_ten ?? '',
      link,
      hocVienId,
    );
  }

  // POST /hoc-vien/toi/gui-lai-xac-minh-email — chặn spam đơn giản: không cho
  // gửi lại nếu còn token xac_minh_email hiệu lực tạo dưới 60 giây trước
  // (429 RATE_LIMITED, tái dùng cơ chế mã lỗi 429 hiện có thay vì tự chế mới).
  async guiLaiXacMinhEmail(
    caller: AuthenticatedUser,
  ): Promise<{ da_gui: true }> {
    const hocVien = await this.getHocVienCuaToi(caller);
    if (!hocVien.email_lien_he) {
      throw new ValidationException(
        'Chưa có email liên hệ trong hồ sơ, vui lòng bổ sung trước khi gửi xác minh',
        [{ field: 'email_lien_he', message: 'Chưa có email liên hệ' }],
      );
    }
    if (hocVien.email_da_xac_minh) {
      throw new ConflictAppException('Email liên hệ đã được xác minh');
    }

    const now = new Date();
    const tokenGanDay = await this.prisma.token_xac_thuc.findFirst({
      where: {
        hoc_vien_id: hocVien.id,
        loai: 'xac_minh_email',
        da_dung_luc: null,
        het_han_luc: { gt: now },
        tao_luc: { gt: new Date(now.getTime() - 60_000) },
      },
    });
    if (tokenGanDay) {
      throw new HttpException(
        'Vừa gửi email xác minh, vui lòng đợi ít phút rồi thử lại',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.taoVaGuiXacMinhEmail(hocVien.id, hocVien.email_lien_he);
    return { da_gui: true };
  }

  async themChuyenMon(caller: AuthenticatedUser, dto: ChuyenMonDto) {
    const hocVien = await this.getHocVienCuaToi(caller);
    const dot = await this.kiemTraEditableVaLayDot(hocVien);
    const chuyenMon = normalizeNfcName(dto.chuyen_mon);
    const ghiLichSu = hocVien.nguon_tao === 'import_moet';
    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.hoc_vien_chuyen_mon.create({
          data: { hoc_vien_id: hocVien.id, chuyen_mon: chuyenMon },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          throw new ConflictAppException('Chuyên môn này đã có trong hồ sơ');
        }
        throw e;
      }
      if (ghiLichSu) {
        await tx.lich_su_thay_doi_ho_so.create({
          data: {
            hoc_vien_id: hocVien.id,
            truong: 'chuyen_mon',
            gia_tri_cu: null,
            gia_tri_moi: chuyenMon,
            la_truong_goc_moet: true,
            nguoi_sua_id: caller.id,
            vai_tro_nguoi_sua: caller.vai_tro,
            dot_id: dot?.id ?? null,
          },
        });
        if (dot) {
          await this.dotXacNhanService.huyXacNhanNeuCo(tx, dot.id, hocVien.id);
        }
      }
    });
    return this.layHoSoCuaToi(caller);
  }

  async xoaChuyenMon(caller: AuthenticatedUser, dto: ChuyenMonDto) {
    const hocVien = await this.getHocVienCuaToi(caller);
    const dot = await this.kiemTraEditableVaLayDot(hocVien);
    const chuyenMon = normalizeNfcName(dto.chuyen_mon);
    const ghiLichSu = hocVien.nguon_tao === 'import_moet';
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.hoc_vien_chuyen_mon.deleteMany({
        where: { hoc_vien_id: hocVien.id, chuyen_mon: chuyenMon },
      });
      if (ghiLichSu && count > 0) {
        await tx.lich_su_thay_doi_ho_so.create({
          data: {
            hoc_vien_id: hocVien.id,
            truong: 'chuyen_mon',
            gia_tri_cu: chuyenMon,
            gia_tri_moi: null,
            la_truong_goc_moet: true,
            nguoi_sua_id: caller.id,
            vai_tro_nguoi_sua: caller.vai_tro,
            dot_id: dot?.id ?? null,
          },
        });
        if (dot) {
          await this.dotXacNhanService.huyXacNhanNeuCo(tx, dot.id, hocVien.id);
        }
      }
    });
    return this.layHoSoCuaToi(caller);
  }

  // GET /hoc-vien/toi/dot-xac-nhan (T14) — đợt đang mở/sắp mở (nếu hiện
  // không có đợt nào mở), da_xac_nhan (ở đợt ĐANG MỞ, nếu có), day_du/thieu
  // (T9, tái dùng danhGiaDayDu). Chỉ có ý nghĩa cho import_moet — tu_dang_ky
  // trả dot=null (không có khái niệm đợt xác nhận).
  async dotXacNhanCuaToi(caller: AuthenticatedUser) {
    const hocVien = await this.getHocVienCuaToi(caller);
    const { day_du, thieu } = await this.danhGiaDayDu(hocVien);

    const rong = {
      dot: null,
      dot_sap_mo: null,
      dang_mo: false,
      da_xac_nhan: false,
      xac_nhan_luc: null,
      can_xac_nhan_lai: false,
      dieu_chinh_luc: null,
      xac_nhan_gan_nhat: null,
    };
    if (hocVien.nguon_tao !== 'import_moet') {
      return { ...rong, ap_dung_dot: false, day_du, thieu };
    }

    // 2026-10-05: tách `dot` (CHỈ đợt đang mở) và `dot_sap_mo` — trước đây `dot` gộp cả đợt sắp mở
    // nên FE hiểu nhầm là đang mở.
    const dotMo = await this.dotXacNhanService.dotDangMoCuaHocVien(hocVien.id);
    if (!dotMo) {
      const [sapMo, ganNhat] = await Promise.all([
        this.dotXacNhanService.dotSapMoCuaHocVien(),
        this.dotXacNhanService.xacNhanConHieuLucGanNhat(hocVien.id),
      ]);
      return {
        ...rong,
        dot_sap_mo: sapMo ? { ten: sapMo.ten, mo_luc: sapMo.mo_luc } : null,
        xac_nhan_gan_nhat: ganNhat
          ? { dot_ten: ganNhat.dot.ten, xac_nhan_luc: ganNhat.xac_nhan_luc }
          : null,
        ap_dung_dot: true,
        day_du,
        thieu,
      };
    }

    const { conHieuLuc, biHuyGanNhat } =
      await this.dotXacNhanService.trangThaiXacNhanTrongDot(
        dotMo.id,
        hocVien.id,
      );
    return {
      ...rong,
      dot: {
        id: dotMo.id,
        ten: dotMo.ten,
        loai: dotMo.loai,
        mo_luc: dotMo.mo_luc,
        dong_luc: dotMo.dong_luc,
      },
      dang_mo: true,
      da_xac_nhan: conHieuLuc !== null,
      xac_nhan_luc: conHieuLuc?.xac_nhan_luc ?? null,
      // Đã xác nhận rồi sửa hồ sơ (xác nhận tự hủy) -> cần xác nhận lại.
      can_xac_nhan_lai: !conHieuLuc && biHuyGanNhat !== null,
      dieu_chinh_luc: !conHieuLuc
        ? (biHuyGanNhat?.vo_hieu_luc_luc ?? null)
        : null,
      ap_dung_dot: true,
      day_du,
      thieu,
    };
  }

  // GET /hoc-vien/toi/danh-gia-dau-vao (T15, QĐ8/QĐ9) — cổng điều kiện làm
  // đánh giá đầu vào. Đủ điều kiện = có xác nhận CÒN HIỆU LỰC ở đợt
  // xac_nhan_truoc_danh_gia (Đợt 2) VÀ day_du=true TẠI THỜI ĐIỂM GỌI (không
  // phải tại lúc xác nhận — sửa hồ sơ sau khi xác nhận đã tự hủy xác nhận đó
  // rồi, xem HocVienService.suaHoSo, nên check day_du ở đây chủ yếu bắt case
  // quan_tri sửa hồ sơ hộ qua PATCH /hoc-vien/{id} làm hồ sơ không còn đầy đủ
  // mà KHÔNG hủy xác nhận — xem ghi chú suaHoSoByAdmin). Chưa đủ điều kiện
  // TUYỆT ĐỐI không trả bất kỳ thông tin tai_khoan_vle nào (QĐ8: cách B chặn
  // mềm nhưng lộ đường dẫn/tài khoản cho người chưa đủ điều kiện vẫn là rò
  // rỉ không mong muốn).
  //
  // 2026-10-02: rẽ nhánh theo kênh trong cấu hình khảo sát. Kênh 'sso' chỉ cần
  // hồ sơ đầy đủ — link thật được cấp lúc bấm (POST /sso/cap-ma, mã dùng 1
  // lần), endpoint này KHÔNG trả link để mã không bị tạo thừa/hết hạn sẵn.
  // Kênh lấy theo cấu hình áp dụng cho CHÍNH học viên này (khóa đã ghi danh có
  // cấu hình riêng, không thì cấu hình chung — CauHinhKhaoSatService.layChoHocVien).
  async danhGiaDauVaoCuaToi(caller: AuthenticatedUser) {
    const hocVien = await this.getHocVienCuaToi(caller);
    const kenh = await this.cauHinhKhaoSatService.layKenhDanhGia(hocVien.id);
    if (hocVien.doi_tuong === 'nhan_vien') {
      return { kenh, du_dieu_kien: false, ...KHAO_SAT_CHUA_TRIEN_KHAI };
    }
    if (kenh === 'sso') {
      const { day_du, thieu } = await this.danhGiaDayDu(hocVien);
      return day_du
        ? { kenh, du_dieu_kien: true }
        : { kenh, du_dieu_kien: false, ly_do: thieu.map((t) => t.message) };
    }
    return { kenh, ...(await this.danhGiaDauVaoQuaVle(caller)) };
  }

  // Khảo sát đầu ra qua SSO (target 'dau-ra'): quản trị bật ở cấu hình khảo sát,
  // điều kiện giống kênh sso đầu vào — chỉ cần hồ sơ đầy đủ (T9).
  async khaoSatDauRaCuaToi(caller: AuthenticatedUser) {
    const hocVien = await this.getHocVienCuaToi(caller);
    if (!(await this.cauHinhKhaoSatService.khaoSatDauRaDangMo(hocVien.id))) {
      return { mo: false as const };
    }
    if (hocVien.doi_tuong === 'nhan_vien') {
      return {
        mo: true as const,
        du_dieu_kien: false,
        ...KHAO_SAT_CHUA_TRIEN_KHAI,
      };
    }
    const { day_du, thieu } = await this.danhGiaDayDu(hocVien);
    return day_du
      ? { mo: true as const, du_dieu_kien: true }
      : {
          mo: true as const,
          du_dieu_kien: false,
          ly_do: thieu.map((t) => t.message),
        };
  }

  private async danhGiaDauVaoQuaVle(caller: AuthenticatedUser) {
    const hocVien = await this.getHocVienCuaToi(caller);
    const { day_du, thieu } = await this.danhGiaDayDu(hocVien);
    const daXacNhanDot2 =
      await this.dotXacNhanService.coXacNhanTruocDanhGiaConHieuLuc(hocVien.id);

    if (daXacNhanDot2 && day_du) {
      const taiKhoan = await this.prisma.tai_khoan_vle.findUnique({
        where: { hoc_vien_id: hocVien.id },
      });
      if (!taiKhoan) {
        // Chưa thấy trong thực tế nếu đúng trình tự vận hành (xuất-cho-vle
        // -> Phòng CNTT tạo tài khoản cho TẤT CẢ -> import tai_khoan_vle,
        // xong mới mở đợt 2) — nhưng vẫn xử lý an toàn thay vì throw 500 nếu
        // trình tự bị đảo; flagged trong self-review.
        return {
          du_dieu_kien: false,
          ly_do: ['Chưa có tài khoản VLE — Phòng CNTT chưa cấp'],
        };
      }
      if (!taiKhoan.lan_dau_xem_luc) {
        await this.prisma.tai_khoan_vle.update({
          where: { hoc_vien_id: hocVien.id },
          data: { lan_dau_xem_luc: new Date() },
        });
      }
      return {
        du_dieu_kien: true,
        duong_dan: taiKhoan.duong_dan,
        ten_dang_nhap_vle: taiKhoan.ten_dang_nhap_vle,
        mat_khau_tam: taiKhoan.mat_khau_tam_ma_hoa
          ? decryptVleMatKhau(taiKhoan.mat_khau_tam_ma_hoa)
          : null,
      };
    }

    const dot = await this.dotXacNhanService.dotXacNhanTruocDanhGiaApDung(
      hocVien.id,
    );
    const now = new Date();
    if (dot && dot.dong_luc <= now) {
      // QĐ9: đợt 2 đã đóng mà vẫn chưa đủ điều kiện -> vào danh sách xử lý
      // riêng (GET /bao-cao/dieu-kien-danh-gia), không còn cơ hội tự bổ sung.
      return { du_dieu_kien: false, het_han: true };
    }

    const lyDo: string[] = [];
    if (!daXacNhanDot2) {
      lyDo.push('Chưa xác nhận hồ sơ ở đợt xác nhận trước đánh giá (đợt 2)');
    }
    if (!day_du) lyDo.push(...thieu.map((t) => t.message));

    return {
      du_dieu_kien: false,
      ly_do: lyDo,
      dot: dot
        ? {
            id: dot.id,
            ten: dot.ten,
            loai: dot.loai,
            mo_luc: dot.mo_luc,
            dong_luc: dot.dong_luc,
          }
        : null,
    };
  }

  async kiemTraTruocXacNhan(caller: AuthenticatedUser) {
    const hocVien = await this.getHocVienCuaToi(caller);
    return this.validateHocVien(
      { ...hocVien, chuyen_mon: hocVien.chuyen_mon.map((c) => c.chuyen_mon) },
      { requireFull: true, excludeHocVienId: hocVien.id },
    );
  }

  // ---------------------------------------------------------------------
  // T9 — Hồ sơ đầy đủ (mo-rong-nls-an-giang.md mục T9). "Đầy đủ" = qua toàn
  // bộ quy tắc của luồng tu_dang_ky (validateHocVien requireFull=true) —
  // TRỪ cảnh báo (canh_bao không làm hồ sơ "chưa đầy đủ"). Không lưu cột
  // tính sẵn — luôn tính lại từ dữ liệu hiện tại, tái dùng đúng 1 bộ quy tắc
  // với kiemTraTruocXacNhan()/xacNhan().
  // ---------------------------------------------------------------------
  async danhGiaDayDu(
    hocVien: HocVienDayDu,
  ): Promise<{ day_du: boolean; thieu: FieldMessage[] }> {
    const { loi } = await this.validateHocVien(
      { ...hocVien, chuyen_mon: hocVien.chuyen_mon.map((c) => c.chuyen_mon) },
      { requireFull: true, excludeHocVienId: hocVien.id },
    );
    // 2026-10-02: "Đối tượng" (GV/CBQL) bắt buộc cho "đầy đủ" nhưng KHÔNG đặt
    // trong validateHocVien — bộ quy tắc đó còn dùng cho POST /hoc-vien (tự
    // đăng ký), thêm vào đó sẽ chặn các luồng tạo hồ sơ hiện có.
    if (!hocVien.doi_tuong) {
      loi.push({
        field: 'doi_tuong',
        message:
          'Chưa chọn đối tượng (giáo viên, cán bộ quản lý hoặc nhân viên)',
      });
    }
    return { day_du: loi.length === 0, thieu: loi };
  }

  async mucDoDayDuCuaToi(caller: AuthenticatedUser) {
    const hocVien = await this.getHocVienCuaToi(caller);
    return this.danhGiaDayDu(hocVien);
  }

  // POST /hoc-vien/toi/xac-nhan — chuyển nhap/tu_choi -> cho_duyet (stub gửi
  // email); nếu đã da_duyet (tu_dang_ky đã duyệt) thì chỉ gửi lại email,
  // KHÔNG đổi trang_thai (api-contract.md mục 2: "chỉ dùng nó nếu muốn gửi
  // lại email xác nhận sau khi bổ sung thông tin"). T14: import_moet đi qua
  // nhánh RIÊNG hoàn toàn (xacNhanImportMoet) — tạo xac_nhan_ho_so gắn với
  // đợt đang mở, thay vì chỉ resend email như trước.
  async xacNhan(caller: AuthenticatedUser) {
    const hocVien = await this.getHocVienCuaToi(caller);

    if (hocVien.nguon_tao === 'import_moet') {
      return this.xacNhanImportMoet(hocVien);
    }

    if (hocVien.trang_thai === 'nhap' || hocVien.trang_thai === 'tu_choi') {
      const { loi } = await this.validateHocVien(
        { ...hocVien, chuyen_mon: hocVien.chuyen_mon.map((c) => c.chuyen_mon) },
        { requireFull: true, excludeHocVienId: hocVien.id },
      );
      if (loi.length > 0) {
        throw new ValidationException(
          'Hồ sơ chưa đầy đủ/hợp lệ, không thể xác nhận',
          loi,
        );
      }
      const updated = await this.prisma.hoc_vien.update({
        where: { id: hocVien.id },
        data: { trang_thai: 'cho_duyet', email_ban_sao_da_gui_at: new Date() },
        include: { chuyen_mon: true },
      });
      await this.thongBaoService.guiHocVienXacNhan(hocVien.id);
      return this.toResponse(updated);
    }

    if (hocVien.trang_thai === 'da_duyet') {
      const updated = await this.prisma.hoc_vien.update({
        where: { id: hocVien.id },
        data: { email_ban_sao_da_gui_at: new Date() },
        include: { chuyen_mon: true },
      });
      await this.thongBaoService.guiHocVienXacNhan(hocVien.id);
      return this.toResponse(updated);
    }

    throw new ConflictAppException(
      `Hồ sơ đang ở trạng thái "${hocVien.trang_thai}", không thể xác nhận`,
    );
  }

  // T14: POST /hoc-vien/toi/xac-nhan với import_moet — bắt buộc có đợt đang
  // mở (không thì không có gì để gắn xác nhận vào -> DOT_XAC_NHAN_DONG,
  // cùng mã lỗi với PATCH để FE xử lý thống nhất) VÀ day_du=true (T9); tạo
  // xac_nhan_ho_so có bản chụp hồ sơ tại thời điểm xác nhận, gửi email bản
  // sao (sự kiện hoc_vien_xac_nhan như cũ).
  private async xacNhanImportMoet(hocVien: HocVienDayDuVoiTen) {
    const dot = await this.dotXacNhanService.dotDangMoCuaHocVien(hocVien.id);
    if (!dot) throw new DotXacNhanDongException();

    // 2026-10-05: đã xác nhận (còn hiệu lực) thì khóa — chỉ mở lại khi học viên sửa hồ sơ (sửa hồ sơ
    // tự hủy xác nhận, xem suaHoSo).
    if (await this.dotXacNhanService.coXacNhanConHieuLuc(dot.id, hocVien.id)) {
      throw new ConflictAppException(
        'Thầy/Cô đã xác nhận hồ sơ ở đợt này. Chỉ cần xác nhận lại khi có điều chỉnh thông tin.',
      );
    }

    const { day_du, thieu } = await this.danhGiaDayDu(hocVien);
    if (!day_du) {
      throw new ValidationException(
        'Hồ sơ chưa đầy đủ, không thể xác nhận',
        thieu,
      );
    }

    const snapshot = this.toResponse(
      hocVien,
    ) as unknown as Prisma.InputJsonValue;
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.dotXacNhanService.taoXacNhan(tx, dot.id, hocVien.id, snapshot);
      return tx.hoc_vien.update({
        where: { id: hocVien.id },
        data: { email_ban_sao_da_gui_at: new Date() },
        include: { chuyen_mon: true },
      });
    });
    await this.thongBaoService.guiHocVienXacNhan(hocVien.id);
    return this.toResponse(updated);
  }

  // ---------------------------------------------------------------------
  // GET /hoc-vien, GET /hoc-vien/{id}, GET /hoc-vien/kiem-tra-trung
  // ---------------------------------------------------------------------
  async findAll(query: QueryHocVienDto, caller: AuthenticatedUser) {
    const scope = await this.scopeService.getAccessibleDonViIds(caller);
    const where: Prisma.hoc_vienWhereInput = {};

    if (scope !== 'ALL') {
      if (
        query.don_vi_cong_tac_id &&
        !scope.includes(query.don_vi_cong_tac_id)
      ) {
        throw new ForbiddenAppException(
          'Đơn vị công tác nằm ngoài phạm vi quyền',
        );
      }
      where.don_vi_cong_tac_id = query.don_vi_cong_tac_id
        ? query.don_vi_cong_tac_id
        : { in: scope };
    } else if (query.don_vi_cong_tac_id) {
      where.don_vi_cong_tac_id = query.don_vi_cong_tac_id;
    }

    if (query.trang_thai) where.trang_thai = query.trang_thai;
    if (query.cap_giang_day) where.cap_giang_day = query.cap_giang_day;
    if (query.nguon_tao) where.nguon_tao = query.nguon_tao;
    if (query.q) {
      // ho_ten tìm không phân biệt dấu/hoa-thường (unaccent) — CCCD/mã MOET giữ nguyên khớp chính
      // xác theo chuỗi con như trước (không áp dụng unaccent cho số/mã định danh).
      const dk = dieuKienKhongDau(Prisma.sql`ho_ten`, query.q);
      const idsTheoTen = dk
        ? (
            await this.prisma.$queryRaw<{ id: string }[]>(
              Prisma.sql`SELECT id FROM "hoc_vien" WHERE ${dk}`,
            )
          ).map((r) => r.id)
        : [];
      where.OR = [
        { id: { in: idsTheoTen } },
        { so_dinh_danh_ca_nhan: { contains: query.q } },
        { ma_dinh_danh_moet: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;

    // T9: day_du không phải cột DB (luôn tính lại, xem danhGiaDayDu) — phải
    // lấy TOÀN BỘ hồ sơ khớp các filter khác rồi lọc/trang trong bộ nhớ.
    // Chấp nhận đánh đổi hiệu năng ở quy mô hiện tại (~9.000 hồ sơ/lần đôn
    // đốc, không phải endpoint tần suất cao) — flagged trong self-review,
    // cần đánh giá lại nếu số lượng hồ sơ tăng đáng kể.
    if (query.day_du !== undefined) {
      const candidates = await this.prisma.hoc_vien.findMany({
        where,
        include: { chuyen_mon: true },
        orderBy: { created_at: 'desc' },
      });
      const danhGia = await Promise.all(
        candidates.map(async (hv) => ({
          hv,
          dayDu: (await this.danhGiaDayDu(hv)).day_du,
        })),
      );
      const filtered = danhGia
        .filter((d) => d.dayDu === query.day_du)
        .map((d) => this.toResponse(d.hv));
      const start = (page - 1) * pageSize;
      const data = filtered.slice(start, start + pageSize);
      return paginate(data, filtered.length, page, pageSize);
    }

    const [data, total] = await Promise.all([
      this.prisma.hoc_vien.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.hoc_vien.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOne(id: string, caller: AuthenticatedUser) {
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { id },
      include: INCLUDE_HOC_VIEN_DAY_DU_VOI_TEN,
    });
    if (!hocVien)
      throw new NotFoundAppException('Không tìm thấy hồ sơ học viên');
    const coQuyen = await this.scopeService.canAccessDonVi(
      caller,
      hocVien.don_vi_cong_tac_id,
    );
    if (!coQuyen) {
      throw new ForbiddenAppException(
        'Hồ sơ này nằm ngoài phạm vi quyền của tài khoản hiện tại',
      );
    }
    return this.toResponseVoiTen(hocVien);
  }

  // ADR 0003 (người hỗ trợ học viên): hồ sơ kèm tên + mức đầy đủ. KHÔNG kiểm
  // tra phạm vi — nơi gọi đã chặn qua HoTroHocVienScopeService.
  async hoSoVoiTenKhongKiemPhamVi(id: string) {
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { id },
      include: INCLUDE_HOC_VIEN_DAY_DU_VOI_TEN,
    });
    if (!hocVien) {
      throw new NotFoundAppException('Không tìm thấy hồ sơ học viên');
    }
    const { day_du, thieu } = await this.danhGiaDayDu(hocVien);
    return { ...this.toResponseVoiTen(hocVien), day_du, thieu };
  }

  async kiemTraTrung(soDinhDanh: string) {
    if (!/^[0-9]{12}$/.test(soDinhDanh)) {
      throw new ValidationException(
        'Số định danh cá nhân phải gồm đúng 12 chữ số',
        [{ field: 'so_dinh_danh_ca_nhan', message: 'Phải gồm đúng 12 chữ số' }],
      );
    }
    const existing = await this.prisma.hoc_vien.findUnique({
      where: { so_dinh_danh_ca_nhan: soDinhDanh },
    });
    return { ton_tai: existing !== null };
  }

  // ---------------------------------------------------------------------
  // POST /hoc-vien/{id}/duyet — routing theo cap_giang_day (rule #25b, #29-31)
  // ---------------------------------------------------------------------
  async duyet(id: string, dto: DuyetHocVienDto, caller: AuthenticatedUser) {
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { id },
      include: { don_vi_cong_tac: true },
    });
    if (!hocVien)
      throw new NotFoundAppException('Không tìm thấy hồ sơ học viên');

    if (hocVien.nguon_tao !== 'tu_dang_ky') {
      throw new ConflictAppException(
        'Hồ sơ nhập từ CSDL MOET đã ở trạng thái duyệt sẵn, không qua bước duyệt này',
      );
    }
    if (hocVien.trang_thai !== 'cho_duyet') {
      throw new ConflictAppException(
        `Hồ sơ đang ở trạng thái "${hocVien.trang_thai}", không thể duyệt`,
      );
    }

    const donViDuyet = await this.resolveDonViDuyet(
      hocVien.cap_giang_day,
      hocVien.don_vi_cong_tac.dia_ban_id,
    );
    const coQuyen = await this.scopeService.canAccessDonVi(
      caller,
      donViDuyet.id,
    );
    if (!coQuyen) {
      throw new ForbiddenAppException(
        'Không có quyền duyệt hồ sơ — nằm ngoài phạm vi đơn vị duyệt phụ trách',
      );
    }

    const ghiChuMoi =
      dto.ket_qua === 'tu_choi' && dto.ly_do
        ? `${hocVien.ghi_chu ? hocVien.ghi_chu + '\n' : ''}[Từ chối] ${dto.ly_do}`
        : hocVien.ghi_chu;

    const updated = await this.prisma.hoc_vien.update({
      where: { id },
      data: {
        trang_thai: dto.ket_qua,
        nguoi_duyet_id: caller.id,
        cap_duyet_thuc_te: caller.vai_tro,
        ngay_duyet: new Date(),
        ghi_chu: ghiChuMoi,
      },
      include: { chuyen_mon: true },
    });
    await this.thongBaoService.guiHocVienDuyet(id, dto.ket_qua, dto.ly_do);
    return this.toResponse(updated);
  }

  // Rule #25b: THPT/NULL -> Sở GD&ĐT quản lý tỉnh chứa dia_ban_id của đơn vị
  // công tác; MN/TH/THCS -> Phòng VHXH quản lý đúng xã đó. Định tuyến theo
  // cây địa lý (dia_danh), KHÔNG theo don_vi_cha_id (chỉ dùng cho phân quyền
  // escalation qua ScopeService, xem docs/database-ddl.sql comment).
  private async resolveDonViDuyet(
    capGiangDay: cap_hoc | null,
    xaId: string,
  ): Promise<{ id: string }> {
    if (capGiangDay === null || capGiangDay === 'thpt') {
      const xa = await this.prisma.dia_danh.findUnique({ where: { id: xaId } });
      if (!xa || !xa.parent_id) {
        throw new NotFoundAppException(
          'Không xác định được tỉnh/thành quản lý địa bàn của đơn vị công tác',
        );
      }
      const so = await this.prisma.don_vi_cong_tac.findFirst({
        where: { loai_don_vi: 'so_gddt', dia_ban: { parent_id: xa.parent_id } },
      });
      if (!so) {
        throw new NotFoundAppException(
          'Không tìm thấy Sở GD&ĐT quản lý tỉnh/thành tương ứng trong danh mục',
        );
      }
      return so;
    }

    const phong = await this.prisma.don_vi_cong_tac.findFirst({
      where: { loai_don_vi: 'phong_vhxh', dia_ban_id: xaId },
    });
    if (!phong) {
      throw new NotFoundAppException(
        'Không tìm thấy Phòng Văn hóa - Xã hội quản lý địa bàn tương ứng trong danh mục',
      );
    }
    return phong;
  }

  // ---------------------------------------------------------------------
  // Import CSDL MOET (gọi từ ImportService — validation-checklist.md #36b-36f)
  // ---------------------------------------------------------------------
  // T4d (2026-09-30): dupKeys — cùng cơ chế Set<string> dùng bởi
  // KhoaBoiDuongService.resolveLopVaLichHocRow (phát hiện trùng NỘI BỘ file,
  // không phải ràng buộc DB) — 1 Set dùng chung cho ma_dinh_danh_moet VÀ
  // so_dinh_danh_ca_nhan, phân biệt bằng prefix "moet:"/"cccd:". Không có
  // cơ chế này thì 2 dòng trùng mã trong CÙNG FILE đều "pass" ở bước preview
  // (DB chưa ghi gì), chỉ lộ ra lỗi mới ở bước xác nhận khi dòng đầu đã
  // commit — gây bất ngờ cho người dùng (số lỗi tăng sau khi xác nhận).
  async checkValidMoetImportRow(
    input: {
      ma_dinh_danh_moet?: string;
      so_dinh_danh_ca_nhan?: string;
      ho_ten: string;
      ngay_sinh: number;
      thang_sinh: number;
      nam_sinh: number;
      so_dien_thoai_lien_he?: string;
      chuyen_mon: string[];
      don_vi_cong_tac_id: string;
    },
    dupKeys?: Set<string>,
  ): Promise<void> {
    const loi: FieldMessage[] = [];

    // T4b (2026-09-29): mã CSDL MOET và CCCD không giả định trùng nhau, một
    // số trường không báo được mã CSDL MOET — chỉ bắt buộc có ÍT NHẤT 1
    // trong 2 (khớp chk_hoc_vien_nguon_tao đã nới lỏng ở DB).
    if (!input.ma_dinh_danh_moet && !input.so_dinh_danh_ca_nhan) {
      loi.push({
        field: 'ma_dinh_danh_moet',
        message:
          'Thiếu cả Mã định danh CSDL MOET và Số định danh cá nhân — phải có ít nhất 1',
      });
    }

    if (input.ma_dinh_danh_moet) {
      const moetKey = `moet:${input.ma_dinh_danh_moet}`;
      if (dupKeys?.has(moetKey)) {
        loi.push({
          field: 'ma_dinh_danh_moet',
          message:
            'Mã định danh CSDL MOET bị trùng với dòng khác trong cùng file',
        });
      } else {
        const trungMoet = await this.prisma.hoc_vien.findUnique({
          where: { ma_dinh_danh_moet: input.ma_dinh_danh_moet },
        });
        if (trungMoet) {
          loi.push({
            field: 'ma_dinh_danh_moet',
            message: 'Mã định danh CSDL MOET đã tồn tại (rule #36f)',
          });
        }
        dupKeys?.add(moetKey);
      }
    }

    if (input.so_dinh_danh_ca_nhan) {
      loi.push(...validateSoDinhDanh(input.so_dinh_danh_ca_nhan));
      const cccdKey = `cccd:${input.so_dinh_danh_ca_nhan}`;
      if (dupKeys?.has(cccdKey)) {
        loi.push({
          field: 'so_dinh_danh_ca_nhan',
          message:
            'Số định danh cá nhân bị trùng với dòng khác trong cùng file',
        });
      } else {
        const trungSdd = await this.prisma.hoc_vien.findUnique({
          where: { so_dinh_danh_ca_nhan: input.so_dinh_danh_ca_nhan },
        });
        if (trungSdd) {
          loi.push({
            field: 'so_dinh_danh_ca_nhan',
            message: 'Số định danh cá nhân đã tồn tại ở hồ sơ học viên khác',
          });
        }
        dupKeys?.add(cccdKey);
      }
    }

    loi.push(...validateHoTen(input.ho_ten).loi);
    loi.push(
      ...validateNgayThangNamSinh(
        input.ngay_sinh,
        input.thang_sinh,
        input.nam_sinh,
      ),
    );
    // T4c (2026-09-30): so_dien_thoai_lien_he giờ TÙY CHỌN ở luồng import_moet
    // (danh sách tiếp nhận MOET thực tế có dòng thiếu cả SĐT lẫn chuyên môn)
    // — chỉ validate ĐỊNH DẠNG khi CÓ giá trị, không còn bắt buộc phải có.
    // Bổ sung sau qua PATCH /hoc-vien/toi, chặn khi xác nhận bởi
    // validateHocVien(requireFull=true) — vẫn coi trường này là bắt buộc.
    if (input.so_dien_thoai_lien_he) {
      loi.push(...validateSoDienThoai(input.so_dien_thoai_lien_he));
    }

    const donVi = await this.prisma.don_vi_cong_tac.findUnique({
      where: { id: input.don_vi_cong_tac_id },
    });
    if (!donVi) {
      loi.push({
        field: 'don_vi_cong_tac_id',
        message: 'Đơn vị công tác không tồn tại',
      });
    } else if (
      donVi.trang_thai !== 'active' ||
      donVi.loai_don_vi !== 'truong'
    ) {
      loi.push({
        field: 'don_vi_cong_tac_id',
        message: 'Đơn vị công tác phải đang hoạt động và thuộc loại Trường',
      });
    }

    // T4c: mảng chuyên môn rỗng giờ hợp lệ (bổ sung sau) — bỏ báo lỗi cứng.

    if (loi.length > 0) {
      throw new ValidationException('Dòng dữ liệu không hợp lệ', loi);
    }
  }

  async createFromMoetImport(
    input: {
      ma_dinh_danh_moet?: string;
      so_dinh_danh_ca_nhan?: string;
      ho_ten: string;
      ngay_sinh: number;
      thang_sinh: number;
      nam_sinh: number;
      chuc_vu?: string;
      don_vi_cong_tac_id: string;
      so_dien_thoai_lien_he?: string;
      ghi_chu?: string;
      chuyen_mon: string[];
    },
    nguoiImportId: string,
    dupKeys?: Set<string>,
  ): Promise<hoc_vien> {
    await this.checkValidMoetImportRow(input, dupKeys);

    const hoTenChuan = normalizeNfcName(input.ho_ten);
    const matKhau = matKhauMacDinhTuNgaySinh(
      input.ngay_sinh,
      input.thang_sinh,
      input.nam_sinh,
    );
    const matKhauHash = await bcrypt.hash(matKhau, BCRYPT_SALT_ROUNDS);
    const chuyenMonChuan = Array.from(
      new Set(input.chuyen_mon.map((c) => normalizeNfcName(c)).filter(Boolean)),
    );
    // checkValidMoetImportRow() đã đảm bảo có ít nhất 1 trong 2 — ưu tiên mã
    // MOET làm ten_dang_nhap khi dòng có cả 2 (T4b, rule #34/#34b).
    const tenDangNhap = input.ma_dinh_danh_moet ?? input.so_dinh_danh_ca_nhan!;

    // Cùng lý do đảo thứ tự như dangKy() — xem comment ở đó (chk_nguoi_dung_scope).
    return this.prisma.$transaction(async (tx) => {
      const hocVien = await tx.hoc_vien.create({
        data: {
          nguon_tao: 'import_moet',
          ma_dinh_danh_moet: input.ma_dinh_danh_moet,
          so_dinh_danh_ca_nhan: input.so_dinh_danh_ca_nhan,
          ho_ten: hoTenChuan,
          ngay_sinh: input.ngay_sinh,
          thang_sinh: input.thang_sinh,
          nam_sinh: input.nam_sinh,
          chuc_vu: input.chuc_vu,
          don_vi_cong_tac_id: input.don_vi_cong_tac_id,
          so_dien_thoai_lien_he: input.so_dien_thoai_lien_he,
          ghi_chu: input.ghi_chu,
          trang_thai: 'da_duyet',
          nguoi_duyet_id: nguoiImportId,
          cap_duyet_thuc_te: 'quan_tri',
          ngay_duyet: new Date(),
          chuyen_mon: {
            create: chuyenMonChuan.map((c) => ({ chuyen_mon: c })),
          },
        },
      });
      const nguoiDung = await tx.nguoi_dung.create({
        data: {
          ho_ten: hoTenChuan,
          email: null,
          ten_dang_nhap: tenDangNhap,
          vai_tro: 'hoc_vien',
          don_vi_id: null,
          hoc_vien_id: hocVien.id,
          mat_khau_hash: matKhauHash,
          phai_doi_mat_khau: true,
        },
      });
      return tx.hoc_vien.update({
        where: { id: hocVien.id },
        data: { created_by: nguoiDung.id },
      });
    });
  }
}
