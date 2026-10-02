import {
  getMailTransporter,
  laDiaChiKhongGiaoDuoc,
  resetMailTransporterForTest,
} from './mailer.util';

// Yêu cầu: SMTP thật KHÔNG BAO GIỜ gửi tới tên miền dành riêng (RFC 2606/
// 6761) — chặn trước khi mở kết nối SMTP. Địa chỉ thật vẫn đi tiếp.
describe('laDiaChiKhongGiaoDuoc', () => {
  it.each([
    'e2e-truong-65d11388@test.local',
    'a@b.test',
    'x@example.example',
    'y@foo.invalid',
    'z@dev.localhost',
    '  HOA@TRUONG.LOCAL  ',
    'Tên <a@b.local>',
  ])('%s -> chặn', (email) => {
    expect(laDiaChiKhongGiaoDuoc(email)).toBe(true);
  });

  it.each([
    'thien.vpt@gmail.com',
    'boiduongnls@hcmue.edu.vn',
    'a@localtest.vn',
    'a@test.com',
    '',
  ])('%s -> cho qua', (email) => {
    expect(laDiaChiKhongGiaoDuoc(email)).toBe(false);
  });
});

describe('getMailTransporter — nhánh SMTP thật', () => {
  const cu = { host: process.env.SMTP_HOST, port: process.env.SMTP_PORT };

  beforeEach(() => {
    // Không có gì lắng nghe cổng 1 -> địa chỉ hợp lệ sẽ lỗi ECONNREFUSED,
    // chứng minh bộ chặn chỉ chặn tên miền dành riêng.
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = '1';
    resetMailTransporterForTest();
  });

  afterAll(() => {
    if (cu.host === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = cu.host;
    if (cu.port === undefined) delete process.env.SMTP_PORT;
    else process.env.SMTP_PORT = cu.port;
    resetMailTransporterForTest();
  });

  it('người nhận .local -> bị chặn trước khi kết nối', async () => {
    const { transporter } = await getMailTransporter();
    await expect(
      transporter.sendMail({ from: 'x@hcmue.edu.vn', to: 'a@test.local' }),
    ).rejects.toThrow('tên miền dành riêng');
  });

  it('nhiều người nhận, chỉ 1 địa chỉ dành riêng -> vẫn chặn cả thư', async () => {
    const { transporter } = await getMailTransporter();
    await expect(
      transporter.sendMail({
        from: 'x@hcmue.edu.vn',
        to: ['thien.vpt@gmail.com', { name: 'B', address: 'b@x.test' }],
      }),
    ).rejects.toThrow('b@x.test');
  });

  it('địa chỉ thật -> đi tiếp tới bước kết nối SMTP', async () => {
    const { transporter } = await getMailTransporter();
    await expect(
      transporter.sendMail({
        from: 'x@hcmue.edu.vn',
        to: 'thien.vpt@gmail.com',
      }),
    ).rejects.toThrow(/ECONNREFUSED/);
  });
});
