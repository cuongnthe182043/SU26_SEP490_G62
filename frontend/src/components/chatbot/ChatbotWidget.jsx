import { useState, useRef, useEffect, useCallback, useId } from "react";
import { Button, Input, Spinner } from "@heroui/react";
import { RiCloseLine, RiSendPlaneFill } from "react-icons/ri";
import { chatbotService } from "../../services/chatbot.service";

// Ngôi sao 4 cánh lấp lánh kiểu Gemini. `gradient=false` → tô 1 màu (dùng trên nền màu).
function GeminiSpark({ size = 22, gradient = true, color = "#fff" }) {
  const id = useId().replace(/:/g, "");
  const path =
    "M12 1 Q12.6 9.4 23 12 Q12.6 14.6 12 23 Q11.4 14.6 1 12 Q11.4 9.4 12 1 Z";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {gradient && (
        <defs>
          <linearGradient id={`g-${id}`} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1BA1E3" />
            <stop offset="45%" stopColor="#5C7CFA" />
            <stop offset="75%" stopColor="#9B72CB" />
            <stop offset="100%" stopColor="#D96570" />
          </linearGradient>
        </defs>
      )}
      <path d={path} fill={gradient ? `url(#g-${id})` : color} />
    </svg>
  );
}

const GREETING = {
  role: "assistant",
  content:
    "Chào anh/chị 👋 Em là trợ lý dữ liệu. Anh/chị có thể hỏi em về doanh thu, công nợ, KPI, chuyến, sự cố... hoặc quy trình nghiệp vụ. Ví dụ: \"Doanh thu tháng này bao nhiêu?\"",
};

const SUGGESTIONS = [
  "Doanh thu tháng này bao nhiêu?",
  "Đối tác nào đang nợ nhiều nhất?",
  "Có bao nhiêu chuyến chưa hoàn thành?",
];

export default function ChatbotWidget() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    chatbotService
      .getStatus()
      .then((r) => setEnabled(Boolean(r?.enabled)))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(
    async (text) => {
      const q = String(text ?? input).trim();
      if (!q || loading) return;
      setInput("");

      const nextMessages = [...messages, { role: "user", content: q }];
      setMessages(nextMessages);
      setLoading(true);

      // Lịch sử gửi lên (bỏ lời chào, lấy tối đa 6 lượt gần nhất).
      const history = nextMessages
        .filter((m) => m !== GREETING)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const res = await chatbotService.ask(q, history.slice(0, -1));
        setMessages((prev) => [...prev, { role: "assistant", content: res?.answer || "Xin lỗi, em chưa trả lời được." }]);
      } catch (err) {
        const msg =
          err?.status === 403
            ? "Vai trò của anh/chị chưa được bật trợ lý này."
            : err?.status === 503
              ? "Trợ lý chưa được cấu hình (thiếu API key). Vui lòng báo quản trị."
              : "Có lỗi khi xử lý câu hỏi. Anh/chị thử lại giúp em.";
        setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages],
  );

  if (!enabled) return null;

  return (
    <>
      {/* Nút nổi */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-6 z-[9999] flex items-center gap-2 rounded-full px-5 py-3.5 text-white shadow-lg shadow-black/20 transition-all hover:scale-105 hover:shadow-xl"
          style={{ background: "linear-gradient(90deg, #1BA1E3 0%, #5C7CFA 40%, #9B72CB 72%, #D96570 100%)" }}
          aria-label="Mở trợ lý AI"
        >
          <GeminiSpark size={22} gradient={false} color="#fff" />
          <span className="text-sm font-semibold">Trợ lý AI</span>
        </button>
      )}

      {/* Panel chat */}
      {open && (
        <div className="fixed bottom-6 right-6 z-[9999] flex h-[560px] max-h-[calc(100vh-3rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ background: "linear-gradient(90deg, #1BA1E3 0%, #5C7CFA 40%, #9B72CB 72%, #D96570 100%)" }}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25">
                <GeminiSpark size={18} gradient={false} color="#fff" />
              </div>
              <div>
                <div className="text-sm font-bold leading-tight">Trợ lý dữ liệu</div>
                <div className="text-[11px] text-white/80">Hỏi số liệu &amp; quy trình</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-white/20" aria-label="Đóng">
              <RiCloseLine size={20} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-3 py-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-blue-600 text-white"
                      : "rounded-bl-sm border border-gray-100 bg-white text-gray-800 shadow-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Gợi ý câu hỏi (chỉ khi mới mở) */}
            {messages.length === 1 && (
              <div className="flex flex-col gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-left text-[12px] text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-gray-100 bg-white px-3.5 py-2.5 shadow-sm">
                  <Spinner size="sm" />
                  <span className="text-[12px] text-gray-500">Đang phân tích...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-gray-100 bg-white px-3 py-2.5"
          >
            <Input
              value={input}
              onValueChange={setInput}
              placeholder="Nhập câu hỏi..."
              size="sm"
              radius="lg"
              variant="bordered"
              isDisabled={loading}
              classNames={{ inputWrapper: "bg-gray-50" }}
            />
            <Button
              type="submit"
              isIconOnly
              color="primary"
              radius="lg"
              size="sm"
              isDisabled={loading || !input.trim()}
              aria-label="Gửi"
            >
              <RiSendPlaneFill size={18} />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
