// PROTOTYPE — ticket #48 (map #43). Dữ liệu GIẢ, chỉ trong bộ nhớ. Không đưa vào main.
// Tên GV là tên bịa; đơn giá là số giả để thử ngưỡng 50 triệu (đơn giá thật Quản trị nhập sau).

export type GiaiDoan = 'ca_2' | 'chi_gd1' | 'chi_gd2';
export type YKien = null | 'dong_y' | 'khong_dong_y';

export interface DongDanhSach {
  id: string;
  hoTen: string;
  ngaySinh: string;
  lop: string;
  giaiDoan: GiaiDoan;
  tyLeSuat: 1 | 0.5;
  ghiChu?: string;
  yKien: YKien;
  deNghi?: string;
}

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Huỳnh', 'Võ', 'Đặng', 'Bùi'];
const TEN = ['Văn An', 'Thị Bình', 'Minh Châu', 'Hoàng Dũng', 'Thị Giang', 'Quốc Huy', 'Thanh Lan', 'Đức Minh', 'Ngọc Nhi', 'Văn Phúc', 'Thị Quyên'];
const LOP = ['26.01.TOAN', '26.04.VAN', '26.06.ANH', '26.08.LI', '26.09.HOA', '26.11.TIN'];

export const danhSachMau: DongDanhSach[] = Array.from({ length: 22 }, (_, i) => {
  const giaiDoan: GiaiDoan = i === 5 ? 'chi_gd2' : i === 12 ? 'chi_gd1' : 'ca_2';
  return {
    id: `d${i + 1}`,
    hoTen: `${HO[i % HO.length]} ${TEN[i % TEN.length]}`,
    ngaySinh: `${(i % 27) + 1}/${(i % 12) + 1}/${1975 + (i % 20)}`,
    lop: LOP[i % LOP.length],
    giaiDoan,
    tyLeSuat: giaiDoan === 'ca_2' ? 1 : 0.5,
    ghiChu: i === 5 ? 'Thay giữa chừng cho GV dòng 13' : undefined,
    yKien: null,
  };
});

export const dot = {
  ten: 'HSG An Giang 2026',
  chuongTrinh: 'Bồi dưỡng HSG cho GV THCS',
  donGia: 2_600_000, // GIẢ
  qdTu: '05/10/2026',
  qdDen: '09/10/2026',
};

export const truong = { ten: 'Trường THCS và THPT Mẫu Thử', daKhaiChoNls: true };

export const NHAN_GIAI_DOAN: Record<GiaiDoan, string> = {
  ca_2: 'Cả 2 giai đoạn',
  chi_gd1: 'Chỉ GĐ1',
  chi_gd2: 'Chỉ GĐ2',
};

// Nhóm trường thông tin bám đúng Google Form NLS An Giang 2026.
export interface TruongTT {
  key: string;
  nhan: string;
  goiY?: string;
  kieu?: 'text' | 'textarea';
  kiemTra?: (v: string) => string | null;
}

const batBuoc = (v: string) => (v.trim() ? null : 'Bắt buộc');
const mst = (v: string) =>
  /^\d{10}$|^\d{10}-\d{3}$/.test(v.trim()) ? null : 'MST gồm 10 số, hoặc 13 số dạng 0123456789-001';
const qhns = (v: string) => (/^\d{7}$/.test(v.trim()) ? null : 'Mã QHNS gồm đúng 7 chữ số');
const sdt = (v: string) => (/^0\d{9}$/.test(v.replace(/\s/g, '')) ? null : 'SĐT 10 số, bắt đầu bằng 0');

