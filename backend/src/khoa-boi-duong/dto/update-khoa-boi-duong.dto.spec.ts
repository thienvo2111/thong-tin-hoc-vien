import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateKhoaBoiDuongDto } from './update-khoa-boi-duong.dto';

// ADR 0012: so_buoi_hoc_bu_toi_da khớp CHECK chk_khoa_so_buoi_hoc_bu (0–50).
async function loiHocBu(v: unknown) {
  const dto = plainToInstance(UpdateKhoaBoiDuongDto, { so_buoi_hoc_bu_toi_da: v });
  const loi = await validate(dto);
  return loi.filter((e) => e.property === 'so_buoi_hoc_bu_toi_da');
}

describe('UpdateKhoaBoiDuongDto — so_buoi_hoc_bu_toi_da', () => {
  it.each([0, 1, 50])('%s hợp lệ', async (v) => {
    expect(await loiHocBu(v)).toHaveLength(0);
  });

  it.each([-1, 51, 1.5, '3'])('%s bị từ chối', async (v) => {
    expect(await loiHocBu(v)).toHaveLength(1);
  });

  it('không gửi -> hợp lệ (tùy chọn)', async () => {
    const loi = await validate(plainToInstance(UpdateKhoaBoiDuongDto, {}));
    expect(loi.filter((e) => e.property === 'so_buoi_hoc_bu_toi_da')).toHaveLength(0);
  });
});
