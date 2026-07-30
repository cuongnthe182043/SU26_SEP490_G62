import { SpendingManagement } from "../../../components/shared-ui/SpendingManagement";
import { coordinatorService } from "../services/coordinator.service";

// Coordinator là người duyệt/từ chối chi phí tài xế duy nhất (thay Manager).
// Mọi chi phí đều đi qua đây chờ duyệt, kể cả đơn không thu tiền mặt — nhưng
// chi phí chờ duyệt KHÔNG chặn việc chốt phiếu thu, và khoản chi hộ khách được
// duyệt tự động ngay khi phiếu thu chốt (vì đã thu của khách thì phải hoàn tài).
// Không có phiếu chi (việc của Kế toán).
export default function ExpensesView() {
  return (
    <SpendingManagement
      canModerateExpense
      api={{
        listExpenses: coordinatorService.getSpendingExpenses,
        approveExpense: coordinatorService.approveExpense,
        rejectExpense: coordinatorService.rejectExpense,
        unapproveExpense: coordinatorService.unapproveExpense,
      }}
    />
  );
}
