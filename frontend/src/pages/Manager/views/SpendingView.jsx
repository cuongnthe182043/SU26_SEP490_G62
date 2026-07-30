import { SpendingManagement } from "../../../components/shared-ui/SpendingManagement";
import { managerService } from "../services/manager.service";

// Manager: duyệt phiếu chi. Chi phí tài xế chỉ xem lịch sử — quyền duyệt/từ chối
// thuộc về Coordinator (hoặc tự động duyệt với đơn không thu tiền mặt).
export default function SpendingView() {
  return (
    <SpendingManagement
      canModerateVoucher
      api={{
        listExpenses: managerService.getSpendingExpenses,
        listVouchers: managerService.getVouchers,
        approveVoucher: managerService.approveVoucher,
        rejectVoucher: managerService.rejectVoucher,
        getSummary: managerService.getSpendingSummary,
      }}
    />
  );
}
