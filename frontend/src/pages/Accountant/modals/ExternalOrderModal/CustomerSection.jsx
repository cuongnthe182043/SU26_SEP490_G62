import { useState } from "react";
import { Input, Spinner } from "@heroui/react";
import { RiUserFollowLine } from "react-icons/ri";
import { useCustomerPhoneSuggest } from "../../../../hooks/useCustomerPhoneSuggest";
import { accountantService } from "../../services/accountant.service";

export function CustomerSection({ name, onNameChange, phone, onPhoneChange, company, onCompanyChange, errors }) {
  const [showSuggest, setShowSuggest] = useState(false);
  const { suggestions, loading, clear } = useCustomerPhoneSuggest(phone, accountantService.findCustomerByPhone);

  const pick = (c) => {
    onPhoneChange(c.phone || phone);
    onNameChange(c.full_name || "");
    onCompanyChange(c.company_name || "");
    clear();
    setShowSuggest(false);
  };

  const open = showSuggest && (loading || suggestions.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
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
        <div className="relative">
          <Input
            label="Số điện thoại"
            placeholder="Gõ vài số đầu để tìm khách cũ..."
            value={phone}
            onValueChange={(v) => { onPhoneChange(v); setShowSuggest(true); }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            isRequired
            isInvalid={!!errors?.customer_phone}
            errorMessage={errors?.customer_phone}
            autoComplete="off"
          />
          {open && (
            <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#161922] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg max-h-56 overflow-auto">
              {loading && suggestions.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400 dark:text-gray-400">
                  <Spinner size="sm" /> Đang tìm khách cũ...
                </div>
              ) : (
                suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(c)}
                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 flex items-center justify-between gap-2 text-xs border-b border-gray-50 last:border-0"
                  >
                    <span className="flex flex-col min-w-0">
                      <span className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {c.full_name?.trim() || "(chưa có tên)"}
                        {c.company_name ? ` · ${c.company_name}` : ""}
                      </span>
                      <span className="text-gray-400 dark:text-gray-400 font-mono">{c.phone}</span>
                    </span>
                    <span className="shrink-0 flex items-center gap-1 text-emerald-600 dark:text-emerald-300 font-semibold">
                      <RiUserFollowLine size={12} />{c.order_count} đơn
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      <Input
        label="Công ty / Đối tác"
        placeholder="Tuỳ chọn"
        value={company}
        onValueChange={onCompanyChange}
      />
    </div>
  );
}
