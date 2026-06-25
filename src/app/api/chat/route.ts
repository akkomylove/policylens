import { NextRequest, NextResponse } from "next/server";
import { Policy } from "@/types/policy";
import { checkRateLimit, getClientIP } from "@/lib/rateLimit";
import { track } from "@/lib/analytics";

/**
 * AI 智能追问 API（流式）
 * 针对单条政策继续提问，SSE 流式返回
 *
 * 安全增强（V6.1）：
 * - IP 限流：每分钟 10 次
 * - 输入校验：question 长度限制
 * - 错误降级
 */

const GLM_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60_000;

const MAX_QUESTION_LENGTH = 500;
const MAX_HISTORY_TURNS = 10; // 保留最近 10 轮对话

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function buildSystemPrompt(policy: Policy): string {
  return `你是一个就业政策解读专家，正在为用户解读以下就业政策。请基于政策内容回答用户的问题，用大白话解释，让普通人能看懂。

## 政策信息
- 标题：${policy.title}
- 发文机构：${policy.agency}
- 发布日期：${policy.publishDate}
- 适用人群：${policy.applicableGroups.join("、")}
- 补贴类型：${policy.subsidyType}
- 补贴金额：${policy.subsidyAmount}
- 申请条件：${policy.requirements.join("；")}
- 政策正文：${policy.content.slice(0, 1500)}

## 回答要求
1. 用大白话，避免官方术语堆砌
2. 回答简洁，通常不超过 300 字
3. 如果问题超出政策范围，明确告知"这条政策未涉及该问题，建议咨询 12333"
4. 不要编造政策未提到的细节（如具体金额、办理窗口）
5. 涉及办理流程时，引导用户查看官方申报入口 si.12333.gov.cn`;
}

export async function POST(request: NextRequest) {
  // 限流
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(`chat:${clientIP}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
  if (rateLimit.limited) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: `请求过于频繁，请 ${retryAfter} 秒后重试` },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI 服务未配置，无法使用追问功能" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { policy, question, history }: {
      policy: Policy;
      question: string;
      history?: ChatMessage[];
    } = body;

    // 校验
    if (!policy || !policy.id || !policy.title) {
      return NextResponse.json({ error: "政策信息无效" }, { status: 400 });
    }
    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return NextResponse.json({ error: "问题不能为空" }, { status: 400 });
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      return NextResponse.json(
        { error: `问题不能超过 ${MAX_QUESTION_LENGTH} 字` },
        { status: 400 }
      );
    }

    // 构建 messages
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: buildSystemPrompt(policy) },
    ];

    // 历史对话（截断保留最近 N 轮）
    if (Array.isArray(history) && history.length > 0) {
      const trimmedHistory = history.slice(-MAX_HISTORY_TURNS * 2);
      for (const msg of trimmedHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: "user", content: question });

    // 埋点
    track("chat_request", { policyId: policy.id, questionLength: question.length });

    // 调用 GLM 流式 API
    const glmResponse = await fetch(GLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "GLM-4.7-Flash",
        messages,
        temperature: 0.5,
        top_p: 0.9,
        max_tokens: 1024,
        stream: true,
      }),
    });

    if (!glmResponse.ok || !glmResponse.body) {
      const errText = await glmResponse.text();
      console.error("GLM chat API error:", glmResponse.status, errText);
      return NextResponse.json(
        { error: "AI 服务暂时不可用，请稍后重试" },
        { status: 502 }
      );
    }

    // 转发 SSE 流
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = glmResponse.body!.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data:")) continue;

              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") {
                controller.close();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  controller.enqueue(encoder.encode(delta));
                }
              } catch {
                // 跳过无法解析的行
              }
            }
          }
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(rateLimit.resetAt),
      },
    });
  } catch (error) {
    console.error("Chat API 错误:", error);
    return NextResponse.json(
      { error: "追问服务暂时不可用" },
      { status: 500 }
    );
  }
}
