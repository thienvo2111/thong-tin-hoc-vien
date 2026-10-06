// ADR 0004 G10/G11 (issue #21): tin nhắn nhắc lịch soạn sẵn (cán bộ sao chép
// gửi qua Zalo/SMS rồi bấm "Đã gửi") và cờ nhắc theo (buổi, người nhận).
// Hàm thuần — câu chữ cố định trong code (v1), không email, không cron.

export type TrangThaiNhac = 'chua_nhac' | 'can_nhac_lai' | 'da_nhac';

const UU_TIEN: Record<TrangThaiNhac, number> = {
  da_nhac: 0,
  chua_nhac: 1,
  can_nhac_lai: 2,
};

/**
 * Trạng thái nhắc của 1 buổi với 1 người nhận: chưa có lần gửi nào chứa buổi
 * → chưa nhắc; buổi sửa SAU lần gửi cuối → cần nhắc lại; ngược lại đã nhắc.
 */
export function trangThaiNhac(
  buoi: { id: string; cap_nhat_luc: Date },
  nhatKy: { lich_hoc_ids: string[]; gui_luc: Date }[],
): TrangThaiNhac {
  const lanCuoi = nhatKy
    .filter((n) => n.lich_hoc_ids.includes(buoi.id))
    .reduce<Date | null>(
      (max, n) => (!max || n.gui_luc > max ? n.gui_luc : max),
      null,
    );
  if (!lanCuoi) return 'chua_nhac';
  return buoi.cap_nhat_luc > lanCuoi ? 'can_nhac_lai' : 'da_nhac';
}

/** Gộp nhiều buổi: cần nhắc lại > chưa nhắc > đã nhắc. */
export function gopTrangThaiNhac(ds: TrangThaiNhac[]): TrangThaiNhac {
  return ds.reduce<TrangThaiNhac>(
    (a, b) => (UU_TIEN[b] > UU_TIEN[a] ? b : a),
    'da_nhac',
  );
}

const THU = [
  'Chủ nhật',
  'Thứ hai',
  'Thứ ba',
  'Thứ tư',
  'Thứ năm',
  'Thứ sáu',
  'Thứ bảy',
];
const p2 = (n: number) => String(n).padStart(2, '0');
const vn = (d: Date) => new Date(d.getTime() + 7 * 3600 * 1000);

export function ngayVn(d: Date): string {
  const v = vn(d);
  return `${THU[v.getUTCDay()]}, ${p2(v.getUTCDate())}/${p2(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
}

export function gioVn(d: Date): string {
  const v = vn(d);
  return `${p2(v.getUTCHours())}:${p2(v.getUTCMinutes())}`;
}

export function lienKetBanDo(diaChi: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(diaChi)}`;
}

export interface BuoiTinNhan {
  buoi_so: number;
  thoi_gian_bat_dau: Date;
  thoi_gian_ket_thuc: Date;
  dia_diem_hoac_link: string | null;
  phong: string | null;
  diem_hoc: { ten: string; dia_chi: string } | null;
}

export interface ThucDiaTinNhan {
  ho_ten: string;
  so_dien_thoai: string;
}

function dongDiaDiem(b: BuoiTinNhan, kemBanDo: boolean): string[] {
  if (!b.diem_hoc) {
    return b.dia_diem_hoac_link ? [`  Địa điểm: ${b.dia_diem_hoac_link}`] : [];
  }
  const dong = [
    `  Địa điểm: ${b.diem_hoc.ten} – ${b.diem_hoc.dia_chi}${b.phong ? `, phòng ${b.phong}` : ''}`,
  ];
  if (kemBanDo) dong.push(`  Bản đồ: ${lienKetBanDo(b.diem_hoc.dia_chi)}`);
  return dong;
}

/** Tin nhắn cho 1 giảng viên — CHỈ buổi + hậu cần của chính giảng viên đó. */
export function soanTinNhanGiangVien(d: {
  ho_ten_giang_vien: string;
  ma_khoa: string;
  ten_lop: string;
  ten_giai_doan: string;
  buoi: BuoiTinNhan[];
  hau_can: {
    noi_o_ten: string | null;
    noi_o_dia_chi: string | null;
    phuong_tien: string | null;
    don_luc: Date | null;
    diem_don: string | null;
    lien_he_don: string | null;
  } | null;
  thuc_dia: ThucDiaTinNhan[];
  nhom_ho_tro_gv: { ho_ten: string; email: string | null }[];
}): string {
  const dong: string[] = [
    `Kính gửi Thầy/Cô ${d.ho_ten_giang_vien},`,
    `Nhóm hỗ trợ giảng viên xin gửi lịch dạy ${d.ten_lop} (${d.ma_khoa} – ${d.ten_giai_doan}):`,
  ];
  for (const b of d.buoi) {
    dong.push(
      `• Buổi ${b.buoi_so}: ${ngayVn(b.thoi_gian_bat_dau)}, ${gioVn(b.thoi_gian_bat_dau)}–${gioVn(b.thoi_gian_ket_thuc)}`,
      ...dongDiaDiem(b, true),
    );
  }
  const h = d.hau_can;
  if (h?.noi_o_ten) {
    dong.push(
      `Chỗ ở: ${h.noi_o_ten}${h.noi_o_dia_chi ? ` – ${h.noi_o_dia_chi}` : ''}`,
    );
  }
  if (h && (h.phuong_tien || h.don_luc || h.diem_don)) {
    const phan = [
      h.phuong_tien,
      h.don_luc && `đón lúc ${gioVn(h.don_luc)} ${ngayVn(h.don_luc)}`,
      h.diem_don && `tại ${h.diem_don}`,
      h.lien_he_don && `liên hệ ${h.lien_he_don}`,
    ].filter(Boolean);
    dong.push(`Đưa đón: ${phan.join('; ')}`);
  }
  for (const t of d.thuc_dia) {
    dong.push(`Người hỗ trợ tại điểm học: ${t.ho_ten} – ${t.so_dien_thoai}`);
  }
  if (d.nhom_ho_tro_gv.length) {
    dong.push(
      `Liên hệ nhóm hỗ trợ giảng viên: ${d.nhom_ho_tro_gv
        .map((n) => (n.email ? `${n.ho_ten} (${n.email})` : n.ho_ten))
        .join(', ')}`,
    );
  }
  dong.push('Trân trọng.');
  return dong.join('\n');
}

/** Tin nhắn nhóm Zalo cụm — các buổi trong 1 ngày của các lớp có học viên cụm. */
export function soanTinNhanCum(d: {
  ten_cum: string;
  ngay: Date;
  buoi: (BuoiTinNhan & { ten_lop: string; thuc_dia: ThucDiaTinNhan[] })[];
}): string {
  const dong: string[] = [
    `Kính gửi Thầy/Cô trong nhóm ${d.ten_cum},`,
    `Lịch học ${ngayVn(d.ngay)}:`,
  ];
  for (const b of d.buoi) {
    dong.push(
      `• ${b.ten_lop} – Buổi ${b.buoi_so}: ${gioVn(b.thoi_gian_bat_dau)}–${gioVn(b.thoi_gian_ket_thuc)}`,
      ...dongDiaDiem(b, true),
      ...b.thuc_dia.map(
        (t) => `  Hỗ trợ tại điểm học: ${t.ho_ten} – ${t.so_dien_thoai}`,
      ),
    );
  }
  dong.push('Thầy/Cô vui lòng có mặt đúng giờ. Trân trọng.');
  return dong.join('\n');
}
