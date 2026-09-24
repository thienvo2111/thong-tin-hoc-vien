// Hàm validate thuần (không phụ thuộc Prisma) cho hoc_vien — dùng chung bởi
// HocVienService (tự đăng ký + PATCH bổ sung) và luồng import CSDL MOET.
// Tham chiếu: docs/validation-checklist.md mục "Họ và tên" .. "Trình độ &
// chuyên môn" (quy tắc #1-26b).

export interface FieldMessage {
  field: string;
  message: string;
}

// Rule #2: chỉ chữ cái + khoảng trắng, không số/ký tự đặc biệt. Dùng \p{L}
// (mọi chữ cái Unicode) thay vì liệt kê thủ công bảng chữ cái tiếng Việt có
// dấu — thực dụng hơn, chấp nhận rộng hơn "chỉ tiếng Việt" một chút (flag
// trong self-review).
const HO_TEN_REGEX = /^[\p{L}\s]+$/u;

// Rule #20: 10 số bắt đầu bằng 0, hoặc +84 theo sau 9 số.
const SO_DIEN_THOAI_REGEX = /^(0\d{9}|\+84\d{9})$/;

// Rule #21: RFC 5322 rút gọn — pattern thực dụng dùng phổ biến, không đầy đủ
// RFC nhưng đủ chặt cho form nhập liệu.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SO_DINH_DANH_REGEX = /^[0-9]{12}$/;

export function validateHoTen(hoTenRaw: string): {
  loi: FieldMessage[];
  canhBao: FieldMessage[];
  normalized: string;
} {
  const loi: FieldMessage[] = [];
  const canhBao: FieldMessage[] = [];

  const trimmedCollapsed = hoTenRaw.trim().replace(/\s+/g, ' ');
  if (hoTenRaw !== trimmedCollapsed) {
    // Rule #5
    canhBao.push({
      field: 'ho_ten',
      message: 'Có khoảng trắng thừa đầu/cuối hoặc liên tiếp — đã tự chuẩn hóa',
    });
  }

  if (!HO_TEN_REGEX.test(trimmedCollapsed)) {
    // Rule #2
    loi.push({
      field: 'ho_ten',
      message: 'Chỉ được chứa chữ cái và khoảng trắng, không số/ký tự đặc biệt',
    });
  }

  const normalized = trimmedCollapsed.normalize('NFC'); // Rule #3

  const vietHoa = normalized
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
  if (normalized !== vietHoa) {
    // Rule #4
    canhBao.push({
      field: 'ho_ten',
      message: `Chữ cái đầu mỗi từ nên viết hoa — gợi ý: "${vietHoa}"`,
    });
  }

  return { loi, canhBao, normalized };
}

export function validateSoDinhDanh(sdd: string): FieldMessage[] {
  if (!SO_DINH_DANH_REGEX.test(sdd)) {
    return [
      {
        field: 'so_dinh_danh_ca_nhan',
        message: 'Phải gồm đúng 12 chữ số',
      },
    ];
  }
  return [];
}

const NAM_SINH_TOI_THIEU = 1940;
const TUOI_TOI_THIEU = 15;

// Rule #11: tổ hợp ngày/tháng/năm phải là ngày lịch thực tế (bắt 31/04,
// 30/02, 29/02 năm không nhuận...). Dùng Date.UTC + so khớp ngược lại thay
// vì CHECK make_date() phía DB (thông báo lỗi rõ ràng hơn cho người dùng).
export function validateNgayThangNamSinh(
  ngay: number,
  thang: number,
  nam: number,
): FieldMessage[] {
  const loi: FieldMessage[] = [];

  if (!Number.isInteger(ngay) || ngay < 1 || ngay > 31) {
    loi.push({ field: 'ngay_sinh', message: 'Phải trong khoảng 1-31' });
  }
  if (!Number.isInteger(thang) || thang < 1 || thang > 12) {
    loi.push({ field: 'thang_sinh', message: 'Phải trong khoảng 1-12' });
  }
  if (loi.length > 0) return loi;

  const date = new Date(Date.UTC(nam, thang - 1, ngay));
  const hopLe =
    date.getUTCFullYear() === nam &&
    date.getUTCMonth() === thang - 1 &&
    date.getUTCDate() === ngay;
  if (!hopLe) {
    loi.push({
      field: 'ngay_sinh',
      message: `Ngày ${ngay}/${thang}/${nam} không tồn tại trong lịch`,
    });
    return loi;
  }

  // Rule #12: tuổi tối thiểu 15, chỉ so theo năm (khớp CHECK phía DB — chưa
  // có khóa bồi dưỡng cụ thể để so ngày bắt đầu khóa chính xác hơn).
  const namHienTai = new Date().getUTCFullYear();
  if (nam < NAM_SINH_TOI_THIEU || nam > namHienTai - TUOI_TOI_THIEU) {
    loi.push({
      field: 'nam_sinh',
      message: `Năm sinh phải trong khoảng ${NAM_SINH_TOI_THIEU}-${namHienTai - TUOI_TOI_THIEU} (tuổi tối thiểu ${TUOI_TOI_THIEU})`,
    });
  }

  return loi;
}

export function validateSoDienThoai(sdt: string): FieldMessage[] {
  if (!SO_DIEN_THOAI_REGEX.test(sdt)) {
    return [
      {
        field: 'so_dien_thoai_lien_he',
        message:
          'Số điện thoại phải đúng định dạng VN (10 số đầu 0, hoặc +84...)',
      },
    ];
  }
  return [];
}

export function validateEmail(email: string): FieldMessage[] {
  if (!EMAIL_REGEX.test(email)) {
    return [{ field: 'email_lien_he', message: 'Email không đúng định dạng' }];
  }
  return [];
}

// Rule #34: mật khẩu mặc định = ngày sinh dạng ddmmyyyy.
export function matKhauMacDinhTuNgaySinh(
  ngay: number,
  thang: number,
  nam: number,
): string {
  const dd = String(ngay).padStart(2, '0');
  const mm = String(thang).padStart(2, '0');
  const yyyy = String(nam).padStart(4, '0');
  return `${dd}${mm}${yyyy}`;
}
