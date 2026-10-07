import DashboardThongKe from '@/pages/ThongKe/DashboardThongKe';
import { AdminPageHeader } from './AdminPageHeader';

export default function AdminTongQuan() {
  return (
    <>
      <AdminPageHeader title="Tổng quan hệ thống" />
      <DashboardThongKe che_do="admin" />
    </>
  );
}
