import { Chip } from "@heroui/react";
import { normalizeStatus } from "../utils";

const COLOR_BY_STATUS = {
  available: "primary",
  claimed: "warning",
  picking: "warning",
  loaded: "warning",
  transit: "secondary",
  arrived: "primary",
  returning: "warning",
  completed: "success",
  cancelled: "default",
  failed: "danger",
  partial: "secondary",
  open: "danger",
  investigating: "warning",
  resolved: "success",
  closed: "default",
  pending: "warning",
  processing: "secondary",
  approved: "success",
  rejected: "danger",
};

export default function StatusTag({ status, children }) {
  const key = normalizeStatus(status);
  return (
    <Chip color={COLOR_BY_STATUS[key] || "default"} size="sm" variant="flat">
      {children ?? status ?? "-"}
    </Chip>
  );
}
