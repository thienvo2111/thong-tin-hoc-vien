import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GuiEmailLichDayDto } from './email-lich-day.dto';

// ADR 0009: lô gửi 1–200 giảng viên, uuid, không trùng.
const U = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const loi = (giang_vien_ids: unknown) =>
  validate(plainToInstance(GuiEmailLichDayDto, { giang_vien_ids }));

describe('GuiEmailLichDayDto', () => {
  it('1 uuid -> hợp lệ', async () => {
    expect(await loi([U(1)])).toHaveLength(0);
  });

  it('mảng rỗng -> lỗi', async () => {
    expect(await loi([])).not.toHaveLength(0);
  });

  it('quá 200 phần tử -> lỗi', async () => {
    expect(
      await loi(Array.from({ length: 201 }, (_, i) => U(i))),
    ).not.toHaveLength(0);
  });

  it('không phải uuid -> lỗi', async () => {
    expect(await loi(['x'])).not.toHaveLength(0);
  });

  it('uuid trùng -> lỗi', async () => {
    expect(await loi([U(1), U(1)])).not.toHaveLength(0);
  });
});
