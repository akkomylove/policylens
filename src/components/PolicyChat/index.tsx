"use client";

import { useState, useRef, useEffect } from "react";
import { Send, MessageCircle, Sparkles } from "lucide-react";
import { Policy } from "@/types/policy";
import { track } from "@/lib/analytics";

interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * AI 智能追问组件
 * 在政策详情页底部，允许用户针对单条政策继续提问
 * 流式接收响应，实时显示
 */
export default function PolicyChat({ policy }: { policy: Policy }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || isLoading) return;
    const question = input.trim();
    setInput("");

    const userMsg: Message = { role: "user", content: question };
    const assistantMsg: Message = { role: "assistant", content: "" };
    const newMessages = [...messages, userMsg, assistantMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy: {
            id: policy.id,
            title: policy.title,
            agency: policy.agency,
            publishDate: policy.publishDate,
            applicableGroups: policy.applicableGroups,
            subsidyType: policy.subsidyType,
            subsidyAmount: policy.subsidyAmount,
            requirements: policy.requirements,
            content: policy.content,
          },
          question,
          history: messages,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `请求失败（${response.status}）`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accContent += chunk;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: accContent };
          return next;
        });
      }

      track("chat_complete", {
        policyId: policy.id,
        answerLength: accContent.length,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // 用户取消，保留已生成内容
      } else {
        const errorMsg = err instanceof Error ? err.message : "AI 暂时无法回答";
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: `抱歉，${errorMsg}。请稍后重试，或拨打 12333 咨询。`,
          };
          return next;
        });
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  // 建议问题（首次进入时显示）
  const suggestions = [
    "我符合申请条件吗？",
    "能拿多少钱？",
    "需要准备什么材料？",
    "去哪里办理？",
  ];

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
      <h2 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <MessageCircle size={18} className="text-emerald-600" />
        AI 智能追问
      </h2>
      <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
        <Sparkles size={11} />
        针对这条政策，你还有什么疑问？AI 帮你解答。
      </p>

      {/* 对话历史 */}
      {messages.length > 0 && (
        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto pr-1">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                  msg.role === "user"
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {msg.content ||
                  (isLoading && i === messages.length - 1 ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
                      正在思考...
                    </span>
                  ) : (
                    ""
                  ))}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* 建议问题（无对话历史时显示） */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setInput(s)}
              className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs hover:bg-emerald-100 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* 输入区 */}
      <div className="flex gap-2">
        <input
          id="policy-chat-input"
          name="policy-chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="输入你的问题..."
          disabled={isLoading}
          maxLength={500}
          aria-label="输入你的问题"
          className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:outline-none text-sm text-gray-900 disabled:bg-gray-50"
        />
        <button
          onClick={send}
          disabled={isLoading || !input.trim()}
          aria-label="发送问题"
          className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
        >
          <Send size={14} />
          发送
        </button>
      </div>
    </section>
  );
}
