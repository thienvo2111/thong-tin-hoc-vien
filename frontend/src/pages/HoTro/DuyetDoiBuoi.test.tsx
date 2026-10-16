import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { db } from "@/test/mocks/db";
import { renderVoiRouter } from "@/test/testUtils";
import { datToken } from "@/auth/tokenStore";
import type {
  BuoiTomTat,
  DeNghiDuyet,
  LichTomTat,
  LuaChonDuyet,
} from "@/api/doiBuoi";
import { RequireQuanTri } from "@/auth/RequireQuanTri";
import HoTroLayout from "./HoTroLayout";
import DuyetDoiBuoi from "./DuyetDoiBuoi";

const GIO = 3600_000;

function lich(id: string, ten: string, gio = 48): LichTomTat {
  return {
    id,
    lop_id: `lop-${id}`,
    giai_doan_id: "gd-2",
    buoi_so: 1,
    thoi_gian_bat_dau: new Date(Date.now() + gio * GIO).toISOString(),
    lop: {
      khoa_id: "khoa-1",
      loai_lop: "truc_tiep",
      muc_nang_luc: "co_ban",
      trang_thai: "active",
      si_so_toi_da: 30,
      ten_lop: ten,
    },
  };
}

function tomTat(l: LichTomTat): BuoiTomTat {
  return {
    id: l.id,
    buoi_so: l.buoi_so,
    thoi_gian_bat_dau: l.thoi_gian_bat_dau,
    thoi_gian_ket_thuc: new Date(
      Date.parse(l.thoi_gian_bat_dau) + 3 * GIO,
    ).toISOString(),
    lop: { ten_lop: l.lop.ten_lop },
  };
}

function deNghi(over: Partial<DeNghiDuyet> = {}): DeNghiDuyet {
  return {
    id: "dn-1",
    trang_thai: "cho_duyet",
    lich_nguon_id: "ln-1",
    lich_de_nghi_id: "ld-1",
    lich_chot_id: null,
    ly_do: "Bận công tác đột xuất",
    tao_luc: "2026-10-10T01:00:00.000Z",
    ghi_chu_xu_ly: null,
    ly_do_huy: null,
    qua_han: false,
    thu_tu_hang: { k: 2, n: 3 },
    buoi_nguon: tomTat(lich("ln-1", "Lớp 01")),
    buoi_de_nghi: tomTat(lich("ld-1", "Lớp 02", 50)),
    buoi_chot: null,
    hoc_vien: {
      id: "hv-1",
      ho_ten: "Nguyễn Thị Lan",
      don_vi: "THPT Long Xuyên",
      cum: "Cụm An Giang",
    },
    si_so: 28,
    si_so_toi_da: 30,
    so_cho_duyet: 2,
    nguoi_xu_ly: null,
    ...over,
  };
}

function luaChon(
  id: string,
  ten: string,
  over: Partial<LuaChonDuyet> = {},
): LuaChonDuyet {
  return {
    lich: lich(id, ten, 50),
    thoi_gian_ket_thuc: new Date(Date.now() + 53 * GIO).toISOString(),
    diem_hoc: { ten: "THPT Long Xuyên", dia_chi: "1 Trần Hưng Đạo" },
    phong: "P201",
    dia_diem_hoac_link: null,
    si_so: 10,
    si_so_toi_da: 30,
    so_cho_duyet: 0,
    so_truoc: 0,
    duyet_duoc: true,
    da_du: false,
    ...over,
  };
}

const LUA_CHON: LuaChonDuyet[] = [
  luaChon("ld-1", "Lớp 02", { so_cho_duyet: 2, so_truoc: 1 }),
  luaChon("ld-2", "Lớp 03", { si_so: 30, duyet_duoc: false, da_du: true }),
  luaChon("ld-3", "Lớp 04", {
    si_so: 12,
    duyet_duoc: false,
    da_du: false,
    so_truoc: 3,
  }),
];

