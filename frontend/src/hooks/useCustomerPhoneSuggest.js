import { useEffect, useRef, useState } from "react";

// Gợi ý khách cũ theo phần đầu SĐT, tối ưu để không spam request / treo:
//   • debounce (mặc định 300ms) — chỉ gọi khi ngừng gõ
//   • tối thiểu `minDigits` số (mặc định 3) mới gọi
//   • AbortController huỷ request cũ khi gõ tiếp → không đua request, giảm tải
//   • cache theo prefix trong phiên → gõ lại/xoá bớt không gọi lại
//   • bỏ qua kết quả đến trễ (chống race)
export function useCustomerPhoneSuggest(phone, fetcher, { minDigits = 3, delay = 300 } = {}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < minDigits) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }

    if (cacheRef.current.has(digits)) {
      setSuggestions(cacheRef.current.get(digits));
      setLoading(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const myId = ++reqIdRef.current;
      setLoading(true);
      try {
        const { customers = [] } = await fetcher(String(phone).trim(), ac.signal);
        if (myId !== reqIdRef.current) return; // kết quả trễ — bỏ
        cacheRef.current.set(digits, customers);
        setSuggestions(customers);
      } catch {
        // aborted hoặc lỗi mạng — im lặng, giữ gợi ý cũ
      } finally {
        if (myId === reqIdRef.current) setLoading(false);
      }
    }, delay);

    return () => clearTimeout(timer);
    // fetcher/minDigits/delay giữ ổn định từ caller — chỉ chạy lại khi phone đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const clear = () => setSuggestions([]);
  return { suggestions, loading, clear };
}
