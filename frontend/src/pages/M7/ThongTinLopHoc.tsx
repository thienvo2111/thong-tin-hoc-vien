import { Badge, Box, Button, Center, Container, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useKhoaHocToi } from '@/api/hocVien';
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

const NHAN_MUC_NANG_LUC: Record<MucNangLuc, string> = {
  co_ban: 'Cơ bản',
  thanh_thao: 'Thành thạo',
  nang_cao: 'Nâng cao',
};

function nhanMucNangLuc(muc: MucNangLuc | null): string {
  return muc ? NHAN_MUC_NANG_LUC[muc] : 'Chưa có kết quả';
}

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

        {data?.map((dangKy) => <KhoiKhoaHoc key={dangKy.id} dangKy={dangKy} />)}
      </Stack>
    </Container>
  );
}

function KhoiKhoaHoc({ dangKy }: { dangKy: KhoaHocDangKy }) {
  const { khoa, cum, giai_doan, muc_dau_vao, muc_dau_ra } = dangKy;
  const chuaCoLopNao = giai_doan.every((gd) => !gd.lop);

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
          <TheGiaiDoan key={gd.id} gd={gd} chuaPhanLop={chuaCoLopNao} />
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

        <Box>
          <Text fw={700} size="sm" mb={4}>
            Kết quả đánh giá
          </Text>
          <Group gap="xs">
            <Badge variant="light" color="gray" size="lg">
              Đầu vào: {nhanMucNangLuc(muc_dau_vao)}
            </Badge>
            <Badge variant="light" color="gray" size="lg">
              Đầu ra: {nhanMucNangLuc(muc_dau_ra)}
            </Badge>
          </Group>
        </Box>
      </Stack>
    </Box>
  );
}

// Phân lớp theo giai đoạn (spec 2026-10-02 mục 5.2): 1 thẻ/giai đoạn. Có lớp -> lớp + nhân sự + buổi
// của đúng giai đoạn; không lớp -> link/hướng dẫn chung của giai đoạn (vd đánh giá đầu vào/đầu ra).
function TheGiaiDoan({ gd, chuaPhanLop }: { gd: GiaiDoanCuaToi; chuaPhanLop: boolean }) {
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
        </Stack>
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
  return (
    <Stack gap="xs">
      {lichHoc.map((buoi) => (
        <Box key={buoi.id} p="sm" style={{ borderRadius: 10, background: 'var(--mantine-color-gray-0)' }}>
          <Group gap="xs">
            <Text size="sm" fw={600}>
              Buổi {buoi.buoi_so}
            </Text>
            {buoi.trang_thai_diem_danh && (
              <Badge size="sm" color={MAU_DIEM_DANH[buoi.trang_thai_diem_danh]}>
                {NHAN_DIEM_DANH[buoi.trang_thai_diem_danh]}
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed">
            {dinhDangNgayGio(buoi.thoi_gian_bat_dau)} – {dinhDangNgayGio(buoi.thoi_gian_ket_thuc)}
          </Text>
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
        </Box>
      ))}
    </Stack>
  );
}
