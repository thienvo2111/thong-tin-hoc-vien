import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { db } from "@/test/mocks/db";
import { renderVoiRouter } from "@/test/testUtils";
import { datToken } from "@/auth/tokenStore";
import AdminKhoaChiTiet from "./AdminKhoaChiTiet";

// Quản trị xem/xuất danh sách + sĩ số theo buổi (cùng logic ADR 0008 L7 của người
// hỗ trợ, phạm vi toàn hệ thống) qua /lop/:id/buoi — dùng mẫu buổi của lớp Zoom.
const BUOI_1 = "GĐ1 – Buổi 1 · 20/10 19:00 · 2 HV";
const BUOI_2 = "GĐ1 – Buổi 2 · 27/10 19:00 · 2 HV";

function giaLapApiQuanTri() {
  const goi: string[] = [];
  server.use(
    http.get("/lop/:lopId/buoi", ({ request }) => {
      goi.push(new URL(request.url).pathname);
      return HttpResponse.json(db.hoTroBuoiLop["lop-zoom-1"]);
    }),
    http.get("/lop/:lopId/buoi/xuat", ({ request }) => {
      const url = new URL(request.url);
      goi.push(url.pathname + url.search);
      return new HttpResponse(new Blob(["xlsx"]));
    }),
    http.get("/lop/:lopId/buoi/:lichId/hoc-vien", ({ params, request }) => {
      goi.push(new URL(request.url).pathname);
      return HttpResponse.json(db.hoTroDanhSachBuoi[params.lichId as string]);
    }),
  );
  return goi;
}

async function moTheoBuoi(vaiTro = "quan_tri") {
  datToken("token-gia-lap");
  db.nguoiDung.vai_tro = vaiTro;
  const user = userEvent.setup();
  renderVoiRouter(
    [{ path: "/admin/khoa-boi-duong/:id", element: <AdminKhoaChiTiet /> }],
    {
      initialEntries: ["/admin/khoa-boi-duong/khoa-1"],
    },
  );
  const dong = (await screen.findByText("Lớp 01 – Nhóm cơ bản A")).closest(
    "tr",
  ) as HTMLElement;
  return { user, dong };
}

describe("Admin — danh sách theo buổi của lớp", () => {
  it('nút "Theo buổi" mở modal: liệt kê buổi kèm sĩ số, gọi API /lop/:id/buoi (không qua /ho-tro-hoc-vien)', async () => {
    const goi = giaLapApiQuanTri();
    const { user, dong } = await moTheoBuoi();
    await user.click(within(dong).getByRole("button", { name: "Theo buổi" }));
    const modal = await screen.findByRole("dialog", {
      name: /Danh sách theo buổi — Lớp 01/,
    });
    await user.click(
      await within(modal).findByRole("textbox", { name: "Buổi học" }),
    );
    expect(
      await screen.findByRole("option", { name: BUOI_1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: BUOI_2 })).toBeInTheDocument();
    expect(goi[0]).toBe("/lop/lop-1/buoi");
  });

  it("buổi có đổi buổi: người đổi vào trong DS (link sang /admin/hoc-vien), người đổi ra ở mục riêng", async () => {
    giaLapApiQuanTri();
    const { user, dong } = await moTheoBuoi();
    await user.click(within(dong).getByRole("button", { name: "Theo buổi" }));
    await user.click(await screen.findByRole("textbox", { name: "Buổi học" }));
    await user.click(await screen.findByRole("option", { name: BUOI_1 }));
    const vao = await screen.findByRole("link", { name: "Đặng Văn Vào" });
    expect(vao).toHaveAttribute("href", "/admin/hoc-vien/hv-doi-vao");
    expect(screen.getByText("1 đổi vào")).toBeInTheDocument();
    expect(screen.getByText("1 đổi ra")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Đã chuyển sang lớp khác (không học buổi này)",
      }),
    ).toBeInTheDocument();
  });

  it("Xuất buổi này -> /lop/:id/buoi/xuat?lich_id; Xuất tất cả buổi -> không lich_id", async () => {
    const goi = giaLapApiQuanTri();
    const { user, dong } = await moTheoBuoi();
    await user.click(within(dong).getByRole("button", { name: "Theo buổi" }));
    await user.click(await screen.findByRole("textbox", { name: "Buổi học" }));
    await user.click(await screen.findByRole("option", { name: BUOI_2 }));
    await user.click(screen.getByRole("button", { name: "Xuất buổi này" }));
    await waitFor(() =>
      expect(goi).toContain("/lop/lop-1/buoi/xuat?lich_id=lich-zoom-2"),
    );
    await user.click(screen.getByRole("button", { name: "Xuất tất cả buổi" }));
    await waitFor(() => expect(goi).toContain("/lop/lop-1/buoi/xuat"));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });

  it('vai trò không phải Quản trị → không có nút "Theo buổi"', async () => {
    await moTheoBuoi("truong");
    expect(
      screen.queryByRole("button", { name: "Theo buổi" }),
    ).not.toBeInTheDocument();
  });
});
