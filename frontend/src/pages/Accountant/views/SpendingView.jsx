import { SpendingManagement } from "../../../components/shared-ui/SpendingManagement";
import { accountantService } from "../services/accountant.service";

// Accountant: tạo phiếu chi + xác nhận đã chi + huỷ phiếu đã duyệt nhưng chưa chi.
// Xem chi phí tài xế để đối chiếu (duyệt chi phí là quyền của Manager/Coordinator
// theo permission matrix).
export default function SpendingView() {
  return (
    <SpendingManagement
      canCreateVoucher
      canPayVoucher
      canCancelVoucher
      api={{
        listExpenses: accountantService.getSpendingExpenses,
        listVouchers: accountantService.getVouchers,
        createVoucher: accountantService.createVoucher,
        payVoucher: accountantService.payVoucher,
        cancelVoucher: accountantService.cancelVoucher,
        getSummary: accountantService.getSpendingSummary,
      }}
    />
  );
}
