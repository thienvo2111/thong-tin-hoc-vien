import { Alert } from '@mantine/core';

/** ADR 0005 §9 (issue #28): cảnh báo vận hành — buổi Zoom sắp diễn ra chưa có link (API chỉ trả cho quan_tri). */
export function CanhBaoZoomThieuLink({ soBuoi }: { soBuoi: number | undefined }) {
  if (!soBuoi) return null;
  return (
    <Alert color="yellow" variant="light" title={`${soBuoi} buổi Zoom sắp diễn ra chưa có link`}>
      Nhập link Zoom cho các buổi này trước giờ học. Buổi chưa có link thì học viên không bấm được "Điểm danh &amp;
      vào Zoom" và hệ thống không tự chốt vắng.
    </Alert>
  );
}
