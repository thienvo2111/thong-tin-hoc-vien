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

// ADR 0014: 3 nấc chuyên cần.
describe('UpdateKhoaBoiDuongDto — che_do_chuyen_can', () => {
  const loi = async (v: unknown) =>
    (await validate(plainToInstance(UpdateKhoaBoiDuongDto, { che_do_chuyen_can: v }))).filter(
      (e) => e.property === 'che_do_chuyen_can',
    );

  it.each(['theo_lop_hien_tai', 'cong_nhan_cung_muc', 'cong_nhan_lop_cu'])('%s hợp lệ', async (v) => {
    expect(await loi(v)).toHaveLength(0);
  });

  it.each(['khong_co', 'cung_muc', 1])('%s bị từ chối', async (v) => {
    expect(await loi(v)).toHaveLength(1);
  });
});