export const NHOM_HO_SO: { ten: string; truong: TruongTT[] }[] = [
  {
    ten: 'Thông tin đơn vị',
    truong: [
      { key: 'tenTruong', nhan: 'Tên trường', goiY: 'Ghi đúng tên để đi kho bạc', kiemTra: batBuoc },
      { key: 'diaChi', nhan: 'Địa chỉ', kiemTra: batBuoc },
      { key: 'mst', nhan: 'Mã số thuế', goiY: '10 số hoặc 13 số có gạch nối', kiemTra: mst },
      { key: 'daiDien', nhan: 'Người đại diện trên hợp đồng', kiemTra: batBuoc },
      { key: 'sdtDaiDien', nhan: 'SĐT người đại diện', kiemTra: sdt },
      { key: 'emailHoaDon', nhan: 'Email nhận hóa đơn', kiemTra: batBuoc },
    ],
  },
  {
    ten: 'Thông tin thanh toán',
    truong: [
      { key: 'stk', nhan: 'Số tài khoản', kiemTra: batBuoc },
      { key: 'nganHang', nhan: 'Ngân hàng', kiemTra: batBuoc },
      { key: 'chiNhanh', nhan: 'Chi nhánh', kiemTra: batBuoc },
      { key: 'khoBac', nhan: 'Kho bạc', kiemTra: batBuoc },
      { key: 'mstKhoBac', nhan: 'MST đăng ký tại Kho bạc', kiemTra: mst },
      { key: 'qhns', nhan: 'Mã QHNS', goiY: 'Đúng 7 chữ số', kiemTra: qhns },
      { key: 'maNguon', nhan: 'Mã nguồn', kiemTra: batBuoc },
    ],
  },
  {
    ten: 'Hiệu trưởng và kế toán (nhận kinh phí hỗ trợ)',
    truong: [
      { key: 'htTen', nhan: 'Họ tên Hiệu trưởng', kiemTra: batBuoc },
      { key: 'htStk', nhan: 'STK Hiệu trưởng', kiemTra: batBuoc },
      { key: 'htNganHang', nhan: 'Ngân hàng – chi nhánh (HT)', kiemTra: batBuoc },
      { key: 'ktTen', nhan: 'Họ tên Kế toán', kiemTra: batBuoc },
      { key: 'ktSdt', nhan: 'SĐT Kế toán', kiemTra: sdt },
      { key: 'ktStk', nhan: 'STK Kế toán', kiemTra: batBuoc },
      { key: 'ktNganHang', nhan: 'Ngân hàng – chi nhánh (KT)', kiemTra: batBuoc },
    ],
  },
  {
    ten: 'Hậu cần cơ sở (dùng khi trường là điểm học trực tiếp)',
    truong: [
      { key: 'dauMoiCsvc', nhan: 'Đầu mối CSVC/kỹ thuật (họ tên, SĐT)' },
      { key: 'csvc', nhan: 'Mức đáp ứng CSVC', kieu: 'textarea' },
      { key: 'luuTru', nhan: 'Lưu trú gần trường (kèm SĐT)', kieu: 'textarea' },
      { key: 'diChuyen', nhan: 'Di chuyển từ TP.HCM (kèm SĐT)', kieu: 'textarea' },
    ],
  },
];

export const NHOM_HOP_DONG: TruongTT[] = [
  { key: 'nguoiNhan', nhan: 'Người nhận bản giấy hợp đồng', kiemTra: batBuoc },
  { key: 'sdtNguoiNhan', nhan: 'SĐT người nhận', kiemTra: sdt },
  { key: 'diaChiNhan', nhan: 'Địa chỉ nhận (số, đường, ấp, xã/phường, tỉnh)', kieu: 'textarea', kiemTra: batBuoc },
  { key: 'ghiChuHd', nhan: 'Ghi chú cho HCMUE', kieu: 'textarea' },
];

// Hồ sơ "đã khai cho NLS" → điền sẵn (minh họa khai một lần).
export const hoSoDaKhai: Record<string, string> = {
  tenTruong: 'Trường THCS và THPT Mẫu Thử',
  diaChi: 'Ấp 1, xã Mẫu Thử, tỉnh An Giang',
  mst: '1700000000',
  daiDien: 'Nguyễn Văn Hiệu',
  sdtDaiDien: '0900000001',
  emailHoaDon: 'ketoan@truongmau.edu.vn',
  stk: '0000111122223333',
  nganHang: 'Kho bạc Nhà nước',
  chiNhanh: 'An Giang',
  khoBac: 'KBNN khu vực An Giang',
  mstKhoBac: '1700000000',
  qhns: '1234567',
  maNguon: '13',
  htTen: 'Nguyễn Văn Hiệu',
  ktTen: 'Trần Thị Kế',
  ktSdt: '0900000002',
};

export const tien = (n: number) => n.toLocaleString('vi-VN') + ' đ';
export const NGUONG = 50_000_000;

export function tongSuat(ds: DongDanhSach[]) {
  return ds.reduce((s, d) => s + d.tyLeSuat, 0);
}

function parseNgay(s: string) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : NaN;
}

export function kiemTraNgayQd(v: string) {
  const t = parseNgay(v);
  if (Number.isNaN(t)) return 'Định dạng dd/mm/2026';
  if (t < parseNgay(dot.qdTu) || t > parseNgay(dot.qdDen)) return `Ngày QĐ phải từ ${dot.qdTu} đến ${dot.qdDen}`;
  return null;
}
