import type { ReactNode } from 'react';
import { Anchor, Badge, Box, Button, Center, Container, Divider, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { capMaSso, useHoSoToi, useKhoaHocToi, type SsoTarget } from '@/api/hocVien';
import { useCauHinhTrienKhai } from '@/content/trienKhai';
import { BaiKhaoSat } from '@/components/BaiKhaoSat';
import { useTinhTrangKhaoSat, type TinhTrangBaiKhaoSat } from '@/api/ketQuaKhaoSat';
import { nhanMucKetQua } from '@/lib/trangThaiKhaoSat';
import type {
  CumHocVien,
  GiaiDoanCuaToi,
  KhoaHocDangKy,
  LichHocLopToi,
  MucNangLuc,
  TrangThaiDiemDanh,
  VaiTroNhanSuLop,
} from '@/api/types';
import { dinhDangNgay, dinhDangNgayGio } from '@/lib/ngay';
import { chuanHoaLienKet } from '@/lib/lienKet';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { StatusBanner } from '@/components/StatusBanner';
import { nhanMucNangLuc } from '@/lib/mucNangLuc';
import { ChonMucLopHoc } from './ChonMucLopHoc';
import { CanhBaoDiemDanhZoom, NhanDiemDanhZoom, NutDiemDanhZoom, canNhacCungNgay } from './DiemDanhZoom';

// T12 (mo-rong-nls-an-giang.md, 2026-09-30) — điểm danh nhập qua IMPORT EXCEL, không có giao diện
// chấm tay. null (chưa điểm danh) không hiện badge nào — tránh gây nhầm học viên nghĩ là "vắng".
const NHAN_DIEM_DANH: Record<TrangThaiDiemDanh, string> = {
  co_mat: 'Có mặt',
  vang: 'Vắng',
  vang_co_phep: 'Vắng có phép',
};

const MAU_DIEM_DANH: Record<TrangThaiDiemDanh, string> = {
  co_mat: 'green',
  vang: 'red',
  vang_co_phep: 'yellow',
};

const NHAN_VAI_TRO_NHAN_SU: Record<VaiTroNhanSuLop, string> = {
  giang_vien: 'Giảng viên',
  ho_tro: 'Hỗ trợ',
};

const NHAN_HINH_THUC: Record<string, string> = {
  truc_tiep: 'Trực tiếp',
  truc_tuyen: 'Trực tuyến',
  danh_gia: 'Đánh giá',
  khac: 'Khác',
};

const MAU_HINH_THUC: Record<string, string> = {
  truc_tiep: 'green',
  truc_tuyen: 'blue',
  danh_gia: 'orange',
  khac: 'gray',
};

/** M7 — Thông tin lớp học của học viên: lịch học, địa điểm/link, kết quả đánh giá đầu vào/đầu ra. */
export default function ThongTinLopHoc() {
  const { data, isLoading, isError, error } = useKhoaHocToi();
  // Kết quả bài trên hệ thống khảo sát (2026-10-05) — dùng khi quản trị chưa chốt mức của khóa.
  const { data: tinhTrang } = useTinhTrangKhaoSat();
  const { cauHinh, daTai: daTaiCauHinh } = useCauHinhTrienKhai({ loai: 'cua_toi' });
  // Kênh trang khảo sát: giai đoạn "Đánh giá" làm bài qua SSO thay cho link tĩnh (2026-10-05).
  // Nhân viên (2026-10-07): khảo sát chưa triển khai -> không hiện nút làm bài.
  const { data: hoSo } = useHoSoToi();
  const coKhaoSat = daTaiCauHinh && hoSo?.doi_tuong !== 'nhan_vien';
  const baiTheoGiaiDoan = {
    dauVao: coKhaoSat && cauHinh.kenhDanhGia === 'sso' ? (['khao-sat', 'danh-gia'] as SsoTarget[]) : null,
    dauRa: coKhaoSat && cauHinh.khaoSatDauRaMo ? (['dau-ra'] as SsoTarget[]) : null,
  };

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Title order={1} size="h2">
          Thông tin lớp học
        </Title>

        {isLoading && (
          <Center py="xl">
            <Loader />
          </Center>
        )}

        {isError && <StatusBanner loai="error">{thongDiepLoiChung(error)}</StatusBanner>}

        {data && data.length === 0 && (
          <StatusBanner loai="info">Thầy/Cô chưa được ghi danh vào khóa bồi dưỡng nào.</StatusBanner>
        )}

        {data?.map((dangKy) => (
          <KhoiKhoaHoc
            key={dangKy.id}
            dangKy={dangKy}
            baiDauVao={tinhTrang?.find((t) => t.loai === 'danh-gia')}
            baiDauRa={tinhTrang?.find((t) => t.loai === 'dau-ra')}
            tinhTrang={tinhTrang}
            baiTheoGiaiDoan={baiTheoGiaiDoan}
          />
        ))}
      </Stack>
    </Container>
  );
}

