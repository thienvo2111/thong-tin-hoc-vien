import {
  hinh_thuc_giai_doan,
  ket_qua_hoc,
  loai_lop_hoc,
  muc_nang_luc,
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
