import { Input } from "@heroui/react";
import { RiUserFollowLine } from "react-icons/ri";

export function CustomerSection({
  name, onNameChange, phone, onPhoneChange, company, onCompanyChange, errors,
  matched, onApplyMatched,
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Thông tin khách hàng
      </span>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Tên khách hàng"
          placeholder="Nguyễn Văn A"
          value={name}
          onValueChange={onNameChange}
          isRequired
          isInvalid={!!errors?.customer_name}
          errorMessage={errors?.customer_name}
        />
        <Input
          label="Số điện thoại"
          placeholder="0901234567"
          value={phone}
          onValueChange={onPhoneChange}
          isRequired
          isInvalid={!!errors?.customer_phone}
          errorMessage={errors?.customer_phone}
        />
      </div>

      {matched && (
        <div className="flex items-center justify-between gap-2 text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          <span className="flex items-center gap-1.5 text-emerald-700">
            <RiUserFollowLine size={14} />
            <span>
              <b>Khách cũ:</b> {matched.full_name?.trim() || "(chưa có tên)"}
              {matched.company_name ? ` · ${matched.company_name}` : ""}
              {" — "}{matched.order_count} đơn trước đó
            </span>
          </span>
          <button
            type="button"
            onClick={onApplyMatched}
            className="shrink-0 text-emerald-700 font-semibold hover:underline"
          >
            Dùng thông tin này
          </button>
        </div>
      )}

      <Input
        label="Công ty / Đối tác"
        placeholder="Tuỳ chọn"
        value={company}
        onValueChange={onCompanyChange}
      />
    </div>
  );
}
