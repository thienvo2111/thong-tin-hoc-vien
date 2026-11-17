// PROTOTYPE — ticket #48 (map #43): "Màn trường khai Hồ sơ đơn vị và hợp đồng nên trông thế nào để nhập liệu đơn giản?"
// 3 phương án trên route tạm /prototype/khai-hop-dong, chuyển bằng ?variant=A|B|C. Dữ liệu giả, không gọi API.
// Chỉ có ở dev (router gate import.meta.env.DEV). Không merge vào main — giữ trên nhánh prototype/khai-hop-dong.
import { useSearchParams } from 'react-router-dom';
import { PrototypeSwitcher } from '@/components/PrototypeSwitcher';
import PhuongAnA, { tenA } from './PhuongAnA';
import PhuongAnB, { tenB } from './PhuongAnB';
import PhuongAnC, { tenC } from './PhuongAnC';
import { useKhaiHopDong } from './trangThai';

const PHUONG_AN = { A: [PhuongAnA, tenA], B: [PhuongAnB, tenB], C: [PhuongAnC, tenC] } as const;
type Khoa = keyof typeof PHUONG_AN;

export default function PrototypeKhaiHopDong() {
  const [params] = useSearchParams();
  const v = (params.get('variant') ?? 'A') as Khoa;
  const khoa: Khoa = v in PHUONG_AN ? v : 'A';
  const k = useKhaiHopDong(); // giữ trạng thái khi đổi phương án → so sánh cùng dữ liệu
  const [Comp] = PHUONG_AN[khoa];
  return (
    <>
      <Comp k={k} />
      <PrototypeSwitcher variants={Object.keys(PHUONG_AN)} names={Object.fromEntries(Object.entries(PHUONG_AN).map(([key, [, ten]]) => [key, ten]))} current={khoa} />
    </>
  );
}
