import { Container, Tabs, Title } from '@mantine/core';
import { DIEM_HOC_HO_TRO_GV } from '@/api/diemHoc';
import { GIANG_VIEN_HO_TRO_GV } from '@/api/giangVien';
import { DanhMucDiemHoc } from '@/pages/Admin/AdminDiemHoc';
import { DanhMucGiangVien } from '@/pages/Admin/AdminGiangVien';

/** Danh mục điểm học + giảng viên cho người hỗ trợ GV (ADR 0004 G12, issue #16): tạo/sửa — ngưng/gộp trùng
 * là việc của Quản trị. Tìm trước khi tạo để tránh trùng (SĐT/email giảng viên là duy nhất). */
export default function HoTroGvDanhMuc() {
  return (
    <Container size="xl" pt="lg">
      <Title order={3} mb="sm">
        Danh mục
      </Title>
      <Tabs defaultValue="diem-hoc">
        <Tabs.List>
          <Tabs.Tab value="diem-hoc">Điểm học</Tabs.Tab>
          <Tabs.Tab value="giang-vien">Giảng viên</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="diem-hoc">
          <DanhMucDiemHoc base={DIEM_HOC_HO_TRO_GV} choNgung={false} />
        </Tabs.Panel>
        <Tabs.Panel value="giang-vien">
          <DanhMucGiangVien base={GIANG_VIEN_HO_TRO_GV} quanTri={false} />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
