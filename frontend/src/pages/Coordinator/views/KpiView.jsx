import { KpiLeaderboard } from "../../../components/shared-ui/KpiLeaderboard";
import { coordinatorService } from "../services/coordinator.service";

export default function KpiView() {
  return (
    <KpiLeaderboard
      getVehicleGroups={coordinatorService.getVehicleGroups}
      getAllDriversKPI={coordinatorService.getAllDriversKPI}
      getLeaderboardByGroup={coordinatorService.getLeaderboardByGroup}
      // Không truyền onUpdateDriverGroup: đổi nhóm xe cố định là độc quyền Manager.
      // Coordinator vẫn xem được nhóm hiện tại và lịch sử đổi nhóm.
      getDriverGroupHistory={coordinatorService.getDriverGroupHistory}
    />
  );
}
