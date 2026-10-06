import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDotXacNhanTest,
  uniqueSuffix,
  xoaDotXacNhanTest,
  xoaNguoiDungTest,
} from './utils/test-data';

// Người hỗ trợ học viên — Lát 3 (ADR 0003 H7–H9, đặc tả 2026-10-06 mục 3):
// sửa hồ sơ bắt buộc lý do + 3 thao tác tài khoản. Kịch bản T1 (ghi), T6–T11.
describe('Người hỗ trợ — sửa hồ sơ & tài khoản học viên (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  const SUF = suf.toUpperCase();
  const MIEN = `${suf}@htct.vn`;
  const diaDanhIds: string[] = [];
  const donViIds: string[] = [];
  const nguoiDungIds: string[] = [];
  const hocVienIds: string[] = [];
  const khoaIds: string[] = [];
  const dotIds: string[] = [];
  let khoaId: string;
  let tokenHoTro: string;
  let hoTroId: string;
  const hv: Record<
    'trong' | 'ngoai',
    { id: string; ndId: string; ten: string }
  > = {
    trong: { id: '', ndId: '', ten: '' },
    ngoai: { id: '', ndId: '', ten: '' },
  };

  const http = () => request(app.getHttpServer());
  const dangNhap = (ten: string, mk: string) =>
    http().post('/auth/dang-nhap').send({ ten_dang_nhap: ten, mat_khau: mk });
  const auth = () => ({ Authorization: `Bearer ${tokenHoTro}` });
  const sua = (id: string, body: Record<string, unknown>) =>
    http().patch(`/ho-tro/hoc-vien/${id}`).set(auth()).send(body);
  const post = (id: string, thaoTac: string) =>
    http().post(`/ho-tro/hoc-vien/${id}/${thaoTac}`).set(auth());

  async function taoHocVien(nhan: 'trong' | 'ngoai', donViId: string) {
    const h = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `CT-${nhan}-${SUF}`,
        ho_ten: `Học viên ${nhan}`,
        ngay_sinh: 2,
        thang_sinh: 3,
        nam_sinh: 1988,
        don_vi_cong_tac_id: donViId,
        email_lien_he: `hv-${nhan}-${MIEN}`,
        email_da_xac_minh: true,
        so_dien_thoai_lien_he: '0912345678',
      },
    });
    hocVienIds.push(h.id);
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: h.ho_ten,
        ten_dang_nhap: `CT-${nhan}-${SUF}`,
        vai_tro: 'hoc_vien',
        hoc_vien_id: h.id,
        mat_khau_hash: await bcrypt.hash('CuMatKhau123', 4),
        phai_doi_mat_khau: false,
        so_lan_dang_nhap_sai: 5,
        khoa_den: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    nguoiDungIds.push(nd.id);
    hv[nhan] = { id: h.id, ndId: nd.id, ten: nd.ten_dang_nhap };
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    const tinh = await prisma.dia_danh.create({
      data: { ma: `T-htct-${suf}`, ten: `Tỉnh ${suf}`, cap: 'tinh_thanh' },
    });
    const xa = await prisma.dia_danh.create({
      data: {
        ma: `X-htct-${suf}`,
        ten: `Xã ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    diaDanhIds.push(xa.id, tinh.id);
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-htct-${suf}`,
        ten_don_vi: `Trường ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xa.id,
      },
    });
    donViIds.push(dv.id);

    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: 'Cán bộ hỗ trợ',
        ten_dang_nhap: `htct-${suf}`,
        email: `ht-${MIEN}`,
        vai_tro: 'ho_tro_hoc_vien',
        mat_khau_hash: await bcrypt.hash('HoTro12345', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    hoTroId = nd.id;
    tokenHoTro = (await dangNhap(nd.ten_dang_nhap, 'HoTro12345')).body.token;

    await taoHocVien('trong', dv.id);
    await taoHocVien('ngoai', dv.id);
    const khoa = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-HTCT-${SUF}`,
        ten_khoa: `Khóa ${suf}`,
        don_vi_dat_hang_id: dv.id,
        thoi_gian_bat_dau: new Date('2026-10-01'),
        thoi_gian_ket_thuc: new Date('2027-02-01'),
        trang_thai: 'da_duyet',
      },
    });
    khoaIds.push(khoa.id);
    khoaId = khoa.id;
    const cumA = await prisma.cum_hoc_vien.create({
      data: { khoa_id: khoa.id, ten_cum: 'Cụm A' },
    });
    const cumB = await prisma.cum_hoc_vien.create({
      data: { khoa_id: khoa.id, ten_cum: 'Cụm B' },
    });
    await prisma.dang_ky_hoc.createMany({
      data: [
        { hoc_vien_id: hv.trong.id, khoa_id: khoa.id, cum_id: cumA.id },
        { hoc_vien_id: hv.ngoai.id, khoa_id: khoa.id, cum_id: cumB.id },
      ],
    });
    await prisma.phan_cong_ho_tro.create({
      data: { nguoi_dung_id: hoTroId, cum_id: cumA.id },
    });
  });

  afterAll(async () => {
    await xoaDotXacNhanTest(dotIds);
    await prisma.lich_su_thay_doi_ho_so.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.xac_nhan_ho_so.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.nhat_ky_dat_lai_mat_khau.deleteMany({
      where: {
        OR: [
          { nguoi_dung_id: { in: nguoiDungIds } },
          { thuc_hien_boi: { in: nguoiDungIds } },
        ],
      },
    });
    await prisma.token_xac_thuc.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.hang_doi_email.deleteMany({
      where: { email_nguoi_nhan: { endsWith: MIEN } },
    });
    await prisma.nhat_ky_thong_bao.deleteMany({
      where: { hoc_vien_id: { in: hocVienIds } },
    });
    await prisma.dang_ky_hoc.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await prisma.don_vi_cong_tac.deleteMany({
      where: { id: { in: donViIds } },
    });
    await prisma.dia_danh.deleteMany({ where: { id: { in: diaDanhIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('T1 (ghi): học viên ngoài cụm -> 404 cho sửa hồ sơ và mọi thao tác tài khoản', async () => {
    expect(
      (await sua(hv.ngoai.id, { chuc_vu: 'x', ly_do: 'Thử ngoài cụm' })).status,
    ).toBe(404);
    for (const t of [
      'gui-link-dat-lai-mat-khau',
      'cap-mat-khau-tam',
      'mo-khoa-tam',
    ]) {
      expect((await post(hv.ngoai.id, t)).status).toBe(404);
    }
  });

  it('T6: thiếu lý do / lý do quá ngắn -> 400', async () => {
    expect((await sua(hv.trong.id, { chuc_vu: 'Tổ trưởng' })).status).toBe(400);
    expect(
      (await sua(hv.trong.id, { chuc_vu: 'Tổ trưởng', ly_do: '  ab ' })).status,
    ).toBe(400);
  });

  it('T7: gửi số định danh/CCCD -> 400, không sửa', async () => {
    const res = await sua(hv.trong.id, {
      so_dinh_danh_ca_nhan: '079088000001',
      ly_do: 'Học viên nhờ sửa CCCD',
    });
    expect(res.status).toBe(400);
    const h = await prisma.hoc_vien.findUnique({ where: { id: hv.trong.id } });
    expect(h?.so_dinh_danh_ca_nhan).toBeNull();
  });

  it('T8: sửa ngày sinh ngoài đợt -> thành công, lịch sử có lý do + vai trò người hỗ trợ; chi tiết trả ly_do', async () => {
    const res = await sua(hv.trong.id, {
      ngay_sinh: 12,
      ly_do: 'Học viên báo sai ngày sinh qua Zalo',
    });
    expect(res.status).toBe(200);
    const ls = await prisma.lich_su_thay_doi_ho_so.findMany({
      where: { hoc_vien_id: hv.trong.id, truong: 'ngay_sinh' },
    });
    expect(ls).toHaveLength(1);
    expect(ls[0]).toMatchObject({
      gia_tri_cu: '2',
      gia_tri_moi: '12',
      ly_do: 'Học viên báo sai ngày sinh qua Zalo',
      vai_tro_nguoi_sua: 'ho_tro_hoc_vien',
      nguoi_sua_id: hoTroId,
      dot_id: null,
    });
    const ct = await http().get(`/ho-tro/hoc-vien/${hv.trong.id}`).set(auth());
    expect(ct.body.lich_su_thay_doi[0]).toMatchObject({
      truong: 'ngay_sinh',
      ly_do: 'Học viên báo sai ngày sinh qua Zalo',
    });
  });

  it('T9: sửa khi có đợt mở và học viên đã xác nhận -> xác nhận bị hủy, lịch sử gắn đợt', async () => {
    const dot = await taoDotXacNhanTest({ khoa_id: khoaId });
    dotIds.push(dot.id);
    await prisma.xac_nhan_ho_so.create({
      data: { dot_id: dot.id, hoc_vien_id: hv.trong.id, du_lieu: {} },
    });
    const res = await sua(hv.trong.id, {
      chuc_vu: 'Tổ phó chuyên môn',
      ly_do: 'Cập nhật chức vụ theo quyết định',
    });
    expect(res.status).toBe(200);
    expect(res.body.xac_nhan_bi_huy).toBe(true);
    const xn = await prisma.xac_nhan_ho_so.findFirst({
      where: { dot_id: dot.id, hoc_vien_id: hv.trong.id },
    });
    expect(xn?.con_hieu_luc).toBe(false);
    const ls = await prisma.lich_su_thay_doi_ho_so.findFirst({
      where: { hoc_vien_id: hv.trong.id, truong: 'chuc_vu' },
    });
    expect(ls?.dot_id).toBe(dot.id);
    // Đóng đợt để các kịch bản sau chạy "ngoài đợt".
    await prisma.dot_xac_nhan.update({
      where: { id: dot.id },
      data: { dong_luc: new Date(Date.now() - 1000) },
    });
  });

  describe('Đặt lại mật khẩu qua email', () => {
    it('email đã xác minh -> gửi link (token + email); gửi lại ngay -> 429', async () => {
      const res = await post(hv.trong.id, 'gui-link-dat-lai-mat-khau');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ da_gui: true, email: `hv-trong-${MIEN}` });
      expect(
        await prisma.token_xac_thuc.count({
          where: {
            hoc_vien_id: hv.trong.id,
            loai: 'dat_lai_mat_khau',
            da_dung_luc: null,
          },
        }),
      ).toBe(1);
      // Email đặt lại mật khẩu đi làn ưu tiên (gửi ngay, ghi nhat_ky_thong_bao), không qua hàng đợi.
      expect(
        await prisma.nhat_ky_thong_bao.count({
          where: { hoc_vien_id: hv.trong.id, loai_su_kien: 'dat_lai_mat_khau' },
        }),
      ).toBe(1);
      expect(
        (await post(hv.trong.id, 'gui-link-dat-lai-mat-khau')).status,
      ).toBe(429);
    });

    it('T10: người hỗ trợ sửa email -> email_da_xac_minh=false; gửi link -> 409', async () => {
      const res = await sua(hv.trong.id, {
        email_lien_he: `moi-${MIEN}`,
        ly_do: 'Học viên đổi email cá nhân',
      });
      expect(res.status).toBe(200);
      const h = await prisma.hoc_vien.findUnique({
        where: { id: hv.trong.id },
      });
      expect(h).toMatchObject({
        email_lien_he: `moi-${MIEN}`,
        email_da_xac_minh: false,
      });
      expect(
        (await post(hv.trong.id, 'gui-link-dat-lai-mat-khau')).status,
      ).toBe(409);
    });
  });

  it('T11: cấp mật khẩu tạm -> đăng nhập được, buộc đổi; mở khóa; link cũ mất hiệu lực; có nhật ký', async () => {
    const res = await post(hv.trong.id, 'cap-mat-khau-tam');
    expect(res.status).toBe(200);
    expect(res.body.ten_dang_nhap).toBe(hv.trong.ten);
    expect(res.body.mat_khau_tam).toMatch(/^[A-Za-z2-9]{10}$/);
    const nd = await prisma.nguoi_dung.findUnique({
      where: { id: hv.trong.ndId },
    });
    expect(nd).toMatchObject({
      phai_doi_mat_khau: true,
      khoa_den: null,
      so_lan_dang_nhap_sai: 0,
    });
    expect(
      await prisma.token_xac_thuc.count({
        where: {
          hoc_vien_id: hv.trong.id,
          loai: 'dat_lai_mat_khau',
          da_dung_luc: null,
        },
      }),
    ).toBe(0);
    expect(
      await prisma.nhat_ky_dat_lai_mat_khau.count({
        where: { nguoi_dung_id: hv.trong.ndId, thuc_hien_boi: hoTroId },
      }),
    ).toBe(1);
    const dn = await dangNhap(hv.trong.ten, res.body.mat_khau_tam);
    expect(dn.status).toBe(200);
    expect(dn.body.nguoi_dung.phai_doi_mat_khau).toBe(true);
  });

  it('mở khóa tạm -> xóa khoa_den và bộ đếm sai', async () => {
    await prisma.nguoi_dung.update({
      where: { id: hv.trong.ndId },
      data: {
        khoa_den: new Date(Date.now() + 600_000),
        so_lan_dang_nhap_sai: 5,
      },
    });
    const res = await post(hv.trong.id, 'mo-khoa-tam');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dang_bi_khoa: false });
    const nd = await prisma.nguoi_dung.findUnique({
      where: { id: hv.trong.ndId },
    });
    expect(nd).toMatchObject({ khoa_den: null, so_lan_dang_nhap_sai: 0 });
  });
});
