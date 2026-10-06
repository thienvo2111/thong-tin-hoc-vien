import { Container } from '@mantine/core';
import { AdminPageHeader } from './AdminPageHeader';
import { BangKiemEditor } from './BangKiemEditor';

/** Bộ mục bảng kiểm mặc định (ADR 0004 G5b, issue #17) — khóa chưa tùy chỉnh dùng bộ này. */
export default function AdminBangKiem() {
  return (
    <>
      <AdminPageHeader title="Bảng kiểm chuẩn bị — bộ mặc định" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <BangKiemEditor khoaId={null} />
      </Container>
    </>
  );
}
