import { SpendingManagement } from "../../../components/shared-ui/SpendingManagement";
import { managerService } from "../services/manager.service";

// Manager: duyệt phiếu chi. Chi phí tài xế chỉ xem lịch sử — quyền duyệt/từ chối
// thuộc về Coordinator. Đơn CASH còn được duyệt kèm khi phát hành phiếu thu
// (autoApproveOrderExpenses); đơn non-cash KHÔNG tạo phiếu thu (requestOrderReceipt
// chặn theo payment_type) nên phải duyệt tay — nhánh tự duyệt lúc tạo đã gỡ vì
// 'approved' khoá luôn quyền sửa của tài xế, xem services/expenseService.js.
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
