import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import { Link } from "react-router-dom";
import type { KhoaHocDangKy } from "@/api/types";
import { dinhDangGio, dinhDangNgay } from "@/lib/ngay";

const BAY_NGAY_MS = 7 * 24 * 3600 * 1000;

/** Các buổi chưa kết thúc trong 7 ngày tới, sớm nhất trước (tối đa 3). */
function buoiSapToi(khoaHoc: KhoaHocDangKy[] | undefined, bayGio = Date.now()) {
  const ds = (khoaHoc ?? []).flatMap((dk) =>
    dk.giai_doan.flatMap((gd) =>
      (gd.lop?.lich_hoc ?? []).map((b) => ({
        b,
        lop: gd.lop!.ten_lop,
        thucDia: gd.thuc_dia ?? [],
        khoaId: dk.khoa_id,
        coDoiBuoi: (dk.khoa?.so_buoi_doi_toi_da ?? 0) > 0,
      })),
    ),
  );
  return ds
    .filter(
      ({ b }) =>
        Date.parse(b.thoi_gian_ket_thuc) > bayGio &&
        Date.parse(b.thoi_gian_bat_dau) <= bayGio + BAY_NGAY_MS,
    )
    .sort(
      (x, y) =>
        Date.parse(x.b.thoi_gian_bat_dau) - Date.parse(y.b.thoi_gian_bat_dau),
    )
    .slice(0, 3);
}

/** Thẻ "Buổi học sắp tới" ở trang chủ học viên (ADR 0004 §6.5, issue #21). */
export function TheBuoiSapToi({
  khoaHoc,
}: {
  khoaHoc: KhoaHocDangKy[] | undefined;
}) {
  const bayGio = Date.now();
  const ds = buoiSapToi(khoaHoc, bayGio);
  if (ds.length === 0) return null;
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="sm">
        <Text fw={700} size="sm">
          Buổi học sắp tới
        </Text>
        {ds.map(({ b, lop, thucDia, khoaId, coDoiBuoi }) => (
          <Stack key={b.id} gap={2}>
            <Text size="sm" fw={600}>
              {dinhDangNgay(b.thoi_gian_bat_dau)} ·{" "}
              {dinhDangGio(b.thoi_gian_bat_dau)}–
              {dinhDangGio(b.thoi_gian_ket_thuc)}
            </Text>
            <Group gap="xs">
              <Text size="sm">
                {lop} · Buổi {b.buoi_so}
              </Text>
              {b.da_doi_buoi && (
                <Badge size="sm" variant="light">
                  Đã đổi buổi
                </Badge>
              )}
            </Group>
            {b.da_doi_buoi && b.lop_chot_ten && (
              <Text size="sm" c="dimmed">
                Học tại {b.lop_chot_ten}
              </Text>
            )}
            {b.diem_hoc ? (
              <Text size="sm" c="dimmed">
                {b.diem_hoc.ten}
                {b.phong ? ` · phòng ${b.phong}` : ""} — {b.diem_hoc.dia_chi}
              </Text>
            ) : (
              b.dia_diem_hoac_link && (
                <Text size="sm" c="dimmed" style={{ wordBreak: "break-all" }}>
                  {b.dia_diem_hoac_link}
                </Text>
              )
            )}
            {thucDia.map((t) => (
              <Text key={t.so_dien_thoai} size="sm" c="dimmed">
                Hỗ trợ tại điểm học: {t.ho_ten} — {t.so_dien_thoai}
              </Text>
            ))}
            {/* D12: đã có điểm danh (Zoom mở trước giờ) thì không đổi được nữa. */}
            {coDoiBuoi &&
              !b.da_doi_buoi &&
              b.trang_thai_diem_danh == null &&
              Date.parse(b.thoi_gian_bat_dau) > bayGio && (
                <Text
                  component={Link}
                  to={`/de-nghi-doi-buoi?khoa=${khoaId}&lich=${b.id}`}
                  size="xs"
                  c="dimmed"
                  td="underline"
                >
                  Không tham gia được buổi này?
                </Text>
              )}
            {coDoiBuoi &&
              b.da_doi_buoi &&
              b.lich_goc_id &&
              b.trang_thai_diem_danh == null &&
              Date.parse(b.thoi_gian_bat_dau) > bayGio && (
                <Text
                  component={Link}
                  to={`/de-nghi-doi-buoi?khoa=${khoaId}&lich=${b.lich_goc_id}`}
                  size="xs"
                  c="dimmed"
                  td="underline"
                >
                  Muốn đổi lại buổi này?
                </Text>
              )}
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
