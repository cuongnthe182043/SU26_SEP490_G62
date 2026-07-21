import { AttendanceManagement } from "../../../components/shared-ui/AttendanceManagement";
import { accountantService } from "../services/accountant.service";

export default function AttendanceView() {
  return (
    <AttendanceManagement
      getGrid={accountantService.getAttendanceGrid}
      markAttendance={accountantService.markAttendance}
      clearAttendance={accountantService.clearAttendance}
      getVehicleGroups={accountantService.getVehicleGroupsForKpi}
    />
  );
}
