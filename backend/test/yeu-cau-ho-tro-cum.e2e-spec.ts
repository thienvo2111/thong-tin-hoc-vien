import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
} from './utils/test-data';

// Người hỗ trợ học viên — Lát 4 (ADR 0003 H10–H14, đặc tả 2026-10-06 mục 4):
// yêu cầu hỗ trợ theo cụm, trả lời có điều kiện, Quản trị sửa câu trả lời.
// Kịch bản T5, T12, T13, T14, T15.
describe('Yêu cầu hỗ trợ theo cụm (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  const SUF = suf.toUpperCase();
  const MIEN = `${suf}@ychtc.vn`;
  const diaDanhIds: string[] = [];
  const donViIds: string[] = [];
  const nguoiDungIds: string[] = [];
  const hocVienIds: string[] = [];
  const khoaIds: string[] = [];
  let donViId: string;
  let tokenQuanTri: string;
  let quanTriId: string;
  const ht: Record<'s1' | 's2', { id: string; token: string }> = {
    s1: { id: '', token: '' },
    s2: { id: '', token: '' },
  };
  const hv: Record<'a' | 'b' | 'x', { id: string; token: string }> = {
    a: { id: '', token: '' },
    b: { id: '', token: '' },
    x: { id: '', token: '' },
  };

  const http = () => request(app.getHttpServer());
  const dangNhap = async (ten: string, mk: string) =>
    (
      await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: ten, mat_khau: mk })
    ).body.token as string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function taoHoTro(nhan: 's1' | 's2') {
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: `Cán bộ ${nhan}`,
        ten_dang_nhap: `ycht-${nhan}-${suf}`,
        email: `${nhan}-${MIEN}`,
        vai_tro: 'ho_tro_hoc_vien',
        mat_khau_hash: await bcrypt.hash('HoTro12345', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    ht[nhan] = {
      id: nd.id,
      token: await dangNhap(nd.ten_dang_nhap, 'HoTro12345'),
    };
  }

  async function taoHocVien(nhan: 'a' | 'b' | 'x') {
    const h = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `YC-${nhan}-${SUF}`,
        ho_ten: `Học viên ${nhan.toUpperCase()}`,
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: 1990,
        don_vi_cong_tac_id: donViId,
        email_lien_he: `hv-${nhan}-${MIEN}`,
      },
    });
    hocVienIds.push(h.id);
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: h.ho_ten,
        ten_dang_nhap: `YC-${nhan}-${SUF}`,
        vai_tro: 'hoc_vien',
        hoc_vien_id: h.id,
        mat_khau_hash: await bcrypt.hash('HocVien12345', 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    hv[nhan] = {
      id: h.id,
      token: await dangNhap(nd.ten_dang_nhap, 'HocVien12345'),
    };
  }

  async function taoTicket(
    nhan: 'a' | 'b' | 'x',
    noiDung: string,
  ): Promise<string> {
    const res = await http()
      .post('/yeu-cau-ho-tro/toi')
      .set(auth(hv[nhan].token))
      .send({ tinh_huong: 'Khác', noi_dung_hoi: noiDung });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  const traLoi = (
    id: string,
    token: string,
    noiDung: string,
    duong = '/yeu-cau-ho-tro',
  ) =>
    http()
      .patch(`${duong}/${id}/tra-loi`)
      .set(auth(token))
      .send({ noi_dung_tra_loi: noiDung });
  const traLoiHoTro = (id: string, token: string, noiDung: string) =>
    traLoi(id, token, noiDung, '/ho-tro/yeu-cau-ho-tro');
  const soEmail = (
    email: string,
    loai: 'yeu_cau_ho_tro_tra_loi' | 'yeu_cau_ho_tro_cap_nhat_tra_loi',
  ) =>
    prisma.hang_doi_email.count({
      where: { email_nguoi_nhan: email, loai_su_kien: loai },
    });

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    const tinh = await prisma.dia_danh.create({
      data: { ma: `T-ychtc-${suf}`, ten: `Tỉnh ${suf}`, cap: 'tinh_thanh' },
    });
    const xa = await prisma.dia_danh.create({
      data: {
        ma: `X-ychtc-${suf}`,
        ten: `Xã ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    diaDanhIds.push(xa.id, tinh.id);
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-ychtc-${suf}`,
        ten_don_vi: `Trường ${suf}`,
        loai_don_vi: 'truong',
        dia_ban_id: xa.id,
      },
    });
    donViIds.push(dv.id);
    donViId = dv.id;

    const qt = await taoNguoiDungTest({
      vai_tro: 'quan_tri',
      don_vi_id: dv.id,
      mat_khau: 'QuanTri12345',
    });
    nguoiDungIds.push(qt.nguoiDung.id);
    quanTriId = qt.nguoiDung.id;
    tokenQuanTri = await dangNhap(qt.ten_dang_nhap, 'QuanTri12345');
    await taoHoTro('s1');
    await taoHoTro('s2');
    await taoHocVien('a');
    await taoHocVien('b');
    await taoHocVien('x');

    const khoa = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-YCHTC-${SUF}`,
        ten_khoa: `Khóa ${suf}`,
        don_vi_dat_hang_id: donViId,
        thoi_gian_bat_dau: new Date('2026-10-01'),
        thoi_gian_ket_thuc: new Date('2027-02-01'),
        trang_thai: 'da_duyet',
      },
    });
    khoaIds.push(khoa.id);
    const cumA = await prisma.cum_hoc_vien.create({
      data: { khoa_id: khoa.id, ten_cum: 'Cụm hỗ trợ A' },
    });
    const cumB = await prisma.cum_hoc_vien.create({
      data: { khoa_id: khoa.id, ten_cum: 'Cụm hỗ trợ B' },
    });
    await prisma.dang_ky_hoc.createMany({
      data: [
        { hoc_vien_id: hv.a.id, khoa_id: khoa.id, cum_id: cumA.id },
        { hoc_vien_id: hv.b.id, khoa_id: khoa.id, cum_id: cumB.id },
        // T5: học viên x đã ghi danh nhưng CHƯA có cụm.
        { hoc_vien_id: hv.x.id, khoa_id: khoa.id },
      ],
    });
    await prisma.phan_cong_ho_tro.createMany({
      data: [
        { nguoi_dung_id: ht.s1.id, cum_id: cumA.id },
        { nguoi_dung_id: ht.s2.id, cum_id: cumB.id },
      ],
    });
  });

  afterAll(async () => {
    await prisma.yeu_cau_ho_tro.deleteMany({
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

  describe('Hàng chờ theo cụm', () => {
    let ticketA: string;
    let ticketB: string;
    let ticketX: string;
    beforeAll(async () => {
      ticketA = await taoTicket('a', 'Em quên link Zoom');
      ticketB = await taoTicket('b', 'Em chưa đăng nhập được');
      ticketX = await taoTicket('x', 'Em chưa biết thuộc cụm nào');
    });

    it('người hỗ trợ chỉ thấy ticket của học viên trong cụm mình, kèm tên học viên + tên cụm', async () => {
      const res = await http()
        .get('/ho-tro/yeu-cau-ho-tro?trang_thai=cho_xu_ly')
        .set(auth(ht.s1.token));
      expect(res.status).toBe(200);
      const ids = res.body.data.map((x: { id: string }) => x.id);
      expect(ids).toContain(ticketA);
      expect(ids).not.toContain(ticketB);
      expect(ids).not.toContain(ticketX);
      const dong = res.body.data.find((x: { id: string }) => x.id === ticketA);
      expect(dong).toMatchObject({
        hoc_vien_ho_ten: 'Học viên A',
        ten_cum: ['Cụm hỗ trợ A'],
        hoi_lai: false,
      });
    });

    it('số đếm chờ xử lý cho menu', async () => {
      const res = await http()
        .get('/ho-tro/yeu-cau-ho-tro/dem')
        .set(auth(ht.s1.token));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ cho_xu_ly: 1 });
    });

    it('chi tiết ticket ngoài cụm -> 404; trả lời ticket ngoài cụm -> 404', async () => {
      expect(
        (
          await http()
            .get(`/ho-tro/yeu-cau-ho-tro/${ticketB}`)
            .set(auth(ht.s1.token))
        ).status,
      ).toBe(404);
      expect((await traLoiHoTro(ticketB, ht.s1.token, 'x')).status).toBe(404);
    });

    it('T5: học viên chưa có cụm -> không người hỗ trợ nào thấy; Quản trị lọc chua_co_cum thấy', async () => {
      for (const s of [ht.s1, ht.s2]) {
        const r = await http().get('/ho-tro/yeu-cau-ho-tro').set(auth(s.token));
        expect(r.body.data.map((x: { id: string }) => x.id)).not.toContain(
          ticketX,
        );
      }
      const qt = await http()
        .get('/yeu-cau-ho-tro?chua_co_cum=true')
        .set(auth(tokenQuanTri));
      expect(qt.status).toBe(200);
      const ids = qt.body.data.map((x: { id: string }) => x.id);
      expect(ids).toContain(ticketX);
      expect(ids).not.toContain(ticketA);
      expect(
        qt.body.data.find((x: { id: string }) => x.id === ticketX).ten_cum,
      ).toEqual([]);
      const tatCa = await http().get('/yeu-cau-ho-tro').set(auth(tokenQuanTri));
      expect(
        tatCa.body.data.find((x: { id: string }) => x.id === ticketA).ten_cum,
      ).toEqual(['Cụm hỗ trợ A']);
    });

    it('T15: người hỗ trợ trả lời -> học viên thấy ký tên "Cụm hỗ trợ A", không thấy id/tên cán bộ; có email', async () => {
      const res = await traLoiHoTro(
        ticketA,
        ht.s1.token,
        'Link Zoom ở mục Lớp học ạ',
      );
      expect(res.status).toBe(200);
      expect(res.body.trang_thai).toBe('da_phan_hoi');
      expect(await soEmail(`hv-a-${MIEN}`, 'yeu_cau_ho_tro_tra_loi')).toBe(1);

      const cuaToi = await http()
        .get('/yeu-cau-ho-tro/toi')
        .set(auth(hv.a.token));
      const t = cuaToi.body.find((x: { id: string }) => x.id === ticketA);
      expect(t.nguoi_tra_loi_hien_thi).toBe('Cụm hỗ trợ A');
      expect(t).not.toHaveProperty('tra_loi_boi');
      expect(JSON.stringify(cuaToi.body)).not.toContain('Cán bộ s1');

      const qt = await http()
        .get(`/yeu-cau-ho-tro/${ticketA}`)
        .set(auth(tokenQuanTri));
      expect(qt.body.nguoi_tra_loi_ten).toBe('Cán bộ s1');
    });

    it('T15: Quản trị trả lời -> học viên thấy "Ban tổ chức (HCMUE)"', async () => {
      expect(
        (await traLoi(ticketX, tokenQuanTri, 'Thầy/Cô sẽ được gán cụm sớm'))
          .status,
      ).toBe(200);
      const cuaToi = await http()
        .get('/yeu-cau-ho-tro/toi')
        .set(auth(hv.x.token));
      expect(cuaToi.body[0].nguoi_tra_loi_hien_thi).toBe('Ban tổ chức (HCMUE)');
    });

    it('T13: trả lời ticket đã có câu trả lời -> 409, không ghi đè (cả Quản trị)', async () => {
      const r1 = await traLoi(ticketA, tokenQuanTri, 'Ghi đè');
      expect(r1.status).toBe(409);
      const r2 = await traLoiHoTro(ticketA, ht.s1.token, 'Ghi đè 2');
      expect(r2.status).toBe(409);
      const db = await prisma.yeu_cau_ho_tro.findUnique({
        where: { id: ticketA },
      });
      expect(db?.noi_dung_tra_loi).toBe('Link Zoom ở mục Lớp học ạ');
      expect(db?.tra_loi_boi).toBe(ht.s1.id);
    });

    it('chi tiết cho người hỗ trợ kèm các ticket trước của cùng học viên', async () => {
      const ticketA2 = await taoTicket('a', 'Em hỏi thêm về lịch');
      const res = await http()
        .get(`/ho-tro/yeu-cau-ho-tro/${ticketA2}`)
        .set(auth(ht.s1.token));
      expect(res.status).toBe(200);
      expect(res.body.ticket_truoc.map((x: { id: string }) => x.id)).toEqual([
        ticketA,
      ]);
      expect(res.body.ticket_truoc[0].noi_dung_tra_loi).toBe(
        'Link Zoom ở mục Lớp học ạ',
      );
    });
  });

  it('T12: 2 người cùng trả lời 1 ticket song song -> đúng 1 thành công, 1 nhận 409, 1 email', async () => {
    const id = await taoTicket('b', 'Câu hỏi tranh chấp');
    const [r1, r2] = await Promise.all([
      traLoiHoTro(id, ht.s2.token, 'Trả lời của người hỗ trợ'),
      traLoi(id, tokenQuanTri, 'Trả lời của quản trị'),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    const thang =
      r1.status === 200 ? 'Trả lời của người hỗ trợ' : 'Trả lời của quản trị';
    const db = await prisma.yeu_cau_ho_tro.findUnique({ where: { id } });
    expect(db?.noi_dung_tra_loi).toBe(thang);
    expect(await soEmail(`hv-b-${MIEN}`, 'yeu_cau_ho_tro_tra_loi')).toBe(1);
  });

  describe('T14: Quản trị sửa câu trả lời', () => {
    let id: string;
    beforeAll(async () => {
      id = await taoTicket('a', 'Câu hỏi sẽ được sửa trả lời');
      await traLoiHoTro(id, ht.s1.token, 'Trả lời sai');
      await http()
        .post(`/yeu-cau-ho-tro/toi/${id}/danh-gia`)
        .set(auth(hv.a.token))
        .send({ danh_gia: 'chua_hai_long' });
      await http().post(`/yeu-cau-ho-tro/toi/${id}/dong`).set(auth(hv.a.token));
    });

    it('người hỗ trợ không sửa được câu trả lời -> 403', async () => {
      const res = await http()
        .patch(`/yeu-cau-ho-tro/${id}/sua-tra-loi`)
        .set(auth(ht.s1.token))
        .send({ noi_dung_tra_loi: 'x' });
      expect(res.status).toBe(403);
    });

    it('ticket chưa có câu trả lời -> 409', async () => {
      const moi = await taoTicket('a', 'Chưa trả lời');
      const res = await http()
        .patch(`/yeu-cau-ho-tro/${moi}/sua-tra-loi`)
        .set(auth(tokenQuanTri))
        .send({ noi_dung_tra_loi: 'x' });
      expect(res.status).toBe(409);
    });

    it('sửa ticket đã đóng: nội dung mới, mở lại da_phan_hoi, reset đánh giá, email cập nhật, nhật ký nội dung cũ', async () => {
      const res = await http()
        .patch(`/yeu-cau-ho-tro/${id}/sua-tra-loi`)
        .set(auth(tokenQuanTri))
        .send({ noi_dung_tra_loi: 'Trả lời đã đính chính' });
      expect(res.status).toBe(200);
      const db = await prisma.yeu_cau_ho_tro.findUnique({ where: { id } });
      expect(db).toMatchObject({
        noi_dung_tra_loi: 'Trả lời đã đính chính',
        trang_thai: 'da_phan_hoi',
        danh_gia: null,
        thoi_gian_dong: null,
        sua_tra_loi_boi: quanTriId,
        tra_loi_boi: ht.s1.id,
      });
      expect(db?.thoi_gian_sua_tra_loi).toBeInstanceOf(Date);
      expect(
        await soEmail(`hv-a-${MIEN}`, 'yeu_cau_ho_tro_cap_nhat_tra_loi'),
      ).toBe(1);
      const nhatKy = await prisma.nhat_ky_hoat_dong.findFirst({
        where: { hanh_dong: 'sua_tra_loi_ho_tro', hoc_vien_id: hv.a.id },
        orderBy: { thoi_gian: 'desc' },
      });
      expect(nhatKy?.chi_tiet).toMatchObject({
        yeu_cau_id: id,
        noi_dung_cu: 'Trả lời sai',
      });

      const cuaToi = await http()
        .get('/yeu-cau-ho-tro/toi')
        .set(auth(hv.a.token));
      const t = cuaToi.body.find((x: { id: string }) => x.id === id);
      expect(t.thoi_gian_sua_tra_loi).toBeTruthy();
      expect(t.da_dong_hieu_luc).toBe(false);
      expect(t).not.toHaveProperty('sua_tra_loi_boi');

      const htRes = await http()
        .get(`/ho-tro/yeu-cau-ho-tro/${id}`)
        .set(auth(ht.s1.token));
      expect(htRes.body.da_sua_boi_quan_tri).toBe(true);
    });
  });

  it('T19: vai trò khác gọi /ho-tro/yeu-cau-ho-tro -> 403', async () => {
    expect(
      (await http().get('/ho-tro/yeu-cau-ho-tro').set(auth(tokenQuanTri)))
        .status,
    ).toBe(403);
    expect(
      (await http().get('/ho-tro/yeu-cau-ho-tro').set(auth(hv.a.token))).status,
    ).toBe(403);
  });
});
