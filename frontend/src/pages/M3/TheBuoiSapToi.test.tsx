import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MantineProvider } from "@mantine/core";
import { taoKhoaHocToiMau } from "@/test/mocks/db";
import type { KhoaHocDangKy } from "@/api/types";
import { TheBuoiSapToi } from "./TheBuoiSapToi";

const GIO = 3600_000;

/** Khóa mẫu với 1 buổi bắt đầu sau `batDauSauMs` (âm = đã bắt đầu), khóa bật đổi buổi `n` lượt. */
function khoaVoiBuoi(
  n: number,
  batDauSauMs: number,
  them: Record<string, unknown> = {},
): KhoaHocDangKy[] {
  const dk = taoKhoaHocToiMau()[0];
  const gd = dk.giai_doan[1];
  const bd = Date.now() + batDauSauMs;
  gd.lop!.lich_hoc = [
    {
      ...gd.lop!.lich_hoc[0],
      id: "lh-test",
      thoi_gian_bat_dau: new Date(bd).toISOString(),
      thoi_gian_ket_thuc: new Date(bd + 3 * GIO).toISOString(),
      ...them,
    },
  ];
  dk.khoa = { ...dk.khoa, so_buoi_doi_toi_da: n };
  return [dk];
}

function renderThe(khoaHoc: KhoaHocDangKy[]) {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <TheBuoiSapToi khoaHoc={khoaHoc} />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("TheBuoiSapToi — link đổi buổi", () => {
  it("khóa tắt đổi buổi (0 lượt) → không có link", () => {
    renderThe(khoaVoiBuoi(0, 24 * GIO));
    expect(screen.getByText(/Buổi 1/)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Không tham gia được buổi này?" }),
    ).not.toBeInTheDocument();
  });

  it("khóa 2 lượt + buổi chưa bắt đầu → link đúng href", () => {
    renderThe(khoaVoiBuoi(2, 24 * GIO));
    expect(
      screen.getByRole("link", { name: "Không tham gia được buổi này?" }),
    ).toHaveAttribute("href", "/de-nghi-doi-buoi?khoa=khoa-1&lich=lh-test");
  });

  it("buổi đã bắt đầu (chưa kết thúc) → không có link", () => {
    renderThe(khoaVoiBuoi(2, -1 * GIO));
    expect(screen.getByText(/Buổi 1/)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Không tham gia được buổi này?" }),
    ).not.toBeInTheDocument();
  });

  it("buổi đã đổi → nhãn Đã đổi buổi + tên lớp chốt, link Đổi lại về buổi gốc", () => {
    renderThe(
      khoaVoiBuoi(2, 24 * GIO, {
        da_doi_buoi: true,
        lich_goc_id: "lh-goc",
        lop_goc_ten: "Lớp 01",
        lop_chot_ten: "Lớp 05",
      }),
    );
    expect(screen.getByText("Đã đổi buổi")).toBeInTheDocument();
    expect(screen.getByText(/Lớp 05/)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Không tham gia được buổi này?" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Muốn đổi lại buổi này?" }).getAttribute("href")).toMatch(
      /^\/de-nghi-doi-buoi\?khoa=.+&lich=lh-goc$/,
    );
  });
});