function datApi(ds: DeNghiDuyet[], dem = 0, quaHan: DeNghiDuyet[] = []) {
  server.use(
    http.get("/doi-buoi-hoc", ({ request }) =>
      HttpResponse.json(
        new URL(request.url).searchParams.get("qua_han") === "true"
          ? quaHan
          : ds,
      ),
    ),
    http.get("/doi-buoi-hoc/dem-cho-duyet", () =>
      HttpResponse.json({ cho_duyet: dem }),
    ),
    http.get("/doi-buoi-hoc/:id/lua-chon", () => HttpResponse.json(LUA_CHON)),
  );
}

function renderTrang(vaiTro: string) {
  datToken("token-gia-lap");
  db.nguoiDung.vai_tro = vaiTro;
  return renderVoiRouter(
    [{ path: "/ho-tro/doi-buoi", element: <DuyetDoiBuoi /> }],
    { initialEntries: ["/ho-tro/doi-buoi"] },
  );
}

async function moModalDuyet() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Duyệt" }));
  await screen.findByText("Chọn buổi chốt");
  return user;
}

describe("Màn duyệt đổi buổi", () => {
  it("tab Chờ duyệt hiện học viên, thứ tự k/n, sĩ số +n đang chờ, lý do", async () => {
    datApi([deNghi()]);
    renderTrang("ho_tro_hoc_vien");
    expect(await screen.findByText("Nguyễn Thị Lan")).toBeInTheDocument();
    expect(screen.getByText(/THPT Long Xuyên · Cụm An Giang/)).toBeInTheDocument();
    expect(screen.getByLabelText("Thứ tự gửi")).toHaveTextContent("2/3");
    expect(screen.getByLabelText("Sĩ số 28/30, 2 đang chờ")).toBeInTheDocument();
    expect(screen.getByText("28/30")).toHaveTextContent("28/30 · +2 chờ");
    expect(screen.getByText(/Bận công tác đột xuất/)).toBeInTheDocument();
  });

  it("thẻ chờ duyệt tách 2 khối Buổi gốc / Xin đổi sang, mỗi khối có lớp, buổi, thứ-ngày, giờ", async () => {
    datApi([deNghi()]);
    renderTrang("ho_tro_hoc_vien");
    const goc = await screen.findByRole("group", { name: "Buổi gốc" });
    const sang = screen.getByRole("group", { name: "Xin đổi sang" });
    for (const khoi of [goc, sang]) {
      expect(khoi).toHaveTextContent(/Buổi \d+/);
      expect(khoi).toHaveTextContent(/(Thứ [A-ZĐa-zăâêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹđ]+|Chủ nhật), \d{2}\/\d{2}\/\d{4}/);
      expect(khoi).toHaveTextContent(/\d{2}:\d{2}–\d{2}:\d{2}/);
    }
    expect(within(sang).getByLabelText("Sĩ số 28/30, 2 đang chờ")).toBeInTheDocument();
  });

  it("đề nghị quá hạn: khối Quá hạn riêng, có nhãn, không có nút Duyệt, vẫn có Từ chối", async () => {
    datApi([], 0, [deNghi({ qua_han: true })]);
    renderTrang("ho_tro_hoc_vien");
    const khoi = await screen.findByTestId("khoi-qua-han");
    expect(within(khoi).getByText(/Quá hạn \(1\)/)).toBeInTheDocument();
    expect(within(khoi).getByText("Quá hạn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Duyệt" })).toBeNull();
    expect(within(khoi).getByRole("button", { name: "Từ chối" })).toBeInTheDocument();
    expect(screen.getByText("Không có đề nghị nào đang chờ duyệt.")).toBeInTheDocument();
  });

  it("tab Chờ duyệt: danh sách chính không gửi qua_han, khối Quá hạn gửi qua_han=true", async () => {
    const urls: string[] = [];
    datApi([]);
    server.use(
      http.get("/doi-buoi-hoc", ({ request }) => {
        urls.push(request.url);
        const quaHan = new URL(request.url).searchParams.get("qua_han") === "true";
        return HttpResponse.json(quaHan ? [deNghi({ id: "dn-qh", qua_han: true })] : [deNghi()]);
      }),
    );
    renderTrang("ho_tro_hoc_vien");
    await screen.findByTestId("khoi-qua-han");
    expect(screen.getAllByTestId("de-nghi-cho-duyet")).toHaveLength(2);
    const chinh = urls.find((u) => !u.includes("qua_han"));
    expect(chinh).toContain("trang_thai=cho_duyet");
    expect(urls.some((u) => u.includes("trang_thai=cho_duyet") && u.includes("qua_han=true"))).toBe(true);
  });

  it("tab Chờ duyệt: chạm giới hạn 500 thì báo", async () => {
    datApi(Array.from({ length: 500 }, (_, i) => deNghi({ id: `dn-${i}` })));
    renderTrang("ho_tro_hoc_vien");
    // 500 thẻ render chậm khi chạy song song nhiều file → nới thời gian chờ.
    expect(
      await screen.findByText(
        /Chỉ hiển thị 500 đề nghị chờ duyệt gửi sớm nhất/,
        undefined,
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument();
  }, 30_000);

  it("hỗ trợ cụm: lựa chọn không duyệt được bị disabled kèm lý do; buổi đề nghị chọn sẵn", async () => {
    datApi([deNghi()]);
    renderTrang("ho_tro_hoc_vien");
    await moModalDuyet();
    const daDu = await screen.findByRole("radio", { name: /Lớp 03/ });
    expect(daDu).toBeDisabled();
    expect(daDu).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Đã đủ")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Lớp 04/ })).toBeDisabled();
    expect(screen.getByText("Giữ chỗ cho đề nghị gửi trước")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Lớp 02/ })).toBeChecked();
    expect(screen.queryByText(/Vượt/)).toBeNull();
  });

  it("quản trị: lựa chọn không duyệt được vẫn enabled, có cảnh báo Vượt", async () => {
    datApi([deNghi()]);
    renderTrang("quan_tri");
    await moModalDuyet();
    const daDu = await screen.findByRole("radio", { name: /Lớp 03/ });
    expect(daDu).toBeEnabled();
    expect(screen.getAllByText(/Vượt sĩ số \/ thứ tự/).length).toBe(2);
  });

  it("duyệt gửi lich_chot_id + ghi chú; cảnh báo hiện thành thông báo", async () => {
    datApi([deNghi()]);
    let body: unknown;
    server.use(
      http.post("/doi-buoi-hoc/:id/duyet", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          trang_thai: "da_duyet",
          canh_bao: ["Buổi chốt vượt sĩ số tối đa"],
        });
      }),
    );
    renderTrang("quan_tri");
    const user = await moModalDuyet();
    await user.click(await screen.findByRole("radio", { name: /Lớp 03/ }));
    await user.type(screen.getByLabelText(/Ghi chú/), "Đồng ý ngoại lệ");
    await user.click(screen.getByRole("button", { name: "Xác nhận duyệt" }));
    expect(
      await screen.findByText("Buổi chốt vượt sĩ số tối đa"),
    ).toBeInTheDocument();
    expect(body).toEqual({ lich_chot_id: "ld-2", ghi_chu: "Đồng ý ngoại lệ" });
  });

  it("duyệt gặp 409: hiện thông điệp của server", async () => {
    datApi([deNghi()]);
    server.use(
      http.post("/doi-buoi-hoc/:id/duyet", () =>
        HttpResponse.json(
          { error: { code: "CONFLICT", message: "Đề nghị đã được xử lý" } },
          { status: 409 },
        ),
      ),
    );
    renderTrang("ho_tro_hoc_vien");
    const user = await moModalDuyet();
    await user.click(await screen.findByRole("button", { name: "Xác nhận duyệt" }));
    expect(await screen.findByText("Đề nghị đã được xử lý")).toBeInTheDocument();
  });

  it("Từ chối: không ghi chú (hoặc <5 ký tự) thì nút gửi disabled", async () => {
    datApi([deNghi()]);
    renderTrang("ho_tro_hoc_vien");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Từ chối" }));
    const gui = await screen.findByRole("button", { name: "Gửi từ chối" });
    expect(gui).toBeDisabled();
    await user.type(screen.getByLabelText(/Ghi chú/), "abcd");
    expect(gui).toBeDisabled();
    await user.type(screen.getByLabelText(/Ghi chú/), "e");
    expect(gui).toBeEnabled();
  });

  it("tab Đã xử lý: Hủy duyệt chỉ hiện khi đã duyệt và buổi chốt/nguồn chưa bắt đầu", async () => {
    const chot = tomTat(lich("ld-1", "Lớp 02", 50));
    datApi([
      deNghi({ id: "dn-a", trang_thai: "da_duyet", buoi_chot: chot, nguoi_xu_ly: "Hỗ trợ 1" }),
      deNghi({
        id: "dn-b",
        trang_thai: "da_duyet",
        buoi_chot: chot,
        buoi_nguon: tomTat(lich("ln-9", "Lớp 09", -2)),
      }),
      deNghi({ id: "dn-c", trang_thai: "tu_choi", ghi_chu_xu_ly: "Không hợp lệ" }),
    ]);
    renderTrang("ho_tro_hoc_vien");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Đã xử lý" }));
    const dong = await screen.findAllByTestId("de-nghi-da-xu-ly");
    expect(dong).toHaveLength(3);
    expect(within(dong[0]).getByRole("button", { name: "Hủy duyệt" })).toBeInTheDocument();
    expect(within(dong[1]).queryByRole("button", { name: "Hủy duyệt" })).toBeNull();
    expect(within(dong[2]).queryByRole("button", { name: "Hủy duyệt" })).toBeNull();
    expect(screen.getByText(/Không hợp lệ/)).toBeInTheDocument();
  });

  it("Hủy duyệt thành công có canh_bao: hiện Lưu ý; 409 thì hiện thông điệp server", async () => {
    const chot = tomTat(lich("ld-1", "Lớp 02", 50));
    datApi([deNghi({ id: "dn-a", trang_thai: "da_duyet", buoi_chot: chot })]);
    let lan = 0;
    server.use(
      http.post("/doi-buoi-hoc/:id/huy-duyet", () => {
        lan += 1;
        if (lan === 1)
          return HttpResponse.json(
            { error: { code: "CONFLICT", message: "Buổi gốc đã đủ sĩ số 30/30 — không thể hủy duyệt" } },
            { status: 409 },
          );
        return HttpResponse.json({
          trang_thai: "da_huy",
          canh_bao: ["Buổi gốc đã đủ sĩ số 30/30 — hủy duyệt sẽ vượt sĩ số"],
        });
      }),
    );
    renderTrang("quan_tri");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Đã xử lý" }));
    await user.click(await screen.findByRole("button", { name: "Hủy duyệt" }));
    await user.type(screen.getByLabelText(/Ghi chú/), "Học viên xin ở lại");
    const xacNhan = screen.getByRole("button", { name: "Xác nhận hủy duyệt" });
    await user.click(xacNhan);
    expect(
      await screen.findByText("Buổi gốc đã đủ sĩ số 30/30 — không thể hủy duyệt"),
    ).toBeInTheDocument();
    await waitFor(() => expect(xacNhan).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Xác nhận hủy duyệt" }));
    await waitFor(() => expect(lan).toBe(2));
    // Thông báo canh_bao hiện sau khi danh sách refetch — nới chờ khi chạy song song nhiều file.
    expect(
      await screen.findByText("Buổi gốc đã đủ sĩ số 30/30 — hủy duyệt sẽ vượt sĩ số", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it("menu hỗ trợ có Đổi buổi + badge số chờ duyệt từ dem-cho-duyet", async () => {
    datApi([], 4);
    server.use(
      http.get("/ho-tro-hoc-vien/cum-cua-toi", () => HttpResponse.json([])),
    );
    datToken("token-gia-lap");
    db.nguoiDung.vai_tro = "ho_tro_hoc_vien";
    renderVoiRouter(
      [
        {
          element: <HoTroLayout />,
          children: [{ path: "/ho-tro/doi-buoi", element: <DuyetDoiBuoi /> }],
        },
      ],
      { initialEntries: ["/ho-tro/doi-buoi"] },
    );
    const nav = await screen.findByRole("navigation", { name: "Menu hỗ trợ" });
    await waitFor(() =>
      expect(
        within(nav).getByLabelText("4 đề nghị đổi buổi chờ duyệt"),
      ).toBeInTheDocument(),
    );
    expect(within(nav).getByText("Đổi buổi")).toBeInTheDocument();
  });
  it("tab Đã xử lý ghi rõ lý do hủy: học viên sửa / học viên tự hủy / hủy duyệt bởi ai", async () => {
    datApi([
      deNghi({ id: "s", trang_thai: "da_huy", ly_do_huy: "hoc_vien_sua", ghi_chu_xu_ly: "Học viên đã sửa (thay bằng đề nghị mới)" }),
      deNghi({ id: "h", trang_thai: "da_huy", ly_do_huy: "hoc_vien_huy", ghi_chu_xu_ly: "Học viên tự hủy" }),
      deNghi({ id: "d", trang_thai: "da_huy", ly_do_huy: "huy_duyet", nguoi_xu_ly: "Cán bộ B", ghi_chu_xu_ly: "Học viên xin ở lại" }),
    ]);
    renderTrang("quan_tri");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Đã xử lý" }));
    const dong = await screen.findAllByTestId("de-nghi-da-xu-ly");
    expect(dong[0]).toHaveTextContent("Học viên đã sửa (thay bằng đề nghị mới)");
    expect(dong[1]).toHaveTextContent("Học viên tự hủy");
    expect(dong[2]).toHaveTextContent("Hủy duyệt bởi Cán bộ B");
    expect(dong[2]).toHaveTextContent("Ghi chú: Học viên xin ở lại");
    // Ghi chú hệ thống tự đặt không lặp lại thành dòng "Ghi chú: …"
    expect(dong[0]).not.toHaveTextContent("Ghi chú:");
    expect(dong[1]).not.toHaveTextContent("Ghi chú:");
    for (const d of dong) expect(within(d).queryByText("Đã hủy")).toBeNull();
  });

  it("tab Đã xử lý gọi server với da_xu_ly=true và báo khi chạm giới hạn 500", async () => {
    let url = "";
    const dong = Array.from({ length: 500 }, (_, i) =>
      deNghi({ id: `dn-${i}`, trang_thai: "tu_choi" }),
    );
    datApi([]);
    server.use(
      http.get("/doi-buoi-hoc", ({ request }) => {
        if (!request.url.includes("da_xu_ly")) return HttpResponse.json([]);
        url = request.url;
        return HttpResponse.json(dong);
      }),
    );
    renderTrang("ho_tro_hoc_vien");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Đã xử lý" }));
    expect(
      await screen.findByText("Chỉ hiển thị 500 đề nghị xử lý gần nhất"),
    ).toBeInTheDocument();
    expect(url).toContain("da_xu_ly=true");
  });

  it("hỗ trợ cụm: buổi đề nghị không duyệt được -> không chọn sẵn, có gợi ý, nút xác nhận disabled", async () => {
    datApi([deNghi({ lich_de_nghi_id: "ld-2" })]);
    renderTrang("ho_tro_hoc_vien");
    await moModalDuyet();
    expect(
      await screen.findByText("Buổi đề nghị không duyệt được — chọn buổi khác"),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Lớp 02/ })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Xác nhận duyệt" })).toBeDisabled();
  });

  it("/admin/doi-buoi: truong không xem được trang, quan_tri xem được", async () => {
    datApi([deNghi()]);
    datToken("token-gia-lap");
    db.nguoiDung.vai_tro = "truong";
    renderVoiRouter(
      [
        {
          element: <RequireQuanTri />,
          children: [{ path: "/admin/doi-buoi", element: <DuyetDoiBuoi /> }],
        },
        { path: "/admin/tong-quan", element: <div>Tổng quan</div> },
      ],
      { initialEntries: ["/admin/doi-buoi"] },
    );
    expect(await screen.findByText("Tổng quan")).toBeInTheDocument();
    expect(screen.queryByText("Đổi buổi học")).toBeNull();
  });
});