function KhoiKhoaHoc({
  dangKy,
  baiDauVao,
  baiDauRa,
  tinhTrang,
  baiTheoGiaiDoan,
}: {
  dangKy: KhoaHocDangKy;
  baiDauVao?: TinhTrangBaiKhaoSat;
  baiDauRa?: TinhTrangBaiKhaoSat;
  tinhTrang?: TinhTrangBaiKhaoSat[];
  baiTheoGiaiDoan: { dauVao: SsoTarget[] | null; dauRa: SsoTarget[] | null };
}) {
  const { khoa, cum, giai_doan, muc_dau_vao, muc_dau_ra } = dangKy;
  const chuaCoLopNao = giai_doan.every((gd) => !gd.lop);
  // Giai đoạn "Đánh giá" sớm nhất = đầu vào, các giai đoạn "Đánh giá" sau = đầu ra.
  const thuTuDanhGia = giai_doan.filter((g) => g.hinh_thuc === 'danh_gia').map((g) => g.thu_tu);
  const thuTuDauVao = thuTuDanhGia.length > 0 ? Math.min(...thuTuDanhGia) : null;
  // Kết quả đầu ra gắn vào giai đoạn đánh giá đầu ra cuối cùng (tránh lặp khi có nhiều giai đoạn).
  const thuTuDauRa = thuTuDanhGia.length > 1 ? Math.max(...thuTuDanhGia) : null;
  const baiCuaGiaiDoan = (gd: GiaiDoanCuaToi): SsoTarget[] | null => {
    if (gd.hinh_thuc !== 'danh_gia' || gd.lop) return null;
    return gd.thu_tu === thuTuDauVao ? baiTheoGiaiDoan.dauVao : baiTheoGiaiDoan.dauRa;
  };

  // 2026-10-08: kết quả đánh giá hiện ngay trong thẻ giai đoạn tương ứng (đầu vào kèm điều chỉnh mức).
  const ketQuaDauVao = (
    <Stack gap="xs">
      <DongKetQua nhan="Đầu vào" mucChot={muc_dau_vao} bai={baiDauVao} />
      <ChonMucLopHoc dangKy={dangKy} />
    </Stack>
  );
  const ketQuaDauRa = <DongKetQua nhan="Đầu ra" mucChot={muc_dau_ra} bai={baiDauRa} />;
  const ketQuaCuaGiaiDoan = (gd: GiaiDoanCuaToi): ReactNode => {
    if (gd.thu_tu === thuTuDauVao) return <KhuKetQua tieuDe="Kết quả đánh giá đầu vào">{ketQuaDauVao}</KhuKetQua>;
    if (gd.thu_tu === thuTuDauRa) return <KhuKetQua tieuDe="Kết quả đánh giá đầu ra">{ketQuaDauRa}</KhuKetQua>;
    return null;
  };
  // Khóa thiếu giai đoạn đánh giá tương ứng -> giữ khối cuối thẻ để không mất kết quả,
  // nhưng chỉ hiện mục có dữ liệu (mức đã chốt hoặc bài đã hoàn thành) — 2026-10-09.
  const cuoiDauVao = thuTuDauVao == null && coKetQua(muc_dau_vao, baiDauVao);
  const cuoiDauRa = thuTuDauRa == null && coKetQua(muc_dau_ra, baiDauRa);

  return (
    <Box p="lg" style={{ borderRadius: 14, border: '1px solid var(--mantine-color-gray-3)', background: 'var(--mantine-color-white)' }}>
      <Stack gap="md">
        <Box>
          <Group gap="xs" wrap="wrap" align="baseline">
            <Title order={2} size="h4">
              {khoa.ten_khoa}
            </Title>
            <Text size="sm" c="dimmed">
              {khoa.ma_khoa}
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            {dinhDangNgayGio(khoa.thoi_gian_bat_dau)} – {dinhDangNgayGio(khoa.thoi_gian_ket_thuc)}
          </Text>
        </Box>

        {cum && <KhoiCum cum={cum} />}

        {giai_doan.map((gd) => (
          <TheGiaiDoan
            key={gd.id}
            gd={gd}
            chuaPhanLop={chuaCoLopNao}
            baiKhaoSat={baiCuaGiaiDoan(gd)}
            tinhTrang={tinhTrang}
            ketQua={ketQuaCuaGiaiDoan(gd)}
          />
        ))}

        {chuaCoLopNao && giai_doan.length > 0 && (
          <StatusBanner loai="info">
            Lưu ý: Danh sách lớp, giảng viên và lịch học chi tiết của từng giai đoạn sẽ được phân chia và cập nhật
            sau. Thầy/Cô vui lòng theo dõi trang này hoặc nhóm Zalo để nhận thông tin mới nhất.
          </StatusBanner>
        )}

        {chuaCoLopNao && giai_doan.length === 0 && (
          <StatusBanner loai="info">Lịch các giai đoạn của khóa học sẽ được cập nhật sau.</StatusBanner>
        )}

        {(cuoiDauVao || cuoiDauRa) && (
          <Box data-testid="ket-qua-cuoi-trang">
            <Text fw={700} size="sm" mb={4}>
              Kết quả đánh giá
            </Text>
            <Stack gap="xs">
              {cuoiDauVao && ketQuaDauVao}
              {cuoiDauRa && ketQuaDauRa}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function coKetQua(mucChot: MucNangLuc | null, bai?: TinhTrangBaiKhaoSat): boolean {
  return !!mucChot || bai?.trang_thai === 'hoan_thanh';
}

function KhuKetQua({ tieuDe, children }: { tieuDe: string; children: ReactNode }) {
  return (
    <Box mt="sm" data-testid="ket-qua-giai-doan">
      <Divider mb="sm" />
      <Text fw={700} size="sm" mb={6}>
        {tieuDe}
      </Text>
      {children}
    </Box>
  );
}

/** Mức quản trị đã chốt cho khóa (import ket_qua_danh_gia) ưu tiên; chưa chốt mà học viên đã hoàn
 * thành bài trên hệ thống khảo sát -> hiện mức theo thang khảo sát + link xem kết quả chi tiết. */
function DongKetQua({ nhan, mucChot, bai }: { nhan: string; mucChot: MucNangLuc | null; bai?: TinhTrangBaiKhaoSat }) {
  const tuKhaoSat = !mucChot && bai?.trang_thai === 'hoan_thanh' ? bai : undefined;
  const hrefChiTiet = chuanHoaLienKet(tuKhaoSat?.url_ket_qua);
  const giaTri = tuKhaoSat ? (nhanMucKetQua(tuKhaoSat) ?? 'Đã làm bài, kết quả đang được tổng hợp') : nhanMucNangLuc(mucChot);

  return (
    <Box>
      <Badge variant="light" color={mucChot || tuKhaoSat ? 'blue' : 'gray'} size="lg" style={{ textTransform: 'none' }}>
        {nhan}: {giaTri}
      </Badge>
      {tuKhaoSat && (
        <Text size="xs" c="dimmed" mt={4}>
          Theo bài làm trên hệ thống khảo sát
          {tuKhaoSat.hoan_thanh_luc && <>, hoàn thành lúc {dinhDangNgayGio(tuKhaoSat.hoan_thanh_luc)}</>}.
          {hrefChiTiet && (
            <>
              {' '}
              <Anchor href={hrefChiTiet} size="xs">
                Xem kết quả chi tiết
              </Anchor>
            </>
          )}
        </Text>
      )}
    </Box>
  );
}

/** Giai đoạn đánh giá làm qua trang khảo sát (kênh SSO): chưa xong -> nút làm bài (cấp mã SSO, chuyển
 * cùng tab như M6); xong -> chỉ hiện kết quả, không còn nút mở. */
function BaiKhaoSatGiaiDoan({ loai, tinhTrang }: { loai: SsoTarget[]; tinhTrang?: TinhTrangBaiKhaoSat[] }) {
  const chuyen = useMutation({
    mutationFn: capMaSso,
    onSuccess: ({ url }) => window.location.assign(url),
  });
  return (
    <Stack gap="sm">
      {chuyen.isError && <StatusBanner loai="error">{thongDiepLoiChung(chuyen.error)}</StatusBanner>}
      {loai.map((l, i) => (
        <BaiKhaoSat
          key={l}
          loai={l}
          thuTu={loai.length > 1 ? i + 1 : undefined}
          tinhTrang={tinhTrang?.find((t) => t.loai === l)}
          dangChuyen={chuyen.isPending && chuyen.variables === l}
          khoaNut={chuyen.isPending}
          onLam={() => chuyen.mutate(l)}
          anNutKhiXong
        />
      ))}
    </Stack>
  );
}

// Phân lớp theo giai đoạn (spec 2026-10-02 mục 5.2): 1 thẻ/giai đoạn. Có lớp -> lớp + nhân sự + buổi
// của đúng giai đoạn; không lớp -> link/hướng dẫn chung của giai đoạn (vd đánh giá đầu vào/đầu ra).
function TheGiaiDoan({
  gd,
  chuaPhanLop,
  baiKhaoSat,
  tinhTrang,
  ketQua,
}: {
  gd: GiaiDoanCuaToi;
  chuaPhanLop: boolean;
  baiKhaoSat: SsoTarget[] | null;
  tinhTrang?: TinhTrangBaiKhaoSat[];
  ketQua?: ReactNode;
}) {
  return (
    <Paper p="md" radius="md" withBorder data-testid="the-giai-doan">
      <Group gap="xs" mb={2} wrap="wrap">
        <Title order={3} size="h5">{`GĐ${gd.thu_tu} · ${gd.ten_giai_doan}`}</Title>
        <Badge size="sm" color={MAU_HINH_THUC[gd.hinh_thuc] ?? 'gray'}>
          {NHAN_HINH_THUC[gd.hinh_thuc] ?? gd.hinh_thuc}
        </Badge>
      </Group>
      <Text size="sm" c="dimmed" mb="sm">
        {dinhDangNgay(gd.thoi_gian_bat_dau)} – {dinhDangNgay(gd.thoi_gian_ket_thuc)}
      </Text>

      {gd.lop ? (
        <Stack gap="sm">
          <Text fw={700}>{gd.lop.ten_lop}</Text>
          {gd.lop.nhan_su.length > 0 && (
            <Stack gap={4}>
              {gd.lop.nhan_su.map((ns) => (
                <Text size="sm" key={ns.id}>
                  {NHAN_VAI_TRO_NHAN_SU[ns.vai_tro] ?? ns.vai_tro}: {ns.ho_ten}
                  {ns.so_dien_thoai ? ` — ${ns.so_dien_thoai}` : ''}
                </Text>
              ))}
            </Stack>
          )}
          <DanhSachBuoi lichHoc={gd.lop.lich_hoc} />
          {(gd.thuc_dia ?? []).length > 0 && (
            <Text size="sm">
              <b>Hỗ trợ tại điểm học:</b>{' '}
              {(gd.thuc_dia ?? []).map((t, i) => (
                <span key={i}>
                  {i > 0 ? ' · ' : ''}
                  {t.ho_ten} (<a href={`tel:${t.so_dien_thoai}`}>{t.so_dien_thoai}</a>){t.nhiem_vu ? ` — ${t.nhiem_vu}` : ''}
                </span>
              ))}
            </Text>
          )}
        </Stack>
      ) : baiKhaoSat ? (
        <BaiKhaoSatGiaiDoan loai={baiKhaoSat} tinhTrang={tinhTrang} />
      ) : (
        <Stack gap="xs">
          {gd.huong_dan && (
            <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
              {gd.huong_dan}
            </Text>
          )}
          {gd.link_hoac_dia_diem &&
            (() => {
              const href = chuanHoaLienKet(gd.link_hoac_dia_diem);
              return href ? (
                <Button component="a" href={href} size="xs" style={{ alignSelf: 'flex-start' }}>
                  Mở liên kết
                </Button>
              ) : (
                <Text size="sm">Địa điểm: {gd.link_hoac_dia_diem}</Text>
              );
            })()}
          {!gd.huong_dan && !gd.link_hoac_dia_diem && !chuaPhanLop && (
            <Text size="sm" c="dimmed">
              Thông tin lớp ở giai đoạn này sẽ được cập nhật sau.
            </Text>
          )}
        </Stack>
      )}

      {ketQua}

      {gd.tien_do && (
        <Group gap="xs" mt="sm">
          <Badge variant="light" color="blue" size="sm">
            Hoàn thành: {gd.tien_do.ty_le_hoan_thanh == null ? 'Chưa có' : `${gd.tien_do.ty_le_hoan_thanh}%`}
          </Badge>
          {gd.tien_do.diem != null && (
            <Badge variant="light" color="gray" size="sm">
              Điểm: {gd.tien_do.diem}
            </Badge>
          )}
        </Group>
      )}
    </Paper>
  );
}

function KhoiCum({ cum }: { cum: CumHocVien }) {
  const hrefZalo = chuanHoaLienKet(cum.link_zalo);
  return (
    <Paper p="md" radius="md" style={{ background: 'var(--mantine-color-gray-0)' }}>
      <Text fw={700} size="sm">
        Cụm hỗ trợ Zalo: {cum.ten_cum}
      </Text>
      {cum.ghi_chu && (
        <Text size="sm" c="dimmed" mt={2}>
          {cum.ghi_chu}
        </Text>
      )}
      {hrefZalo && (
        <Button component="a" href={hrefZalo} size="xs" mt={6}>
          Vào nhóm Zalo
        </Button>
      )}
    </Paper>
  );
}

function DanhSachBuoi({ lichHoc }: { lichHoc: LichHocLopToi[] }) {
  if (lichHoc.length === 0) return null;
  // ADR 0005 (issue #24): buổi Zoom của khóa đã bật điểm danh — backend giấu link, trả diem_danh_zoom.
  const buoiZoom = lichHoc.find((b) => b.diem_danh_zoom);
  return (
    <Stack gap="xs">
      {buoiZoom?.diem_danh_zoom && <CanhBaoDiemDanhZoom buoi={{ ...buoiZoom, diem_danh_zoom: buoiZoom.diem_danh_zoom }} />}
      {lichHoc.map((buoi) => (
        <Box key={buoi.id} p="sm" data-testid="the-buoi" style={{ borderRadius: 10, background: 'var(--mantine-color-gray-0)' }}>
          <Group gap="xs">
            <Text size="sm" fw={600}>
              Buổi {buoi.buoi_so}
            </Text>
            {buoi.diem_danh_zoom ? (
              <NhanDiemDanhZoom dz={buoi.diem_danh_zoom} />
            ) : (
              buoi.trang_thai_diem_danh && (
                <Badge size="sm" color={MAU_DIEM_DANH[buoi.trang_thai_diem_danh]}>
                  {NHAN_DIEM_DANH[buoi.trang_thai_diem_danh]}
                </Badge>
              )
            )}
          </Group>
          {buoi.diem_danh_lop_cu && (
            <Text size="xs" c="dimmed" data-testid="diem-danh-lop-cu">
              Buổi {buoi.buoi_so}: đã {NHAN_DIEM_DANH[buoi.diem_danh_lop_cu.trang_thai].toLowerCase()} ở{' '}
              {buoi.diem_danh_lop_cu.ten_lop} (lớp cũ)
            </Text>
          )}
          <Text size="sm" c="dimmed">
            {dinhDangNgayGio(buoi.thoi_gian_bat_dau)} – {dinhDangNgayGio(buoi.thoi_gian_ket_thuc)}
          </Text>
          {(buoi.giang_vien ?? []).length > 0 && (
            <Text size="sm" mt={4}>
              <b>Giảng viên:</b>{' '}
              {(buoi.giang_vien ?? []).map((g) => `${g.ho_ten}${g.vai_tro === 'ho_tro' ? ' (hỗ trợ)' : ''}`).join(', ')}
            </Text>
          )}
          {buoi.diem_hoc && (
            <Box mt={4}>
              <Text size="sm">
                <b>Điểm học:</b> {buoi.diem_hoc.ten}
                {buoi.phong ? ` — phòng ${buoi.phong}` : ''}
              </Text>
              <Text size="sm" c="dimmed">
                {buoi.diem_hoc.dia_chi}
              </Text>
              {buoi.diem_hoc.nguoi_lien_he && (
                <Text size="sm" c="dimmed">
                  Liên hệ: {buoi.diem_hoc.nguoi_lien_he}
                  {buoi.diem_hoc.sdt_lien_he && (
                    <>
                      {' — '}
                      <a href={`tel:${buoi.diem_hoc.sdt_lien_he}`}>{buoi.diem_hoc.sdt_lien_he}</a>
                    </>
                  )}
                </Text>
              )}
            </Box>
          )}
          {buoi.dia_diem_hoac_link &&
            (() => {
              const href = chuanHoaLienKet(buoi.dia_diem_hoac_link);
              return href ? (
                <Button component="a" href={href} size="xs" mt={6}>
                  Vào học
                </Button>
              ) : (
                <Text size="sm" mt={4}>
                  Địa điểm: {buoi.dia_diem_hoac_link}
                </Text>
              );
            })()}
          {buoi.diem_danh_zoom?.co_link && <NutDiemDanhZoom buoi={buoi} />}
          {canNhacCungNgay(buoi, lichHoc) && (
            <Text size="sm" c="orange.8" mt={4}>
              Buổi này cũng cần bấm điểm danh, kể cả khi bạn vẫn đang ở trong phòng Zoom.
            </Text>
          )}
        </Box>
      ))}
    </Stack>
  );
}
