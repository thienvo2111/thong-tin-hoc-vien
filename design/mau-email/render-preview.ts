// Render các mẫu email với dữ liệu MINH HỌA ra design/mau-email/*.html để xem.
// Chạy: cd backend && npx ts-node -O "{\"module\":\"commonjs\",\"moduleResolution\":\"node\"}" --transpile-only ../design/mau-email/render-preview.ts
import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  mauDatLaiMatKhau,
  mauKetQuaHocTap,
  mauLichGiangDay,
  MauLichGiangDayInput,
  mauLichHoc,
  mauXacNhanHoSo,
} from '../../backend/src/thong-bao/mau-email/mau-email';

const web = 'https://boiduongnls.hcmue.edu.vn';
const out = (ten: string, html: string) =>
  writeFileSync(join(__dirname, ten), html, 'utf8');

out(
  '1-dat-lai-mat-khau.html',
  mauDatLaiMatKhau({
    hoTen: 'Nguyễn Thị Minh Anh',
    link: `${web}/dat-lai-mat-khau?token=3f9a1c...`,
    thoiHanPhut: 30,
  }).html,
);

const t = (s: string) => new Date(s);
out(
  '2-lich-hoc.html',
  mauLichHoc({
    hoTen: 'Nguyễn Thị Minh Anh',
    tenKhoa: 'Bồi dưỡng Năng lực số GV An Giang (Mức Cơ bản)',
    maKhoa: 'AG-NLS-CB-01',
    lop: [
      {
        loaiLop: 'truc_tiep',
        tenLop: 'Lớp Long Xuyên 03',
        nhanSu: [
          { hoTen: 'TS. Trần Văn Bình', vaiTro: 'giang_vien', soDienThoai: '0908 123 456' },
          { hoTen: 'Lê Thị Hoa', vaiTro: 'ho_tro', soDienThoai: '0912 345 678' },
        ],
      },
      { loaiLop: 'zoom', tenLop: 'Zoom nhóm 2', nhanSu: [] },
      { loaiLop: 'vle', tenLop: 'VLE – Cơ bản K1', nhanSu: [] },
    ],
    giaiDoan: [
      {
        thuTu: 1,
        ten: 'Học trực tuyến trên VLE',
        hinhThuc: 'truc_tuyen',
        tuNgay: t('2026-10-05T00:00:00Z'),
        denNgay: t('2026-10-25T00:00:00Z'),
        buoi: [
          { loaiLop: 'zoom', buoiSo: 1, batDau: t('2026-10-07T12:30:00Z'), ketThuc: t('2026-10-07T14:30:00Z'), diaDiemHoacLink: 'https://zoom.us/j/1234567890' },
          { loaiLop: 'zoom', buoiSo: 2, batDau: t('2026-10-14T12:30:00Z'), ketThuc: t('2026-10-14T14:30:00Z'), diaDiemHoacLink: 'https://zoom.us/j/1234567890' },
        ],
      },
      {
        thuTu: 2,
        ten: 'Học trực tiếp tại địa phương',
        hinhThuc: 'truc_tiep',
        tuNgay: t('2026-10-31T00:00:00Z'),
        denNgay: t('2026-11-02T00:00:00Z'),
        buoi: [1, 2, 3].map((n) => ({
          loaiLop: 'truc_tiep' as const,
          buoiSo: n,
          batDau: t(`2026-1${n === 1 ? '0-31' : `1-0${n - 1}`}T00:30:00Z`),
          ketThuc: t(`2026-1${n === 1 ? '0-31' : `1-0${n - 1}`}T09:30:00Z`),
          diaDiemHoacLink: 'Trường THPT Long Xuyên, 1 Lê Lợi, P. Mỹ Bình, An Giang',
        })),
      },
      {
        thuTu: 3,
        ten: 'Đánh giá cuối khóa',
        hinhThuc: 'danh_gia',
        tuNgay: t('2026-11-10T00:00:00Z'),
        denNgay: t('2026-11-15T00:00:00Z'),
        buoi: [],
      },
    ],
    linkLopHoc: `${web}/toi/lop-hoc`,
  }).html,
);

const kq = {
  hoTen: 'Nguyễn Thị Minh Anh',
  tenKhoa: 'Bồi dưỡng Năng lực số GV An Giang (Mức Cơ bản)',
  maKhoa: 'AG-NLS-CB-01',
  mucDauVao: 'co_ban' as const,
  linkCongThongTin: `${web}/toi/lop-hoc`,
};
out(
  '3a-ket-qua-dat.html',
  mauKetQuaHocTap({
    ...kq,
    ketQua: 'dat',
    ngayHoanThanh: t('2026-11-15T00:00:00Z'),
    mucDauRa: 'thanh_thao',
    giaiDoan: [
      { thuTu: 1, ten: 'Học trực tuyến trên VLE', tyLeHoanThanh: 100, diem: 8.5 },
      { thuTu: 2, ten: 'Học trực tiếp tại địa phương', tyLeHoanThanh: 100, diem: null },
      { thuTu: 3, ten: 'Đánh giá cuối khóa', tyLeHoanThanh: null, diem: 7.75 },
    ],
  }).html,
);
out(
  '3b-ket-qua-khong-dat.html',
  mauKetQuaHocTap({
    ...kq,
    ketQua: 'khong_dat',
    ngayHoanThanh: null,
    mucDauRa: null,
    giaiDoan: [
      { thuTu: 1, ten: 'Học trực tuyến trên VLE', tyLeHoanThanh: 62.5, diem: 4 },
    ],
  }).html,
);
console.log('OK');

