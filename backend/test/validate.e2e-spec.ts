import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  uniqueSuffix,
  xoaDonViTest,
} from './utils/test-data';

const NAM_HOP_LE = new Date().getUTCFullYear() - 20;

function soDinhDanhNgauNhien(): string {
  const t = Date.now().toString().slice(-6);
  const r = Math.floor(100000 + Math.random() * 899999).toString();
  return `${t}${r}`;
}

// Gap 3 (2026-09-28) — docs/api-contract.md mục 6 "Dịch vụ Kiểm tra dữ liệu".
// POST /validate/hoc-vien phải TÁI DÙNG đúng HocVienService.validateHocVien
// (cùng hàm với POST /hoc-vien và POST /hoc-vien/toi/kiem-tra-truoc-xac-nhan),
// công khai, KHÔNG BAO GIỜ ghi DB — test tập trung xác nhận đúng 3 điều đó,
// không lặp lại toàn bộ checklist validate (đã có ở hoc-vien-validation.util.spec.ts
// và hoc-vien.e2e-spec.ts).
describe('Dịch vụ Kiểm tra dữ liệu (e2e)', () => {
  let app: INestApplication;
  let donViFixture: Awaited<ReturnType<typeof taoDonViTest>>;

  const hocVienIds: string[] = [];
  const nguoiDungHocVienIds: string[] = [];

  function baseBody(overrides: Record<string, unknown> = {}) {
    const suf = uniqueSuffix();
    return {
      ho_ten: 'Lê Thị Kiểm Tra',
      so_dinh_danh_ca_nhan: soDinhDanhNgauNhien(),
      ngay_sinh: 20,
      thang_sinh: 8,
      nam_sinh: NAM_HOP_LE,
      noi_sinh_id: donViFixture.diaDanhTinh.id,
      phuong_xa_id: donViFixture.diaDanhXa.id,
      don_vi_cong_tac_id: donViFixture.donVi.id,
      so_dien_thoai_lien_he: '0914444444',
      email_lien_he: `validate-${suf}@test.local`,
      trinh_do_chuyen_mon: 'dai_hoc',
      chuyen_mon: ['Sư phạm Hóa'],
      ...overrides,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    donViFixture = await taoDonViTest('validate');
  });

  afterAll(async () => {
    if (hocVienIds.length > 0) {
      await prisma.hoc_vien.updateMany({
        where: { id: { in: hocVienIds } },
        data: { created_by: null },
      });
      await prisma.nguoi_dung.deleteMany({
        where: { id: { in: nguoiDungHocVienIds } },
      });
      await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    }
    await xoaDonViTest(
      [donViFixture.donVi.id],
      [donViFixture.diaDanhXa.id, donViFixture.diaDanhTinh.id],
    );
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /validate/hoc-vien', () => {
    it('công khai (không cần token) + hồ sơ hợp lệ -> 200, { loi: [], canh_bao: [] }', async () => {
      const res = await request(app.getHttpServer())
        .post('/validate/hoc-vien')
        .send(baseBody())
        .expect(200);

      expect(res.body).toEqual({ loi: [], canh_bao: [] });
    });

    it('dry-run tuyệt đối: KHÔNG tạo hoc_vien dù dữ liệu hợp lệ', async () => {
      const body = baseBody();
      await request(app.getHttpServer())
        .post('/validate/hoc-vien')
        .send(body)
        .expect(200);

      const existing = await prisma.hoc_vien.findUnique({
        where: { so_dinh_danh_ca_nhan: body.so_dinh_danh_ca_nhan },
      });
      expect(existing).toBeNull();
    });

    it('trùng số định danh cá nhân với hồ sơ đã có -> loi (không phải 409, không chặn request)', async () => {
      const dangKy = await request(app.getHttpServer())
        .post('/hoc-vien')
        .send(baseBody())
        .expect(201);
      hocVienIds.push(dangKy.body.hoc_vien_id);
      const nd = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: dangKy.body.ten_dang_nhap },
      });
      if (nd) nguoiDungHocVienIds.push(nd.id);

      const res = await request(app.getHttpServer())
        .post('/validate/hoc-vien')
        .send(
          baseBody({
            so_dinh_danh_ca_nhan: dangKy.body.ten_dang_nhap,
          }),
        )
        .expect(200);

      expect(
        res.body.loi.some((l: { field: string }) => l.field === 'so_dinh_danh_ca_nhan'),
      ).toBe(true);
    });

    it('họ tên viết thường -> canh_bao gợi ý viết hoa, KHÔNG chặn (loi rỗng)', async () => {
      const res = await request(app.getHttpServer())
        .post('/validate/hoc-vien')
        .send(baseBody({ ho_ten: 'lê thị không viết hoa' }))
        .expect(200);

      expect(res.body.loi).toEqual([]);
      expect(
        res.body.canh_bao.some((c: { field: string }) => c.field === 'ho_ten'),
      ).toBe(true);
    });

    it('mon_giang_day_id không tồn tại -> loi field mon_giang_day_id', async () => {
      const res = await request(app.getHttpServer())
        .post('/validate/hoc-vien')
        .send(
          baseBody({
            cap_giang_day: 'thpt',
            mon_giang_day_id: '00000000-0000-0000-0000-000000000000',
          }),
        )
        .expect(200);

      expect(
        res.body.loi.some(
          (l: { field: string }) => l.field === 'mon_giang_day_id',
        ),
      ).toBe(true);
    });

    it('thiếu field bắt buộc ở tầng DTO (ho_ten) -> 400 VALIDATION_ERROR (khác với loi[] nghiệp vụ)', async () => {
      const body = baseBody() as Record<string, unknown>;
      delete body.ho_ten;
      const res = await request(app.getHttpServer())
        .post('/validate/hoc-vien')
        .send(body)
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
