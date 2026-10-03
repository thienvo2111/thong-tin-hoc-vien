import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import type { Response } from 'superagent';
import * as ExcelJS from 'exceljs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';

const NAM_HOP_LE = new Date().getUTCFullYear() - 20;

// supertest/superagent không tự nhận diện mimetype xlsx là nhị phân — tự
// đăng ký parser gom raw bytes để đọc lại bằng exceljs trong test (cùng
// pattern với test/import.e2e-spec.ts).
function binaryParser(
  res: Response,
  callback: (err: Error | null, body: Buffer) => void,
) {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk: string) => {
    data += chunk;
  });
  res.on('end', () => callback(null, Buffer.from(data, 'binary')));
}

describe('Dịch vụ Báo cáo (e2e)', () => {
  let app: INestApplication;

  // Cây: soGddt -> phongVhxh -> truong1 (địa bàn xaTruong1)
  //              -> truong2 (địa bàn xaTruong2, cùng phòng)
  //      soGddt -> phongKhac -> truongKhac (ngoài phạm vi phongVhxh)
  let tinh: { id: string };
  let xaTruong1: { id: string };
  let xaTruong2: { id: string };
  let xaKhac: { id: string };
  let soGddt: { id: string };
  let phongVhxh: { id: string };
  let phongKhac: { id: string };
  let truong1: { id: string; ten_don_vi: string };
  let truong2: { id: string };
  let truongKhac: { id: string };

  // T7 — đơn vị/khóa/lớp RIÊNG (không tái dùng truong1/khoa1) để tránh làm
  // sai lệch số liệu tong-hop đã assert đúng số ở các describe khác.
  let xaVanHanh: { id: string };
  let truong3: { id: string };
  let khoaVanHanh: string;
  let lopVanHanh: { id: string; ten_lop: string };

  let quanTri: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let soAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let phongAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
  let truong1Account: Awaited<ReturnType<typeof taoNguoiDungTest>>;

  let tokenQuanTri: string;
  let tokenSo: string;
  let tokenPhong: string;
  let tokenTruong1: string;
  let tokenHocVien: string;

  const hocVienIds: string[] = [];
  const nguoiDungHocVienIds: string[] = [];
  const khoaIds: string[] = [];
  const dangKyIds: string[] = [];

  async function dangNhap(ten_dang_nhap: string, mat_khau: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau })
      .expect(200);
    return res.body.token as string;
  }

  beforeAll(async () => {
    app = await createTestApp();
    const suf = uniqueSuffix();

    tinh = await prisma.dia_danh.create({
      data: { ma: `T-bc-${suf}`, ten: `Tỉnh BC ${suf}`, cap: 'tinh_thanh' },
    });
    xaTruong1 = await prisma.dia_danh.create({
      data: {
        ma: `X1-bc-${suf}`,
        ten: `Xã BC 1 ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    xaTruong2 = await prisma.dia_danh.create({
      data: {
        ma: `X2-bc-${suf}`,
        ten: `Xã BC 2 ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    xaKhac = await prisma.dia_danh.create({
      data: {
        ma: `X3-bc-${suf}`,
        ten: `Xã BC Khác ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    soGddt = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-so-bc-${suf}`,
        ten_don_vi: `Sở GD&ĐT BC ${suf}`,
        loai_don_vi: 'so_gddt',
        dia_ban_id: xaTruong1.id,
      },
    });
    phongVhxh = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-phong-bc-${suf}`,
        ten_don_vi: `Phòng VHXH BC ${suf}`,
        loai_don_vi: 'phong_vhxh',
        dia_ban_id: xaTruong1.id,
        don_vi_cha_id: soGddt.id,
      },
    });
    phongKhac = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-phong-khac-bc-${suf}`,
        ten_don_vi: `Phòng VHXH Khác BC ${suf}`,
        loai_don_vi: 'phong_vhxh',
        dia_ban_id: xaKhac.id,
        don_vi_cha_id: soGddt.id,
      },
    });
    truong1 = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-truong1-bc-${suf}`,
        ten_don_vi: `Trường Một BC ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xaTruong1.id,
        don_vi_cha_id: phongVhxh.id,
      },
    });
    truong2 = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-truong2-bc-${suf}`,
        ten_don_vi: `Trường Hai BC ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xaTruong2.id,
        don_vi_cha_id: phongVhxh.id,
      },
    });
    truongKhac = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-truong-khac-bc-${suf}`,
        ten_don_vi: `Trường Khác BC ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xaKhac.id,
        don_vi_cha_id: phongKhac.id,
      },
    });
    // T7 — địa bàn/đơn vị RIÊNG (không phải truong1/truong2) để dữ liệu lớp
    // vận hành không cộng dồn vào số liệu theo=don_vi/dia_ban/khoa đã assert
    // ở các describe khác — vẫn nằm dưới phongVhxh nên phong_vhxh/so_gddt
    // vẫn thấy được qua cây đơn vị.
    xaVanHanh = await prisma.dia_danh.create({
      data: {
        ma: `X4-bc-${suf}`,
        ten: `Xã BC Vận Hành ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    truong3 = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-truong3-bc-${suf}`,
        ten_don_vi: `Trường Ba BC ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xaVanHanh.id,
        don_vi_cha_id: phongVhxh.id,
      },
    });

    quanTri = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: truong1.id,
      mat_khau: 'MatKhau123',
    });
    soAccount = await taoNguoiDungTest({
      vai_tro: 'so_gddt',
      don_vi_id: soGddt.id,
      mat_khau: 'MatKhau123',
    });
    phongAccount = await taoNguoiDungTest({
      vai_tro: 'phong_vhxh',
      don_vi_id: phongVhxh.id,
      mat_khau: 'MatKhau123',
    });
    truong1Account = await taoNguoiDungTest({
      vai_tro: 'truong',
      don_vi_id: truong1.id,
      mat_khau: 'MatKhau123',
    });

    tokenQuanTri = await dangNhap(quanTri.ten_dang_nhap, 'MatKhau123');
    tokenSo = await dangNhap(soAccount.ten_dang_nhap, 'MatKhau123');
    tokenPhong = await dangNhap(phongAccount.ten_dang_nhap, 'MatKhau123');
    tokenTruong1 = await dangNhap(truong1Account.ten_dang_nhap, 'MatKhau123');

    // Dữ liệu hoc_vien tạo trực tiếp qua Prisma (bỏ qua luồng đăng ký đầy đủ —
    // báo cáo chỉ cần trạng thái/đơn vị/cấp giảng dạy đã biết trước để assert
    // đúng số liệu, không cần test lại luồng tạo hồ sơ đã có ở hoc-vien.e2e-spec.ts).
    const suf2 = uniqueSuffix();
    const hv1 = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'tu_dang_ky',
        ho_ten: 'Nguyễn Văn Một',
        so_dinh_danh_ca_nhan: `1${Date.now().toString().slice(-11)}`,
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: truong1.id,
        so_dien_thoai_lien_he: '0911111111',
        trang_thai: 'da_duyet',
        cap_giang_day: 'tieu_hoc',
        nguoi_duyet_id: soAccount.nguoiDung.id,
        cap_duyet_thuc_te: 'so_gddt',
        ngay_duyet: new Date(),
      },
    });
    const hv2 = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'tu_dang_ky',
        ho_ten: 'Trần Thị Hai',
        so_dinh_danh_ca_nhan: `2${Date.now().toString().slice(-11)}`,
        ngay_sinh: 2,
        thang_sinh: 2,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: truong1.id,
        so_dien_thoai_lien_he: '0911111112',
        trang_thai: 'cho_duyet',
        cap_giang_day: 'thcs',
      },
    });
    const hv3 = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'tu_dang_ky',
        ho_ten: 'Lê Văn Ba',
        so_dinh_danh_ca_nhan: `3${Date.now().toString().slice(-11)}`,
        ngay_sinh: 3,
        thang_sinh: 3,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: truong2.id,
        so_dien_thoai_lien_he: '0911111113',
        trang_thai: 'da_duyet',
        cap_giang_day: null,
        nguoi_duyet_id: soAccount.nguoiDung.id,
        cap_duyet_thuc_te: 'so_gddt',
        ngay_duyet: new Date(),
      },
    });
    // Ngoài phạm vi phongVhxh (thuộc truongKhac/phongKhac) — dùng để test
    // scoping không rò rỉ số liệu.
    const hvKhac = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'tu_dang_ky',
        ho_ten: 'Phạm Thị Khác',
        so_dinh_danh_ca_nhan: `4${Date.now().toString().slice(-11)}`,
        ngay_sinh: 4,
        thang_sinh: 4,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: truongKhac.id,
        so_dien_thoai_lien_he: '0911111114',
        trang_thai: 'da_duyet',
        cap_giang_day: 'thpt',
        nguoi_duyet_id: soAccount.nguoiDung.id,
        cap_duyet_thuc_te: 'so_gddt',
        ngay_duyet: new Date(),
      },
    });
    hocVienIds.push(hv1.id, hv2.id, hv3.id, hvKhac.id);

    // 1 hồ sơ tạo với created_at trong quá khứ xa để test tu_ngay/den_ngay
    // loại đúng dòng ngoài khoảng.
    const hvCu = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'tu_dang_ky',
        ho_ten: 'Hồ Sơ Cũ',
        so_dinh_danh_ca_nhan: `5${Date.now().toString().slice(-11)}`,
        ngay_sinh: 5,
        thang_sinh: 5,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: truong1.id,
        so_dien_thoai_lien_he: '0911111115',
        trang_thai: 'nhap',
        created_at: new Date('2000-01-01T00:00:00.000Z'),
      },
    });
    await prisma.hoc_vien.update({
      where: { id: hvCu.id },
      data: { created_at: new Date('2000-01-01T00:00:00.000Z') },
    });
    hocVienIds.push(hvCu.id);

    // Khóa bồi dưỡng trong phạm vi + đăng ký/kết quả.
    const khoa1 = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-bc-${suf2}`,
        ten_khoa: 'Khóa Bồi Dưỡng Báo Cáo',
        don_vi_dat_hang_id: truong1.id,
        thoi_gian_bat_dau: new Date('2026-03-01'),
        thoi_gian_ket_thuc: new Date('2026-03-10'),
        trang_thai: 'da_duyet',
      },
    });
    khoaIds.push(khoa1.id);
    const dk1 = await prisma.dang_ky_hoc.create({
      data: {
        hoc_vien_id: hv1.id,
        khoa_id: khoa1.id,
        trang_thai: 'da_phan_lop',
        ket_qua: 'dat',
      },
    });
    const dk2 = await prisma.dang_ky_hoc.create({
      data: {
        hoc_vien_id: hv2.id,
        khoa_id: khoa1.id,
        trang_thai: 'da_duyet',
      },
    });
    dangKyIds.push(dk1.id, dk2.id);

    // Khóa không ai đăng ký -- vẫn phải xuất hiện trong theo=khoa (rule
    // provisional: liệt kê toàn bộ khóa khớp phạm vi+ngày, kể cả 0 đăng ký).
    const khoaRong = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-rong-bc-${suf2}`,
        ten_khoa: 'Khóa Chưa Có Ai Đăng Ký',
        don_vi_dat_hang_id: truong1.id,
        thoi_gian_bat_dau: new Date('2026-04-01'),
        thoi_gian_ket_thuc: new Date('2026-04-05'),
        trang_thai: 'nhap',
      },
    });
    khoaIds.push(khoaRong.id);

    // Khóa ngoài phạm vi (truongKhac) — test scoping theo=khoa.
    const khoaKhac = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-khac-bc-${suf2}`,
        ten_khoa: 'Khóa Ngoài Phạm Vi',
        don_vi_dat_hang_id: truongKhac.id,
        thoi_gian_bat_dau: new Date('2026-03-01'),
        thoi_gian_ket_thuc: new Date('2026-03-10'),
        trang_thai: 'da_duyet',
      },
    });
    khoaIds.push(khoaKhac.id);

    // T7 (mo-rong-nls-an-giang.md) — khóa + lớp RIÊNG (truong3, không phải
    // khoa1/truong1) để không cộng dồn vào số liệu theo=don_vi/dia_ban/khoa
    // đã assert ở trên. 2 học viên PHÂN LỚP THỰC SỰ (lop_id gán): hvVh1
    // thuộc truong3 (dưới phongVhxh — trong phạm vi), hvVhKhac thuộc
    // truongKhac (NGOÀI phạm vi phongVhxh dù cùng khóa/lớp) — dùng để test
    // Phòng VHXH không đếm nhầm học viên đơn vị khác trong cùng lớp.
    const hvVh1 = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'tu_dang_ky',
        ho_ten: 'Học Viên Vận Hành Một',
        so_dinh_danh_ca_nhan: `6${Date.now().toString().slice(-11)}`,
        ngay_sinh: 6,
        thang_sinh: 6,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: truong3.id,
        so_dien_thoai_lien_he: '0911111116',
        email_lien_he: `vh1-${suf2}@test.local`,
        trang_thai: 'da_duyet',
        cap_giang_day: 'tieu_hoc',
        nguoi_duyet_id: soAccount.nguoiDung.id,
        cap_duyet_thuc_te: 'so_gddt',
        ngay_duyet: new Date(),
      },
    });
    const hvVhKhac = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'tu_dang_ky',
        ho_ten: 'Học Viên Vận Hành Khác',
        so_dinh_danh_ca_nhan: `7${Date.now().toString().slice(-11)}`,
        ngay_sinh: 7,
        thang_sinh: 7,
        nam_sinh: NAM_HOP_LE,
        don_vi_cong_tac_id: truongKhac.id,
        so_dien_thoai_lien_he: '0911111117',
        email_lien_he: `vhkhac-${suf2}@test.local`,
        trang_thai: 'da_duyet',
        cap_giang_day: 'tieu_hoc',
        nguoi_duyet_id: soAccount.nguoiDung.id,
        cap_duyet_thuc_te: 'so_gddt',
        ngay_duyet: new Date(),
      },
    });
    hocVienIds.push(hvVh1.id, hvVhKhac.id);

    const khoaVanHanhRow = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-vh-${suf2}`,
        ten_khoa: 'Khóa Vận Hành Báo Cáo',
        don_vi_dat_hang_id: truong3.id,
        thoi_gian_bat_dau: new Date('2026-03-01'),
        thoi_gian_ket_thuc: new Date('2026-03-10'),
        trang_thai: 'da_duyet',
      },
    });
    khoaVanHanh = khoaVanHanhRow.id;
    khoaIds.push(khoaVanHanh);

    lopVanHanh = await prisma.lop_hoc.create({
      data: {
        khoa_id: khoaVanHanh,
        loai_lop: 'truc_tiep',
        ten_lop: `Lớp Vận Hành ${suf2}`,
        nhom_hoc_vien: 1,
        muc_nang_luc: 'co_ban',
      },
    });
    const dkVh1 = await prisma.dang_ky_hoc.create({
      data: {
        hoc_vien_id: hvVh1.id,
        khoa_id: khoaVanHanh,
        trang_thai: 'da_phan_lop',
        muc_dau_vao: 'co_ban',
      },
    });
    const dkVhKhac = await prisma.dang_ky_hoc.create({
      data: {
        hoc_vien_id: hvVhKhac.id,
        khoa_id: khoaVanHanh,
        trang_thai: 'da_phan_lop',
        muc_dau_vao: 'thanh_thao',
      },
    });
    // Phân lớp theo giai đoạn: dkVh1 học cùng lớp ở 2 giai đoạn -> sĩ số
    // vẫn chỉ tính 1 (khử trùng theo đăng ký).
    const [gdVh1, gdVh2] = await Promise.all(
      [1, 2].map((thu_tu) =>
        prisma.giai_doan_khoa.create({
          data: {
            khoa_id: khoaVanHanh,
            thu_tu,
            ten_giai_doan: `Trực tiếp đợt ${thu_tu}`,
            hinh_thuc: 'truc_tiep',
            thoi_gian_bat_dau: new Date('2026-01-01'),
            thoi_gian_ket_thuc: new Date('2026-12-31'),
          },
        }),
      ),
    );
    await prisma.phan_lop_giai_doan.createMany({
      data: [
        {
          dang_ky_hoc_id: dkVh1.id,
          giai_doan_id: gdVh1.id,
          lop_id: lopVanHanh.id,
        },
        {
          dang_ky_hoc_id: dkVh1.id,
          giai_doan_id: gdVh2.id,
          lop_id: lopVanHanh.id,
        },
        {
          dang_ky_hoc_id: dkVhKhac.id,
          giai_doan_id: gdVh1.id,
          lop_id: lopVanHanh.id,
        },
      ],
    });
    dangKyIds.push(dkVh1.id, dkVhKhac.id);

    // Tài khoản hoc_vien dùng để test 403 — dịch vụ báo cáo không có phạm vi
    // nghiệp vụ cho vai_tro này.
    const hvSuf = uniqueSuffix();
    const dk = await request(app.getHttpServer())
      .post('/hoc-vien')
      .send({
        ho_ten: 'Học Viên Kiểm Tra Phân Quyền',
        so_dinh_danh_ca_nhan: `9${Date.now().toString().slice(-11)}`,
        ngay_sinh: 9,
        thang_sinh: 9,
        nam_sinh: NAM_HOP_LE,
        noi_sinh_id: tinh.id,
        phuong_xa_id: xaKhac.id,
        don_vi_cong_tac_id: truongKhac.id,
        so_dien_thoai_lien_he: '0911119999',
        email_lien_he: `bc-403-${hvSuf}@test.local`,
        trinh_do_chuyen_mon: 'dai_hoc',
        chuyen_mon: ['Sư phạm Toán'],
      })
      .expect(201);
    hocVienIds.push(dk.body.hoc_vien_id);
    const ndHv = await prisma.nguoi_dung.findUnique({
      where: { ten_dang_nhap: dk.body.ten_dang_nhap },
    });
    if (ndHv) nguoiDungHocVienIds.push(ndHv.id);
    tokenHocVien = await dangNhap(dk.body.ten_dang_nhap, `0909${NAM_HOP_LE}`);
  });

  afterAll(async () => {
    await prisma.dang_ky_hoc.deleteMany({ where: { id: { in: dangKyIds } } });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    // hoc_vien.created_by/nguoi_duyet_id tham chiếu nguoi_dung — gỡ trước khi
    // xóa nguoi_dung để không vi phạm FK (cùng pattern
    // test/khoa-boi-duong.e2e-spec.ts).
    await prisma.hoc_vien.updateMany({
      where: { id: { in: hocVienIds } },
      data: {
        created_by: null,
        nguoi_duyet_id: null,
        cap_duyet_thuc_te: null,
        trang_thai: 'nhap',
      },
    });
    await prisma.nguoi_dung.deleteMany({
      where: { id: { in: nguoiDungHocVienIds } },
    });
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await xoaNguoiDungTest(quanTri.nguoiDung.id);
    await xoaNguoiDungTest(soAccount.nguoiDung.id);
    await xoaNguoiDungTest(phongAccount.nguoiDung.id);
    await xoaNguoiDungTest(truong1Account.nguoiDung.id);
    await xoaDonViTest(
      [
        truong1.id,
        truong2.id,
        truong3.id,
        truongKhac.id,
        phongVhxh.id,
        phongKhac.id,
        soGddt.id,
      ],
      [xaTruong1.id, xaTruong2.id, xaKhac.id, xaVanHanh.id, tinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /bao-cao/tong-hop?theo=don_vi', () => {
    it('truong1 chỉ thấy đơn vị của mình, đúng số liệu theo trang_thai/cap_giang_day', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=don_vi')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(200);
      expect(res.body.theo).toBe('don_vi');
      const rows = res.body.rows as Array<{
        don_vi_id: string;
        tong_so: number;
        theo_trang_thai: Record<string, number>;
        theo_cap_giang_day: Record<string, number>;
      }>;
      // truong1 có 3 hồ sơ trong phạm vi (hv1 da_duyet/tieu_hoc, hv2
      // cho_duyet/thcs, hvCu nhap — created_at 2000, vẫn tính vì không lọc ngày).
      const row = rows.find((r) => r.don_vi_id === truong1.id);
      expect(row).toBeDefined();
      expect(row!.tong_so).toBe(3);
      expect(row!.theo_trang_thai).toMatchObject({
        nhap: 1,
        cho_duyet: 1,
        da_duyet: 1,
        tu_choi: 0,
        loi: 0,
      });
      expect(row!.theo_cap_giang_day).toMatchObject({
        tieu_hoc: 1,
        thcs: 1,
        khong_xac_dinh: 1,
      });
      // Không thấy đơn vị nào khác ngoài phạm vi của mình.
      expect(rows.map((r) => r.don_vi_id)).toEqual([truong1.id]);
    });

    it('phong_vhxh thấy cả truong1 và truong2 (con cháu), không thấy truongKhac', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=don_vi')
        .set('Authorization', `Bearer ${tokenPhong}`)
        .expect(200);
      const ids = (res.body.rows as Array<{ don_vi_id: string }>).map(
        (r) => r.don_vi_id,
      );
      expect(ids).toContain(truong1.id);
      expect(ids).toContain(truong2.id);
      expect(ids).not.toContain(truongKhac.id);
    });

    it('so_gddt thấy toàn bộ cây (kể cả truongKhac thuộc phongKhac, phòng khác trong cùng sở)', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=don_vi')
        .set('Authorization', `Bearer ${tokenSo}`)
        .expect(200);
      const ids = (res.body.rows as Array<{ don_vi_id: string }>).map(
        (r) => r.don_vi_id,
      );
      expect(ids).toContain(truong1.id);
      expect(ids).toContain(truong2.id);
      expect(ids).toContain(truongKhac.id);
    });

    it('quan_tri (scope=ALL) thấy toàn hệ thống, không cần don_vi_id gán', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=don_vi')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      const ids = (res.body.rows as Array<{ don_vi_id: string }>).map(
        (r) => r.don_vi_id,
      );
      expect(ids).toContain(truong1.id);
      expect(ids).toContain(truong2.id);
      expect(ids).toContain(truongKhac.id);
    });

    it('tu_ngay/den_ngay loại bỏ hồ sơ tạo ngoài khoảng (hvCu created_at=2000-01-01)', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/bao-cao/tong-hop?theo=don_vi&tu_ngay=2020-01-01&den_ngay=2030-12-31',
        )
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(200);
      const row = (
        res.body.rows as Array<{ don_vi_id: string; tong_so: number }>
      ).find((r) => r.don_vi_id === truong1.id);
      // Chỉ còn hv1 + hv2 (hvCu bị loại vì created_at=2000 ngoài khoảng lọc).
      expect(row!.tong_so).toBe(2);
    });

    it('khoảng ngày không khớp dữ liệu nào -> rows rỗng', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/bao-cao/tong-hop?theo=don_vi&tu_ngay=1990-01-01&den_ngay=1990-01-02',
        )
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(200);
      expect(res.body.rows).toEqual([]);
    });

    it('hoc_vien gọi -> 403 (không có phạm vi nghiệp vụ để tổng hợp báo cáo)', async () => {
      await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=don_vi')
        .set('Authorization', `Bearer ${tokenHocVien}`)
        .expect(403);
    });

    it('không kèm token -> 401', async () => {
      await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=don_vi')
        .expect(401);
    });

    it('theo không hợp lệ -> 400', async () => {
      await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=khong_ton_tai')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(400);
    });
  });

  describe('GET /bao-cao/tong-hop?theo=dia_ban', () => {
    it('nhóm theo dia_ban_id của đơn vị công tác — truong1+truong2 cùng phòng nhưng khác xã -> 2 dòng', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=dia_ban')
        .set('Authorization', `Bearer ${tokenPhong}`)
        .expect(200);
      const rows = res.body.rows as Array<{
        dia_ban_id: string;
        tong_so: number;
      }>;
      const rowXa1 = rows.find((r) => r.dia_ban_id === xaTruong1.id);
      const rowXa2 = rows.find((r) => r.dia_ban_id === xaTruong2.id);
      expect(rowXa1).toBeDefined();
      expect(rowXa2).toBeDefined();
      expect(rowXa1!.tong_so).toBe(3); // hv1, hv2, hvCu (đều don_vi=truong1 -> dia_ban=xaTruong1)
      expect(rowXa2!.tong_so).toBe(1); // hv3 (truong2 -> xaTruong2)
    });
  });

  describe('GET /bao-cao/tong-hop?theo=khoa', () => {
    it('liệt kê khóa trong phạm vi kể cả khóa 0 đăng ký, đúng breakdown trang_thai_dang_ky/ket_qua', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=khoa')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(200);
      const rows = res.body.rows as Array<{
        khoa_id: string;
        tong_dang_ky: number;
        theo_trang_thai_dang_ky: Record<string, number>;
        theo_ket_qua: Record<string, number>;
      }>;
      const ids = rows.map((r) => r.khoa_id);
      expect(ids).toContain(khoaIds[0]); // khoa1
      expect(ids).toContain(khoaIds[1]); // khoaRong
      expect(ids).not.toContain(khoaIds[2]); // khoaKhac (ngoài phạm vi truong1)

      const khoa1Row = rows.find((r) => r.khoa_id === khoaIds[0])!;
      expect(khoa1Row.tong_dang_ky).toBe(2);
      expect(khoa1Row.theo_trang_thai_dang_ky).toMatchObject({
        da_phan_lop: 1,
        da_duyet: 1,
        cho_duyet: 0,
        tu_choi: 0,
      });
      expect(khoa1Row.theo_ket_qua).toMatchObject({
        dat: 1,
        chua_co_ket_qua: 1,
        dang_hoc: 0,
        khong_dat: 0,
        vang: 0,
      });

      const khoaRongRow = rows.find((r) => r.khoa_id === khoaIds[1])!;
      expect(khoaRongRow.tong_dang_ky).toBe(0);
    });

    it('tu_ngay/den_ngay lọc theo thoi_gian_bat_dau -> loại khoaRong (04/2026) khi lọc 03/2026', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/bao-cao/tong-hop?theo=khoa&tu_ngay=2026-03-01&den_ngay=2026-03-31',
        )
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .expect(200);
      const ids = (res.body.rows as Array<{ khoa_id: string }>).map(
        (r) => r.khoa_id,
      );
      expect(ids).toContain(khoaIds[0]);
      expect(ids).not.toContain(khoaIds[1]);
    });
  });

  // Task 5 (spec 2026-10-03-don-vi-dat-hang mục 5) — R1/R2 áp dụng cho báo
  // cáo theo khóa (tong-hop?theo=khoa, van-hanh). Cây RIÊNG, mirror fixture
  // Task 4 (test/khoa-boi-duong.e2e-spec.ts, describe "Phạm vi xem khóa"):
  //   Sở A -> Phòng P1 -> Trường T1, Trường T2
  //   Sở B -> Trường T3
  //   Đơn vị X (loại 'khac', ngoài 2 cây trên)
  // K1 đặt hàng Sở A, học viên T1 + T3 (R1 cho Sở A; R2 cho Sở B qua T3).
  // K2 đặt hàng X, học viên T1 (R2 cho Sở A qua T1).
  // K3 đặt hàng T2, chưa có học viên (chỉ R1 cho Sở A/P1/T2).
  describe('Báo cáo theo khóa (R1/R2) — tong-hop?theo=khoa, van-hanh (spec mục 5, task 5)', () => {
    let soA: { id: string };
    let soB: { id: string };
    let p1: { id: string };
    let t1: { id: string };
    let t2: { id: string };
    let t3: { id: string };
    let x: { id: string };
    let soAAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
    let soBAccount: Awaited<ReturnType<typeof taoNguoiDungTest>>;
    let t1Account: Awaited<ReturnType<typeof taoNguoiDungTest>>;
    let tokenSoA: string;
    let tokenSoB: string;
    let tokenT1: string;
    let k1Id: string;
    let k2Id: string;
    let k3Id: string;
    let lopK1Id: string;
    let hvT1Id: string;
    let hvT3Id: string;
    const donViR1R2Ids: string[] = [];
    const hvR1R2Ids: string[] = [];
    const khoaR1R2Ids: string[] = [];
    const dangKyR1R2Ids: string[] = [];

    beforeAll(async () => {
      const suf = uniqueSuffix();
      soA = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-bc-soA-${suf}`,
          ten_don_vi: `Sở A BC ${suf}`,
          loai_don_vi: 'so_gddt',
          dia_ban_id: xaTruong1.id,
        },
      });
      soB = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-bc-soB-${suf}`,
          ten_don_vi: `Sở B BC ${suf}`,
          loai_don_vi: 'so_gddt',
          dia_ban_id: xaTruong1.id,
        },
      });
      p1 = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-bc-p1-${suf}`,
          ten_don_vi: `Phòng P1 BC ${suf}`,
          loai_don_vi: 'phong_vhxh',
          dia_ban_id: xaTruong1.id,
          don_vi_cha_id: soA.id,
        },
      });
      t1 = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-bc-t1-${suf}`,
          ten_don_vi: `Trường T1 BC ${suf}`,
          loai_don_vi: 'truong',
          dia_ban_id: xaTruong1.id,
          don_vi_cha_id: p1.id,
        },
      });
      t2 = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-bc-t2-${suf}`,
          ten_don_vi: `Trường T2 BC ${suf}`,
          loai_don_vi: 'truong',
          dia_ban_id: xaTruong1.id,
          don_vi_cha_id: p1.id,
        },
      });
      t3 = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-bc-t3-${suf}`,
          ten_don_vi: `Trường T3 BC ${suf}`,
          loai_don_vi: 'truong',
          dia_ban_id: xaTruong1.id,
          don_vi_cha_id: soB.id,
        },
      });
      x = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-bc-x-${suf}`,
          ten_don_vi: `Đơn vị X BC ${suf}`,
          loai_don_vi: 'khac',
          dia_ban_id: xaTruong1.id,
        },
      });
      donViR1R2Ids.push(soA.id, soB.id, p1.id, t1.id, t2.id, t3.id, x.id);

      soAAccount = await taoNguoiDungTest({
        vai_tro: 'so_gddt',
        don_vi_id: soA.id,
        mat_khau: 'MatKhau123',
      });
      soBAccount = await taoNguoiDungTest({
        vai_tro: 'so_gddt',
        don_vi_id: soB.id,
        mat_khau: 'MatKhau123',
      });
      t1Account = await taoNguoiDungTest({
        vai_tro: 'truong',
        don_vi_id: t1.id,
        mat_khau: 'MatKhau123',
      });
      tokenSoA = await dangNhap(soAAccount.ten_dang_nhap, 'MatKhau123');
      tokenSoB = await dangNhap(soBAccount.ten_dang_nhap, 'MatKhau123');
      tokenT1 = await dangNhap(t1Account.ten_dang_nhap, 'MatKhau123');

      const k1 = await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `K1-bc-r1r2-${suf}`,
          ten_khoa: 'Khóa K1 R1R2 BC',
          don_vi_dat_hang_id: soA.id,
          thoi_gian_bat_dau: new Date('2026-05-01'),
          thoi_gian_ket_thuc: new Date('2026-05-10'),
          trang_thai: 'da_duyet',
        },
      });
      k1Id = k1.id;
      const k2 = await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `K2-bc-r1r2-${suf}`,
          ten_khoa: 'Khóa K2 R1R2 BC',
          don_vi_dat_hang_id: x.id,
          thoi_gian_bat_dau: new Date('2026-05-01'),
          thoi_gian_ket_thuc: new Date('2026-05-10'),
          trang_thai: 'da_duyet',
        },
      });
      k2Id = k2.id;
      const k3 = await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `K3-bc-r1r2-${suf}`,
          ten_khoa: 'Khóa K3 R1R2 BC',
          don_vi_dat_hang_id: t2.id,
          thoi_gian_bat_dau: new Date('2026-05-01'),
          thoi_gian_ket_thuc: new Date('2026-05-10'),
          trang_thai: 'da_duyet',
        },
      });
      k3Id = k3.id;
      khoaR1R2Ids.push(k1Id, k2Id, k3Id);

      const hvT1 = await prisma.hoc_vien.create({
        data: {
          nguon_tao: 'import_moet',
          ma_dinh_danh_moet: `M-bc-t1-${suf}`,
          ho_ten: 'Học viên BC R1R2 T1',
          ngay_sinh: 1,
          thang_sinh: 1,
          nam_sinh: NAM_HOP_LE,
          don_vi_cong_tac_id: t1.id,
        },
      });
      const hvT3 = await prisma.hoc_vien.create({
        data: {
          nguon_tao: 'import_moet',
          ma_dinh_danh_moet: `M-bc-t3-${suf}`,
          ho_ten: 'Học viên BC R1R2 T3',
          ngay_sinh: 2,
          thang_sinh: 2,
          nam_sinh: NAM_HOP_LE,
          don_vi_cong_tac_id: t3.id,
        },
      });
      hvR1R2Ids.push(hvT1.id, hvT3.id);
      hvT1Id = hvT1.id;
      hvT3Id = hvT3.id;

      const dkT1K1 = await prisma.dang_ky_hoc.create({
        data: { hoc_vien_id: hvT1.id, khoa_id: k1Id },
      });
      const dkT3K1 = await prisma.dang_ky_hoc.create({
        data: { hoc_vien_id: hvT3.id, khoa_id: k1Id },
      });
      const dkT1K2 = await prisma.dang_ky_hoc.create({
        data: { hoc_vien_id: hvT1.id, khoa_id: k2Id },
      });
      dangKyR1R2Ids.push(dkT1K1.id, dkT3K1.id, dkT1K2.id);

      // van-hanh cần lop_hoc + phan_lop_giai_doan thật để tính si_so — gán cả
      // 2 đăng ký của K1 vào cùng 1 lớp (khác pham_vi_hoc_vien 'toan_bo' với
      // 'don_vi' chỉ lộ ra khi lớp có ĐỦ 2 học viên khác đơn vị).
      const giaiDoanK1 = await prisma.giai_doan_khoa.create({
        data: {
          khoa_id: k1Id,
          thu_tu: 1,
          ten_giai_doan: 'GĐ1',
          hinh_thuc: 'truc_tiep',
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2026-12-31'),
        },
      });
      const lopK1 = await prisma.lop_hoc.create({
        data: {
          khoa_id: k1Id,
          loai_lop: 'truc_tiep',
          ten_lop: `Lớp K1 BC ${suf}`,
        },
      });
      lopK1Id = lopK1.id;
      await prisma.phan_lop_giai_doan.createMany({
        data: [
          {
            dang_ky_hoc_id: dkT1K1.id,
            giai_doan_id: giaiDoanK1.id,
            lop_id: lopK1.id,
          },
          {
            dang_ky_hoc_id: dkT3K1.id,
            giai_doan_id: giaiDoanK1.id,
            lop_id: lopK1.id,
          },
        ],
      });
    });

    afterAll(async () => {
      await prisma.dang_ky_hoc.deleteMany({
        where: { id: { in: dangKyR1R2Ids } },
      });
      await prisma.hoc_vien.deleteMany({ where: { id: { in: hvR1R2Ids } } });
      await prisma.khoa_boi_duong.deleteMany({
        where: { id: { in: khoaR1R2Ids } },
      });
      await xoaNguoiDungTest(soAAccount.nguoiDung.id);
      await xoaNguoiDungTest(soBAccount.nguoiDung.id);
      await xoaNguoiDungTest(t1Account.nguoiDung.id);
      await xoaDonViTest(donViR1R2Ids, []);
    });

    it('Sở A: dòng K1 đếm cả T1+T3 (R1 — chủ khóa), dòng K2 chỉ đếm T1 (R2)', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=khoa')
        .set('Authorization', `Bearer ${tokenSoA}`)
        .expect(200);
      const rows = res.body.rows as Array<{
        khoa_id: string;
        tong_dang_ky: number;
      }>;
      expect(rows.find((r) => r.khoa_id === k1Id)?.tong_dang_ky).toBe(2);
      expect(rows.find((r) => r.khoa_id === k2Id)?.tong_dang_ky).toBe(1);
    });

    it('Sở B: chỉ thấy dòng K1 (R2 qua T3), đếm chỉ T3 (=1)', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/tong-hop?theo=khoa')
        .set('Authorization', `Bearer ${tokenSoB}`)
        .expect(200);
      const rows = res.body.rows as Array<{
        khoa_id: string;
        tong_dang_ky: number;
      }>;
      const ids = rows.map((r) => r.khoa_id);
      expect(ids).toContain(k1Id);
      expect(ids).not.toContain(k2Id);
      expect(ids).not.toContain(k3Id);
      expect(rows.find((r) => r.khoa_id === k1Id)?.tong_dang_ky).toBe(1);
    });

    it('xuất-excel theo khóa: tiêu đề cột "Đơn vị đặt hàng"', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/xuat-excel?theo=khoa')
        .set('Authorization', `Bearer ${tokenSoA}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body as unknown as ExcelJS.Buffer);
      const sheet = workbook.worksheets[0];
      const header = (sheet.getRow(1).values as unknown[]).slice(1);
      expect(header[2]).toBe('Đơn vị đặt hàng');
    });

    it('Sở B không khoa_id -> chỉ lớp của K1, si_so chỉ T3 (=1)', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/van-hanh')
        .set('Authorization', `Bearer ${tokenSoB}`)
        .expect(200);
      const rows = res.body.rows as Array<{ lop_id: string; si_so: number }>;
      expect(rows.every((r) => r.lop_id === lopK1Id)).toBe(true);
      const row = rows.find((r) => r.lop_id === lopK1Id);
      expect(row).toBeDefined();
      expect(row!.si_so).toBe(1);
    });

    it('Sở A khoa_id=K1 -> si_so gồm cả T3 (=2, R1 — chủ khóa)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/bao-cao/van-hanh?khoa_id=${k1Id}`)
        .set('Authorization', `Bearer ${tokenSoA}`)
        .expect(200);
      const row = (
        res.body.rows as Array<{ lop_id: string; si_so: number }>
      ).find((r) => r.lop_id === lopK1Id);
      expect(row).toBeDefined();
      expect(row!.si_so).toBe(2);
    });

    it('T1 khoa_id=K3 -> 403 (ngoài phạm vi — K3 không đặt hàng T1, chưa có học viên)', async () => {
      await request(app.getHttpServer())
        .get(`/bao-cao/van-hanh?khoa_id=${k3Id}`)
        .set('Authorization', `Bearer ${tokenT1}`)
        .expect(403);
    });

    // Fix #2 (final-review.md) — GET /bao-cao/xac-nhan áp R1 khi đợt gắn
    // khoa_id và caller thỏa R1 cho khóa đó (K1 đặt hàng Sở A).
    describe('GET /bao-cao/xac-nhan — áp R1/R2 khi đợt gắn khoa_id (fix #2 final-review)', () => {
      let dotK1Id: string;
      let dotGlobalId: string;

      beforeAll(async () => {
        const now = new Date();
        const dotK1 = await prisma.dot_xac_nhan.create({
          data: {
            ten: 'Đợt xác nhận K1 R1R2',
            loai: 'kiem_tra_bo_sung',
            khoa_id: k1Id,
            mo_luc: new Date(now.getTime() - 1000),
            dong_luc: new Date(now.getTime() + 3600_000),
          },
        });
        dotK1Id = dotK1.id;
        const dotGlobal = await prisma.dot_xac_nhan.create({
          data: {
            ten: 'Đợt xác nhận toàn cục R1R2',
            loai: 'kiem_tra_bo_sung',
            khoa_id: null,
            mo_luc: new Date(now.getTime() - 1000),
            dong_luc: new Date(now.getTime() + 3600_000),
          },
        });
        dotGlobalId = dotGlobal.id;
      });

      afterAll(async () => {
        await prisma.dot_xac_nhan.deleteMany({
          where: { id: { in: [dotK1Id, dotGlobalId] } },
        });
      });

      it('Sở A (R1 — đặt hàng K1): thấy cả học viên T1 lẫn T3', async () => {
        const res = await request(app.getHttpServer())
          .get(`/bao-cao/xac-nhan?dot_id=${dotK1Id}`)
          .set('Authorization', `Bearer ${tokenSoA}`)
          .expect(200);
        const ids = (res.body.rows as { hoc_vien_id: string }[]).map(
          (r) => r.hoc_vien_id,
        );
        expect(ids).toEqual(expect.arrayContaining([hvT1Id, hvT3Id]));
      });

      it('Sở B (không đặt hàng K1, R2 qua T3): chỉ thấy học viên T3', async () => {
        const res = await request(app.getHttpServer())
          .get(`/bao-cao/xac-nhan?dot_id=${dotK1Id}`)
          .set('Authorization', `Bearer ${tokenSoB}`)
          .expect(200);
        const ids = (res.body.rows as { hoc_vien_id: string }[]).map(
          (r) => r.hoc_vien_id,
        );
        expect(ids).toEqual([hvT3Id]);
      });

      it('T1: chỉ thấy học viên T1', async () => {
        const res = await request(app.getHttpServer())
          .get(`/bao-cao/xac-nhan?dot_id=${dotK1Id}`)
          .set('Authorization', `Bearer ${tokenT1}`)
          .expect(200);
        const ids = (res.body.rows as { hoc_vien_id: string }[]).map(
          (r) => r.hoc_vien_id,
        );
        expect(ids).toEqual([hvT1Id]);
      });

      it('Đợt không gắn khoa_id -> giữ hành vi cũ (lọc theo đơn vị công tác, không áp R1)', async () => {
        const res = await request(app.getHttpServer())
          .get(`/bao-cao/xac-nhan?dot_id=${dotGlobalId}`)
          .set('Authorization', `Bearer ${tokenSoA}`)
          .expect(200);
        const ids = (res.body.rows as { hoc_vien_id: string }[]).map(
          (r) => r.hoc_vien_id,
        );
        expect(ids).toContain(hvT1Id);
        expect(ids).not.toContain(hvT3Id);
      });
    });
  });

  describe('GET /bao-cao/xuat-excel', () => {
    it('trả file .xlsx đúng content-type, đọc lại đúng số liệu + giữ dấu tiếng Việt', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/xuat-excel?theo=don_vi')
        .set('Authorization', `Bearer ${tokenTruong1}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toContain('.xlsx');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body as unknown as ExcelJS.Buffer);
      const sheet = workbook.worksheets[0];
      const header = (sheet.getRow(1).values as unknown[]).slice(1);
      expect(header[0]).toBe('Đơn vị');

      const dataRow = (sheet.getRow(2).values as unknown[]).slice(1);
      expect(dataRow[0]).toBe(truong1.ten_don_vi); // tên đơn vị giữ nguyên dấu tiếng Việt sau round-trip qua .xlsx thật
    });

    it('hoc_vien gọi xuất-excel -> 403', async () => {
      await request(app.getHttpServer())
        .get('/bao-cao/xuat-excel?theo=don_vi')
        .set('Authorization', `Bearer ${tokenHocVien}`)
        .expect(403);
    });
  });

  // T7 (mo-rong-nls-an-giang.md) — lopVanHanh (khoaVanHanh, chủ truong3) có
  // 2 học viên phân lớp thật: hvVh1 (truong3, có email, muc_dau_vao=co_ban),
  // hvVhKhac (truongKhac, ngoài phạm vi phongVhxh, có email,
  // muc_dau_vao=thanh_thao).
  describe('GET /bao-cao/van-hanh', () => {
    it('quan_tri: si_so/so_co_email/phân bố muc_dau_vao đúng, không giới hạn phạm vi học viên', async () => {
      const res = await request(app.getHttpServer())
        .get(`/bao-cao/van-hanh?khoa_id=${khoaVanHanh}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      const row = (
        res.body.rows as Array<{
          lop_id: string;
          ten_lop: string;
          si_so: number;
          so_co_email: number;
          theo_muc_dau_vao: Record<string, number>;
        }>
      ).find((r) => r.lop_id === lopVanHanh.id);
      expect(row).toBeDefined();
      expect(row!.ten_lop).toBe(lopVanHanh.ten_lop);
      expect(row!.si_so).toBe(2);
      expect(row!.so_co_email).toBe(2);
      expect(row!.theo_muc_dau_vao).toMatchObject({
        co_ban: 1,
        thanh_thao: 1,
        nang_cao: 0,
        khong_xac_dinh: 0,
      });
      expect(res.body.tong.si_so).toBeGreaterThanOrEqual(2);
    });

    it('so_gddt (Sở) thấy lớp thuộc phạm vi theo dõi/sở hữu của Sở (truong3 dưới phongVhxh dưới soGddt)', async () => {
      const res = await request(app.getHttpServer())
        .get('/bao-cao/van-hanh')
        .set('Authorization', `Bearer ${tokenSo}`)
        .expect(200);
      const lopIds = (res.body.rows as Array<{ lop_id: string }>).map(
        (r) => r.lop_id,
      );
      expect(lopIds).toContain(lopVanHanh.id);
    });

    // Spec mục 5 (R1/R2, task 5): truong3 (chủ khóa khoaVanHanh) là con cháu
    // của phongVhxh -> R1 áp dụng (don_vi_dat_hang_id ∈ scope của phongVhxh)
    // -> đếm TOÀN BỘ học viên của khóa, KỂ CẢ hvVhKhac (truongKhac, phòng
    // khác) — khác hành vi cũ (chỉ đếm theo scope hồ sơ của phongVhxh, không
    // mở rộng theo quyền chủ khóa).
    it('phong_vhxh: chủ khóa (truong3) trong phạm vi -> R1, đếm TOÀN BỘ học viên kể cả hvVhKhac (truongKhac, phòng khác)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/bao-cao/van-hanh?khoa_id=${khoaVanHanh}`)
        .set('Authorization', `Bearer ${tokenPhong}`)
        .expect(200);
      const row = (
        res.body.rows as Array<{
          lop_id: string;
          si_so: number;
          so_co_email: number;
          theo_muc_dau_vao: Record<string, number>;
        }>
      ).find((r) => r.lop_id === lopVanHanh.id);
      expect(row).toBeDefined();
      expect(row!.si_so).toBe(2);
      expect(row!.so_co_email).toBe(2);
      expect(row!.theo_muc_dau_vao).toMatchObject({
        co_ban: 1,
        thanh_thao: 1,
        nang_cao: 0,
        khong_xac_dinh: 0,
      });
    });

    it('phong_vhxh gọi khoa_id ngoài phạm vi (khoaKhac, chủ truongKhac) -> 403', async () => {
      await request(app.getHttpServer())
        .get(`/bao-cao/van-hanh?khoa_id=${khoaIds[2]}`)
        .set('Authorization', `Bearer ${tokenPhong}`)
        .expect(403);
    });

    it('lọc theo lop_id chỉ trả đúng 1 lớp', async () => {
      const res = await request(app.getHttpServer())
        .get(`/bao-cao/van-hanh?lop_id=${lopVanHanh.id}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(res.body.rows).toHaveLength(1);
      expect(res.body.rows[0].lop_id).toBe(lopVanHanh.id);
    });

    it('lọc theo nhom_hoc_vien không khớp -> rows rỗng', async () => {
      const res = await request(app.getHttpServer())
        .get(`/bao-cao/van-hanh?khoa_id=${khoaVanHanh}&nhom_hoc_vien=2`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(200);
      expect(
        (res.body.rows as Array<{ lop_id: string }>).some(
          (r) => r.lop_id === lopVanHanh.id,
        ),
      ).toBe(false);
    });

    it('khoa_id không tồn tại -> 404', async () => {
      await request(app.getHttpServer())
        .get('/bao-cao/van-hanh?khoa_id=00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .expect(404);
    });

    it('hoc_vien gọi -> 403', async () => {
      await request(app.getHttpServer())
        .get('/bao-cao/van-hanh')
        .set('Authorization', `Bearer ${tokenHocVien}`)
        .expect(403);
    });
  });

  describe('GET /bao-cao/van-hanh/xuat-excel', () => {
    it('trả file .xlsx đúng nội dung + dòng "Tổng cộng"', async () => {
      const res = await request(app.getHttpServer())
        .get(`/bao-cao/van-hanh/xuat-excel?khoa_id=${khoaVanHanh}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toContain('.xlsx');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body as unknown as ExcelJS.Buffer);
      const sheet = workbook.worksheets[0];
      const header = (sheet.getRow(1).values as unknown[]).slice(1);
      expect(header[0]).toBe('Tên lớp');

      const lastRow = (sheet.getRow(sheet.rowCount).values as unknown[]).slice(
        1,
      );
      expect(lastRow[0]).toBe('Tổng cộng');
    });
  });
});
