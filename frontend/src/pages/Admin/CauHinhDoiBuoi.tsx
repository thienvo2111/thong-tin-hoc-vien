import { useState } from "react";
import { Button, Group, NumberInput, Paper } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useCapNhatKhoa } from "@/api/khoaBoiDuong";
import type { KhoaBoiDuong } from "@/api/types";
import { thongDiepLoiChung } from "@/lib/loiApi";

/** ADR 0007: số buổi tối đa học viên được đề nghị đổi (0 = tắt) — chỉ quan_tri. */
export function CauHinhDoiBuoi({ khoa }: { khoa: KhoaBoiDuong }) {
  const capNhat = useCapNhatKhoa(khoa.id);
  const [soBuoi, setSoBuoi] = useState<number | string>(
    khoa.so_buoi_doi_toi_da,
  );

  // Khoảng khớp UpdateKhoaBoiDuongDto + CHECK trong DB.
  const hopLe =
    typeof soBuoi === "number" &&
    Number.isInteger(soBuoi) &&
    soBuoi >= 0 &&
    soBuoi <= 50;

  function luu() {
    if (typeof soBuoi !== "number") return;
    capNhat.mutate(
      { so_buoi_doi_toi_da: soBuoi },
      {
        onSuccess: (k) =>
          notifications.show({
            color: "green",
            message:
              k.so_buoi_doi_toi_da > 0
                ? `Học viên được đề nghị đổi tối đa ${k.so_buoi_doi_toi_da} buổi`
                : "Đã tắt đề nghị đổi buổi",
          }),
        onError: (err) =>
          notifications.show({ color: "red", message: thongDiepLoiChung(err) }),
      },
    );
  }

  return (
    <Paper withBorder radius={14} p="md">
      <Group align="flex-end" gap="sm">
        <NumberInput
          label="Số buổi tối đa học viên được đề nghị đổi (0 = tắt)"
          description="Học viên đổi sang buổi tương đương của lớp khác, chờ người hỗ trợ duyệt."
          min={0}
          max={50}
          allowDecimal={false}
          allowNegative={false}
          value={soBuoi}
          onChange={setSoBuoi}
          error={hopLe ? undefined : "Nhập số nguyên từ 0 đến 50"}
          w={340}
        />
        <Button
          onClick={luu}
          loading={capNhat.isPending}
          disabled={!hopLe || soBuoi === khoa.so_buoi_doi_toi_da}
        >
          Lưu số buổi đổi
        </Button>
      </Group>
    </Paper>
  );
}
