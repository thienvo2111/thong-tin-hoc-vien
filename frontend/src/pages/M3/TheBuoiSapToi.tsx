import { Card, Stack, Text } from "@mantine/core";
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
  const ds = buoiSapToi(khoaHoc);
  if (ds.length === 0) return null;
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="sm">
        <Text fw={700} size="sm">
          Buổi học sắp tới
        </Text>
        {ds.map(({ b, lop, thucDia }) => (
          <Stack key={b.id} gap={2}>
            <Text size="sm" fw={600}>
              {dinhDangNgay(b.thoi_gian_bat_dau)} ·{" "}
              {dinhDangGio(b.thoi_gian_bat_dau)}–
              {dinhDangGio(b.thoi_gian_ket_thuc)}
            </Text>
            <Text size="sm">
              {lop} · Buổi {b.buoi_so}
            </Text>
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
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
