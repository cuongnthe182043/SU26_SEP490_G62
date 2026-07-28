import { SpendingManagement } from "../../../components/shared-ui/SpendingManagement";
import { coordinatorService } from "../services/coordinator.service";

// Coordinator là người duyệt/từ chối chi phí tài xế duy nhất (thay Manager).
// Đơn không thu tiền mặt (chuyển khoản/công nợ) tự động duyệt ngay lúc tài xế
// khai — không đi qua đây. Không có phiếu chi (việc của Kế toán).
export default function ExpensesView() {
  return (
    <SpendingManagement
      canModerateExpense
      api={{
        listExpenses: coordinatorService.getSpendingExpenses,
        approveExpense: coordinatorService.approveExpense,
        rejectExpense: coordinatorService.rejectExpense,
      }}
    />
  );
}