out(
  '4-xac-nhan-ho-so.html',
  mauXacNhanHoSo({
    hoSo: {
      maDinhDanhMoet: '8912345678',
      hoTen: 'Hà Thị Thanh',
      ngaySinh: 11,
      thangSinh: 9,
      namSinh: 1988,
      gioiTinh: 'nu',
      soDinhDanhCaNhan: '089188001234',
      noiSinh: ['Xã Mỹ Hòa Hưng', 'TP. Long Xuyên', 'Tỉnh An Giang'],
      cuTru: ['Phường Long Xuyên', 'Tỉnh An Giang'],
      donViCongTac: 'Trường THPT Long Xuyên',
      chucVu: 'Tổ trưởng chuyên môn',
      doiTuong: 'giao_vien',
      soDienThoai: '0979427164',
      email: 'thanh@example.com',
      trinhDo: 'dai_hoc',
      trinhDoKhac: null,
      chuyenMon: ['Công nghệ'],
      capGiangDay: 'thpt',
      monGiangDay: null,
    },
    linkHoSo: `${web}/toi/ho-so`,
  }).html,
);

// ADR 0009: lịch giảng dạy — 5a (lần đầu) và 5b (cập nhật sau khi đổi lịch).
const lichDay = (capNhat: boolean): MauLichGiangDayInput => ({
  hoTen: 'Nguyễn Văn An',
  tenKhoa: 'Bồi dưỡng Năng lực số cho giáo viên tỉnh An Giang',
  maKhoa: 'AG-2026-01',
  giaiDoan: {
    ten: 'Giai đoạn 2 – Học trực tiếp',
    hinhThuc: 'truc_tiep',
    tuNgay: t('2026-10-24T00:00:00Z'),
    denNgay: t('2026-10-30T00:00:00Z'),
  },
  lop: [
    {
      tenLop: 'Lớp TT-03',
      loaiLop: 'truc_tiep',
      vaiTro: 'giang_vien',
      buoi: [
        ['2026-10-24T00:30:00Z', '2026-10-24T04:30:00Z', 1, false],
        ['2026-10-24T06:30:00Z', '2026-10-24T09:30:00Z', 2, capNhat],
        ['2026-10-25T00:30:00Z', '2026-10-25T04:30:00Z', 3, false],
      ].map(([bd, kt, so, doi]) => ({
        buoiSo: so as number,
        batDau: t(bd as string),
        ketThuc: t(kt as string),
        diemHoc: {
          ten: 'Trường THPT Long Xuyên',
          diaChi: '12 Trần Hưng Đạo, P. Mỹ Bình, TP. Long Xuyên',
        },
        phong: 'A2.05',
        diaDiemHoacLink: null,
        coThayDoi: doi as boolean,
      })),
      hauCan: {
        noiOTen: 'Khách sạn Đông Xuyên',
        noiODiaChi: '9A Lương Văn Cù, TP. Long Xuyên',
        nhanPhong: t('2026-10-23T00:00:00Z'),
        traPhong: t('2026-10-25T00:00:00Z'),
        phuongTien: 'Xe 7 chỗ HCMUE',
        donLuc: t('2026-10-22T22:00:00Z'),
        diemDon: 'cổng 280 An Dương Vương',
        lienHeDon: 'tài xế Hùng 0909 123 456',
      },
      thucDia: [{ hoTen: 'Trần Thị B', soDienThoai: '0912 345 678' }],
    },
    {
      tenLop: 'Lớp Zoom-07',
      loaiLop: 'zoom',
      vaiTro: 'giang_vien',
      buoi: [
        ['2026-10-28T12:00:00Z', 1],
        ['2026-10-30T12:00:00Z', 2],
      ].map(([bd, so]) => ({
        buoiSo: so as number,
        batDau: t(bd as string),
        ketThuc: new Date(t(bd as string).getTime() + 2 * 3600 * 1000),
        diemHoc: null,
        phong: null,
        diaDiemHoacLink: 'https://zoom.us/j/1234567890',
        coThayDoi: false,
      })),
      hauCan: null,
      thucDia: [],
    },
  ],
  nhomHoTro: [
    { hoTen: 'Lê Văn C', email: 'levanc@hcmue.edu.vn' },
    { hoTen: 'Phạm Thị D', email: 'phamthid@hcmue.edu.vn' },
  ],
  linkCongGiangVien: `${web}/giang-day`,
  capNhat: capNhat
    ? {
        guiLucTruoc: t('2026-10-17T02:15:00Z'),
        buoiGo: [
          { tenLop: 'Lớp TT-09', buoiSo: 1, batDau: t('2026-10-26T00:30:00Z') },
        ],
      }
    : null,
});
out('5a-lich-day-giang-vien.html', mauLichGiangDay(lichDay(false)).html);
out(
  '5b-lich-day-giang-vien-cap-nhat.html',
  mauLichGiangDay(lichDay(true)).html,
);
