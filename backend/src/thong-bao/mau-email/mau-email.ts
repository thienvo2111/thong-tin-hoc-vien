import {
  cap_hoc,
  doi_tuong_hoc_vien,
  hinh_thuc_giai_doan,
  ket_qua_hoc,
  loai_lop_hoc,
  muc_nang_luc,
  trinh_do_chuyen_mon,
  vai_tro_nhan_su_lop,
} from '@prisma/client';
import {
  KieuKhoi,
  MAU,
  bangThongTin,
  boCucEmail,
  chuNho,
  doanVan,
  e,
  huyHieu,
  khoiNoiBat,
  laLienKet,
  nutBam,
  tieuDeMuc,
} from './bo-cuc';

// Mẫu nội dung cho 3 loại email "nghiệp vụ chính": đặt lại mật khẩu, lịch học
// theo giai đoạn, kết quả học tập. Hàm THUẦN (dữ liệu vào -> {tieuDe, html}),
// không đụng Prisma — ThongBaoService tự truy vấn rồi map sang input ở đây.

export type EmailDaDung = { tieuDe: string; html: string };

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const THU = [
  'Chủ nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

const hai = (n: number) => String(n).padStart(2, '0');

// Cột @db.Date: Prisma trả 00:00 UTC đúng ngày lịch — đọc thẳng UTC.
export function ngay(d: Date): string {
  return `${hai(d.getUTCDate())}/${hai(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// Cột Timestamptz: đổi sang giờ Việt Nam (UTC+7 cố định, cùng lý do với
// gio-viet-nam.util.ts — không dựa vào dữ liệu múi giờ của máy chạy).
function vn(d: Date): Date {
  return new Date(d.getTime() + VN_OFFSET_MS);
}

export function thuNgay(d: Date): string {
  const v = vn(d);
  return `${THU[v.getUTCDay()]}, ${ngay(v)}`;
}

export function gio(d: Date): string {
  const v = vn(d);
  return `${hai(v.getUTCHours())}:${hai(v.getUTCMinutes())}`;
}

export const LOAI_LOP_LABEL: Record<loai_lop_hoc, string> = {
  truc_tiep: 'Lớp trực tiếp',
  zoom: 'Lớp trực tuyến (Zoom)',
  vle: 'Lớp trên VLE',
};

const HINH_THUC_LABEL: Record<hinh_thuc_giai_doan, string> = {
  truc_tiep: 'Trực tiếp',
  truc_tuyen: 'Trực tuyến',
  danh_gia: 'Đánh giá',
  khac: 'Khác',
};

const VAI_TRO_LABEL: Record<vai_tro_nhan_su_lop, string> = {
  giang_vien: 'Giảng viên',
  ho_tro: 'Hỗ trợ',
};

export const MUC_NANG_LUC_LABEL: Record<muc_nang_luc, string> = {
  co_ban: 'Cơ bản',
  thanh_thao: 'Thành thạo',
  nang_cao: 'Nâng cao',
};

export const KET_QUA_HOC_LABEL: Record<ket_qua_hoc, string> = {
  dang_hoc: 'Đang học',
  dat: 'Đạt',
  khong_dat: 'Không đạt',
  vang: 'Vắng',
};

// ---------------------------------------------------------------------------
// 1. Đặt lại mật khẩu
// ---------------------------------------------------------------------------
export function mauDatLaiMatKhau(p: {
  hoTen: string;
  link: string;
  thoiHanPhut: number;
}): EmailDaDung {
  const tieuDe = 'Yêu cầu đặt lại mật khẩu';
  const noiDung = [
    doanVan(`Kính gửi Thầy/Cô <b>${e(p.hoTen)}</b>,`),
    doanVan(
      'Hệ thống vừa nhận được yêu cầu đặt lại mật khẩu cho tài khoản của Thầy/Cô trên Cổng thông tin Bồi dưỡng Năng lực số. Vui lòng bấm nút bên dưới để tạo mật khẩu mới:',
    ),
    nutBam('Đặt lại mật khẩu', p.link),
    khoiNoiBat(
      'canh_bao',
      `Liên kết chỉ dùng được <b>1 lần</b> và hết hiệu lực sau <b>${p.thoiHanPhut} phút</b>. Không chia sẻ email này cho người khác.`,
    ),
    doanVan(
      'Nếu Thầy/Cô <b>không</b> yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này — mật khẩu hiện tại vẫn được giữ nguyên.',
    ),
    chuNho(
      `Nút không hoạt động? Sao chép liên kết sau và dán vào trình duyệt:<br><a href="${e(p.link)}" style="color:${MAU.navy};word-break:break-all;">${e(p.link)}</a>`,
    ),
  ].join('');

  return {
    tieuDe: `[BDNLS] ${tieuDe}`,
    html: boCucEmail({
      xemTruoc: `Liên kết đặt lại mật khẩu có hiệu lực trong ${p.thoiHanPhut} phút.`,
      nhan: 'BẢO MẬT TÀI KHOẢN',
      tieuDe,
      noiDung,
    }),
  };
}

// Tài khoản đơn vị (ADR 0002): link kích hoạt 72 giờ cho tài khoản quản lý
// Sở/Phòng VHXH/Trường do Quản trị tạo. tenDonVi = null: tài khoản Người hỗ
// trợ học viên (ADR 0003) — không gắn đơn vị.
export function mauKichHoatTaiKhoan(p: {
  hoTen: string;
  tenDonVi: string | null;
  tenDangNhap: string;
  link: string;
}): EmailDaDung {
  const tieuDe = 'Kích hoạt tài khoản';
  const noiDung = [
    doanVan(`Kính gửi <b>${e(p.hoTen)}</b>,`),
    doanVan(
      `Quản trị hệ thống đã cấp ${p.tenDonVi === null ? 'cho bạn tài khoản <b>Người hỗ trợ học viên</b>' : `tài khoản quản lý cho đơn vị <b>${e(p.tenDonVi)}</b>`} trên Cổng thông tin Bồi dưỡng Năng lực số. Tên đăng nhập: <b>${e(p.tenDangNhap)}</b>. Vui lòng bấm nút bên dưới để đặt mật khẩu và kích hoạt tài khoản:`,
    ),
    nutBam('Kích hoạt tài khoản', p.link),
    khoiNoiBat(
      'canh_bao',
      'Liên kết chỉ dùng được <b>1 lần</b> và hết hiệu lực sau <b>72 giờ</b>. Không chia sẻ email này cho người khác.',
    ),
    chuNho(
      `Nút không hoạt động? Sao chép liên kết sau và dán vào trình duyệt:<br><a href="${e(p.link)}" style="color:${MAU.navy};word-break:break-all;">${e(p.link)}</a>`,
    ),
  ].join('');

  return {
    tieuDe: `[HCMUE-BDNLS] ${tieuDe}`,
    html: boCucEmail({
      xemTruoc: 'Liên kết kích hoạt tài khoản có hiệu lực trong 72 giờ.',
      nhan: 'TÀI KHOẢN QUẢN LÝ',
      tieuDe,
      noiDung,
    }),
  };
}

// ---------------------------------------------------------------------------
// 2. Lịch học các giai đoạn
// ---------------------------------------------------------------------------
export type LopTrongEmail = {
  loaiLop: loai_lop_hoc;
  tenLop: string;
  nhanSu: Array<{
    hoTen: string;
    vaiTro: vai_tro_nhan_su_lop;
    soDienThoai: string | null;
  }>;
};

export type BuoiHocTrongEmail = {
  loaiLop: loai_lop_hoc;
  buoiSo: number;
  batDau: Date;
  ketThuc: Date;
  diaDiemHoacLink: string | null;
};

export type GiaiDoanTrongEmail = {
  thuTu: number;
  ten: string;
  hinhThuc: hinh_thuc_giai_doan;
  tuNgay: Date;
  denNgay: Date;
  buoi: BuoiHocTrongEmail[];
};

function oDiaDiem(giaTri: string | null): string {
  if (!giaTri)
    return `<span style="color:${MAU.chuPhu};">Sẽ thông báo sau</span>`;
  if (laLienKet(giaTri)) {
    return `<a href="${e(giaTri.trim())}" target="_blank" style="color:${MAU.navy};font-weight:600;word-break:break-all;">Vào lớp trực tuyến</a>`;
  }
  return e(giaTri);
}

function bangBuoiHoc(buoi: BuoiHocTrongEmail[]): string {
  if (!buoi.length) {
    return chuNho(
      'Chưa có lịch chi tiết cho giai đoạn này — Ban Tổ chức sẽ thông báo sau.',
    );
  }
  const th = (t: string) =>
    `<th align="left" style="padding:8px 10px;font-size:12px;line-height:18px;font-weight:700;color:${MAU.chuPhu};background:${MAU.nen};">${t}</th>`;
  const rows = [...buoi]
    .sort((a, b) => a.batDau.getTime() - b.batDau.getTime())
    .map(
      (b) => `
  <tr>
    <td style="padding:10px;border-top:1px solid ${MAU.vien};font-size:14px;line-height:20px;color:${MAU.chu};vertical-align:top;"><b>${e(thuNgay(b.batDau))}</b><br><span style="color:${MAU.chuPhu};">${gio(b.batDau)} – ${gio(b.ketThuc)} · Buổi ${b.buoiSo}</span></td>
    <td style="padding:10px;border-top:1px solid ${MAU.vien};font-size:14px;line-height:20px;color:${MAU.chu};vertical-align:top;">${e(LOAI_LOP_LABEL[b.loaiLop])}<br>${oDiaDiem(b.diaDiemHoacLink)}</td>
  </tr>`,
    )
    .join('');
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;border:1px solid ${MAU.vien};border-radius:8px;border-collapse:separate;overflow:hidden;">
  <tr>${th('Thời gian')}${th('Hình thức / Địa điểm')}</tr>${rows}
</table>`;
}

export function mauLichHoc(p: {
  hoTen: string;
  tenKhoa: string;
  maKhoa: string;
  lop: LopTrongEmail[];
  giaiDoan: GiaiDoanTrongEmail[];
  linkLopHoc: string;
}): EmailDaDung {
  const tieuDe = 'Thông báo lớp học và lịch học';

  const dongLop: Array<[string, string]> = [
    [
      'Khóa bồi dưỡng',
      `${e(p.tenKhoa)}<br><span style="font-weight:400;color:${MAU.chuPhu};">Mã khóa: ${e(p.maKhoa)}</span>`,
    ],
    ...p.lop.map((l): [string, string] => [
      LOAI_LOP_LABEL[l.loaiLop],
      e(l.tenLop),
    ]),
  ];

  const nhanSu = p.lop.flatMap((l) =>
    l.nhanSu.map((n) => ({ ...n, loaiLop: l.loaiLop })),
  );
  const khoiNhanSu = nhanSu.length
    ? tieuDeMuc('Giảng viên & hỗ trợ lớp') +
      bangThongTin(
        nhanSu.map((n): [string, string] => [
          `${VAI_TRO_LABEL[n.vaiTro]} · ${LOAI_LOP_LABEL[n.loaiLop]}`,
          `${e(n.hoTen)}${n.soDienThoai ? `<br><span style="font-weight:400;color:${MAU.chuPhu};">ĐT: ${e(n.soDienThoai)}</span>` : ''}`,
        ]),
      )
    : '';

  const khoiGiaiDoan = [...p.giaiDoan]
    .sort((a, b) => a.thuTu - b.thuTu)
    .map(
      (g) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 8px;">
  <tr>
    <td width="36" valign="top"><div style="width:28px;height:28px;border-radius:14px;background:${MAU.navy};color:#ffffff;font-size:14px;line-height:28px;font-weight:700;text-align:center;">${g.thuTu}</div></td>
    <td valign="top">
      <div style="font-size:15px;line-height:22px;font-weight:700;color:${MAU.navyDam};">${e(g.ten)}</div>
      <div style="font-size:13px;line-height:20px;color:${MAU.chuPhu};">${e(HINH_THUC_LABEL[g.hinhThuc])} · ${ngay(g.tuNgay)} – ${ngay(g.denNgay)}</div>
    </td>
  </tr>
</table>${bangBuoiHoc(g.buoi)}`,
    )
    .join('');

  const noiDung = [
    doanVan(`Kính gửi Thầy/Cô <b>${e(p.hoTen)}</b>,`),
    doanVan(
      'Ban Tổ chức trân trọng thông báo Thầy/Cô đã được xếp lớp trong khóa bồi dưỡng dưới đây. Lịch học chi tiết theo từng giai đoạn như sau:',
    ),
    bangThongTin(dongLop),
    tieuDeMuc('Lịch học theo giai đoạn'),
    khoiGiaiDoan ||
      chuNho(
        'Lịch học đang được cập nhật — Ban Tổ chức sẽ gửi thông báo khi có lịch chính thức.',
      ),
    khoiNhanSu,
    khoiNoiBat(
      'thong_tin',
      'Lịch học có thể được điều chỉnh. Thầy/Cô vui lòng theo dõi lịch mới nhất tại mục <b>Lớp học của tôi</b> trên Cổng thông tin.',
    ),
    nutBam('Xem lớp học của tôi', p.linkLopHoc),
  ].join('');

  return {
    tieuDe: `[BDNLS] Lịch học khóa ${p.tenKhoa}`,
    html: boCucEmail({
      xemTruoc: `Thầy/Cô đã được xếp lớp khóa ${p.tenKhoa}. Xem lịch học các giai đoạn.`,
      nhan: 'LỊCH HỌC',
      tieuDe,
      noiDung,
    }),
  };
}

// ---------------------------------------------------------------------------
// 3. Kết quả học tập
// ---------------------------------------------------------------------------
export type KetQuaGiaiDoanTrongEmail = {
  thuTu: number;
  ten: string;
  tyLeHoanThanh: number | null;
  diem: number | null;
};

const KIEU_KET_QUA: Record<ket_qua_hoc, KieuKhoi> = {
  dat: 'thanh_cong',
  khong_dat: 'loi',
  vang: 'canh_bao',
  dang_hoc: 'thong_tin',
};

const LOI_NHAN_KET_QUA: Record<ket_qua_hoc, string> = {
  dat: '<b>Chúc mừng Thầy/Cô đã hoàn thành khóa bồi dưỡng với kết quả Đạt!</b> Cảm ơn Thầy/Cô đã tham gia đầy đủ và tích cực trong suốt chương trình.',
  khong_dat:
    'Thầy/Cô chưa đạt yêu cầu của khóa bồi dưỡng. Nếu cần trao đổi thêm về kết quả, vui lòng liên hệ Ban Tổ chức qua email bên dưới hoặc gửi yêu cầu hỗ trợ trên Cổng thông tin.',
  vang: 'Hệ thống ghi nhận Thầy/Cô vắng trong khóa bồi dưỡng. Nếu thông tin chưa chính xác, vui lòng liên hệ Ban Tổ chức hoặc gửi yêu cầu hỗ trợ trên Cổng thông tin.',
  dang_hoc:
    'Kết quả học tập của Thầy/Cô vừa được cập nhật. Khóa bồi dưỡng vẫn đang diễn ra, kết quả cuối cùng sẽ được thông báo khi kết thúc khóa.',
};

function soVi(n: number): string {
  return Number.isInteger(n)
    ? String(n)
    : n.toFixed(2).replace(/0+$/, '').replace('.', ',');
}

export function mauKetQuaHocTap(p: {
  hoTen: string;
  tenKhoa: string;
  maKhoa: string;
  ketQua: ket_qua_hoc | null;
  ngayHoanThanh: Date | null;
  mucDauVao: muc_nang_luc | null;
  mucDauRa: muc_nang_luc | null;
  giaiDoan: KetQuaGiaiDoanTrongEmail[];
  linkCongThongTin: string;
}): EmailDaDung {
  const tieuDe = 'Thông báo kết quả học tập';
  const ketQua = p.ketQua ?? 'dang_hoc';

  const dong: Array<[string, string]> = [
    [
      'Khóa bồi dưỡng',
      `${e(p.tenKhoa)}<br><span style="font-weight:400;color:${MAU.chuPhu};">Mã khóa: ${e(p.maKhoa)}</span>`,
    ],
    ['Kết quả', huyHieu(KET_QUA_HOC_LABEL[ketQua], KIEU_KET_QUA[ketQua])],
  ];
  if (p.ngayHoanThanh) dong.push(['Ngày hoàn thành', ngay(p.ngayHoanThanh)]);
  if (p.mucDauVao)
    dong.push(['Mức năng lực đầu vào', e(MUC_NANG_LUC_LABEL[p.mucDauVao])]);
  if (p.mucDauRa)
    dong.push(['Mức năng lực đầu ra', e(MUC_NANG_LUC_LABEL[p.mucDauRa])]);

  const khoiGiaiDoan = p.giaiDoan.length
    ? tieuDeMuc('Kết quả theo giai đoạn') +
      bangThongTin(
        [...p.giaiDoan]
          .sort((a, b) => a.thuTu - b.thuTu)
          .map((g): [string, string] => {
            const phan = [
              g.tyLeHoanThanh !== null
                ? `Hoàn thành ${soVi(g.tyLeHoanThanh)}%`
                : null,
              g.diem !== null ? `Điểm ${soVi(g.diem)}` : null,
            ].filter(Boolean);
            return [
              `${g.thuTu}. ${g.ten}`,
              phan.length ? e(phan.join(' · ')) : '—',
            ];
          }),
      )
    : '';

  const noiDung = [
    doanVan(`Kính gửi Thầy/Cô <b>${e(p.hoTen)}</b>,`),
    doanVan('Ban Tổ chức thông báo kết quả học tập của Thầy/Cô như sau:'),
    khoiNoiBat(KIEU_KET_QUA[ketQua], LOI_NHAN_KET_QUA[ketQua]),
    bangThongTin(dong),
    khoiGiaiDoan,
    nutBam('Xem chi tiết trên Cổng thông tin', p.linkCongThongTin),
  ].join('');

  return {
    tieuDe: `[BDNLS] Kết quả học tập khóa ${p.tenKhoa}`,
    html: boCucEmail({
      xemTruoc: `Kết quả khóa ${p.tenKhoa}: ${KET_QUA_HOC_LABEL[ketQua]}.`,
      nhan: 'KẾT QUẢ HỌC TẬP',
      tieuDe,
      noiDung,
    }),
  };
}

// ---------------------------------------------------------------------------
// 4. Xác nhận thông tin đã khai báo (bản sao hồ sơ)
// ---------------------------------------------------------------------------
// Cùng 16 trường, cùng thứ tự và nhãn với trang Xác nhận (frontend
// pages/M5/XacNhan.tsx → dongHoSo + lib/nhanTruong.ts) — sửa một bên thì sửa
// cả bên kia.
const TRINH_DO_LABEL: Record<trinh_do_chuyen_mon, string> = {
  trung_cap: 'Trung cấp',
  cao_dang: 'Cao đẳng',
  dai_hoc: 'Đại học',
  thac_si: 'Thạc sĩ',
  tien_si: 'Tiến sĩ',
  khac: 'Khác',
};

const CAP_HOC_LABEL: Record<cap_hoc, string> = {
  mam_non: 'Mầm non',
  tieu_hoc: 'Tiểu học',
  thcs: 'THCS',
  thpt: 'THPT',
  trung_cap_nghe: 'Trung cấp nghề',
};

export const DOI_TUONG_LABEL: Record<doi_tuong_hoc_vien, string> = {
  giao_vien: 'Giáo viên',
  can_bo_quan_ly: 'Cán bộ quản lý',
  nhan_vien: 'Nhân viên',
};

const GIOI_TINH_LABEL: Record<string, string> = {
  nam: 'Nam',
  nu: 'Nữ',
  khac: 'Khác',
};

export type HoSoTrongEmail = {
  maDinhDanhMoet: string | null;
  hoTen: string;
  ngaySinh: number;
  thangSinh: number;
  namSinh: number;
  gioiTinh: string | null;
  soDinhDanhCaNhan: string | null;
  noiSinh: Array<string | null>; // xã, huyện, tỉnh
  cuTru: Array<string | null>; // phường/xã, tỉnh
  donViCongTac: string | null;
  chucVu: string | null;
  // null = học viên chưa chọn -> "(chưa khai báo)".
  doiTuong: doi_tuong_hoc_vien | null;
  soDienThoai: string | null;
  email: string | null;
  trinhDo: trinh_do_chuyen_mon | null;
  trinhDoKhac: string | null;
  chuyenMon: string[];
  capGiangDay: cap_hoc | null;
  monGiangDay: string | null;
};

// Email đi qua nhiều máy chủ trung gian — chỉ hiện 4 số cuối CCCD.
export function anCccd(cccd: string): string {
  const so = cccd.trim();
  return so.length <= 4 ? so : `${'•'.repeat(so.length - 4)}${so.slice(-4)}`;
}

const CHUA_KHAI = `<span style="font-weight:400;color:${MAU.chuPhu};">(chưa khai báo)</span>`;

function giaTriHoacTrong(giaTri: string | null | undefined): string {
  const v = (giaTri ?? '').trim();
  return v ? e(v) : CHUA_KHAI;
}

export function mauXacNhanHoSo(p: {
  hoSo: HoSoTrongEmail;
  linkHoSo: string;
}): EmailDaDung {
  const h = p.hoSo;
  const tieuDe = 'Xác nhận thông tin đã khai báo';
  const trinhDo =
    h.trinhDo === 'khac' && h.trinhDoKhac?.trim()
      ? h.trinhDoKhac
      : h.trinhDo
        ? TRINH_DO_LABEL[h.trinhDo]
        : null;
  const noi = (ds: Array<string | null>) =>
    ds.filter((x) => x && x.trim()).join(', ');

  const dong: Array<[string, string]> = [
    ['Mã định danh CSDL ngành', giaTriHoacTrong(h.maDinhDanhMoet)],
    ['Họ và tên', giaTriHoacTrong(h.hoTen)],
    [
      'Ngày sinh',
      e(
        `${String(h.ngaySinh).padStart(2, '0')}/${String(h.thangSinh).padStart(2, '0')}/${h.namSinh}`,
      ),
    ],
    [
      'Giới tính',
      giaTriHoacTrong(
        h.gioiTinh ? (GIOI_TINH_LABEL[h.gioiTinh] ?? h.gioiTinh) : null,
      ),
    ],
    [
      'Số CCCD',
      giaTriHoacTrong(h.soDinhDanhCaNhan ? anCccd(h.soDinhDanhCaNhan) : null),
    ],
    ['Nơi sinh', giaTriHoacTrong(noi(h.noiSinh))],
    ['Cư trú', giaTriHoacTrong(noi(h.cuTru))],
    ['Đơn vị công tác', giaTriHoacTrong(h.donViCongTac)],
    ['Chức vụ', giaTriHoacTrong(h.chucVu)],
    [
      'Đối tượng',
      giaTriHoacTrong(h.doiTuong ? DOI_TUONG_LABEL[h.doiTuong] : null),
    ],
    ['Số điện thoại', giaTriHoacTrong(h.soDienThoai)],
    ['Email', giaTriHoacTrong(h.email)],
    ['Trình độ chuyên môn', giaTriHoacTrong(trinhDo)],
    ['Chuyên môn', giaTriHoacTrong(h.chuyenMon.join(', '))],
    [
      'Cấp giảng dạy',
      giaTriHoacTrong(h.capGiangDay ? CAP_HOC_LABEL[h.capGiangDay] : null),
    ],
    ['Môn giảng dạy', giaTriHoacTrong(h.monGiangDay)],
  ];

  const noiDung = [
    doanVan(`Kính gửi Thầy/Cô <b>${e(h.hoTen)}</b>,`),
    doanVan(
      'Hệ thống đã ghi nhận thông tin Thầy/Cô vừa khai báo/xác nhận như sau:',
    ),
    bangThongTin(dong),
    chuNho('Vì lý do bảo mật, số CCCD chỉ hiển thị 4 chữ số cuối.'),
    khoiNoiBat(
      'canh_bao',
      'Nếu có sai sót, vui lòng đăng nhập Cổng thông tin để sửa trước khi hồ sơ được duyệt.',
    ),
    nutBam('Xem hồ sơ của tôi', p.linkHoSo),
  ].join('');

  return {
    tieuDe: `[HCMUE-BDNLS] ${tieuDe}`,
    html: boCucEmail({
      xemTruoc: 'Bản sao thông tin Thầy/Cô vừa khai báo/xác nhận.',
      nhan: 'HỒ SƠ HỌC VIÊN',
      tieuDe,
      noiDung,
    }),
  };
}
