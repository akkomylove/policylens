import { Policy, UserProfile, PolicyInterpretation, MatchBreakdown, MatchPriority } from "@/types/policy";

/**
 * GLM AI 客户端 V2
 * 调用智谱 GLM-4.7-Flash 模型解读政策
 * V2 升级：接收 matchBreakdown + priority，输出 whyYou/whyNow
 */

const GLM_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

/**
 * 调用 AI 解读政策
 */
export async function interpretPolicy(
  policy: Policy,
  userProfile: UserProfile,
  matchBreakdown?: MatchBreakdown,
  priority?: MatchPriority
): Promise<PolicyInterpretation> {
  const apiKey = process.env.GLM_API_KEY;

  if (!apiKey) {
    return generateFallbackInterpretation(policy, userProfile, matchBreakdown, priority);
  }

  const prompt = buildPrompt(policy, userProfile, matchBreakdown, priority);

  try {
    const response = await fetch(GLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "GLM-4.7-Flash",
        messages: [
          {
            role: "system",
            content:
              "你是一个就业政策解读专家，擅长把晦涩的政策文件翻译成普通人能看懂的大白话。请严格按照 JSON 格式输出，不要输出其他内容。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        top_p: 0.9,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("GLM API error:", response.status, errText);
      return generateFallbackInterpretation(policy, userProfile, matchBreakdown, priority);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";

    // 尝试从内容中提取 JSON（GLM 可能包裹在代码块中）
    let jsonStr = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = {};
    }

    return {
      policyId: policy.id,
      whyYou: parsed.whyYou || generateWhyYou(userProfile, matchBreakdown, priority),
      whyNow: parsed.whyNow || generateWhyNow(policy, priority),
      plainLanguage: parsed.plainLanguage || policy.summary,
      whatYouGet: parsed.whatYouGet || policy.subsidyType,
      requirements: parsed.requirements || policy.requirements,
      requiredDocuments: Array.isArray(parsed.requiredDocuments) && parsed.requiredDocuments.length > 0
        ? parsed.requiredDocuments
        : generateRequiredDocuments(policy),
      applyLocation: parsed.applyLocation || generateApplyLocation(policy),
      contactPhone: parsed.contactPhone || "12333",
      howToApply: normalizeHowToApply(parsed.howToApply, policy),
      estimatedAmount: parsed.estimatedAmount || policy.subsidyAmount,
    };
  } catch (error) {
    console.error("AI 解读失败，使用降级方案:", error);
    return generateFallbackInterpretation(policy, userProfile, matchBreakdown, priority);
  }
}

/**
 * 构建 Prompt（V2 升级：加入匹配明细和优先级）
 */
function buildPrompt(
  policy: Policy,
  userProfile: UserProfile,
  matchBreakdown?: MatchBreakdown,
  priority?: MatchPriority
): string {
  const priorityLabel = priority === "strong" ? "强烈推荐" : priority === "normal" ? "推荐" : "可选";

  const breakdownText = matchBreakdown
    ? `## 匹配信息（重要，请基于此个性化解读）
- 推荐优先级：${priorityLabel}
- 匹配明细：
  - 身份：${matchBreakdown.identity.reason}
  - 地域：${matchBreakdown.region.reason}
  - 学历：${matchBreakdown.education.reason}
  - 就业状态：${matchBreakdown.status.reason}
  - 行业：${matchBreakdown.industry.reason}`
    : `## 匹配信息
- 推荐优先级：${priorityLabel}`;

  return `请解读以下就业政策，针对用户画像给出个性化解读。

## 用户画像
- 身份：${userProfile.identity}
- 学历：${userProfile.education}
- 地区：${userProfile.province} ${userProfile.city}
- 就业状态：${userProfile.employmentStatus}

${breakdownText}

## 政策信息
- 标题：${policy.title}
- 发文机构：${policy.agency}
- 发布日期：${policy.publishDate}
- 适用人群：${policy.applicableGroups.join("、")}
- 补贴类型：${policy.subsidyType}
- 补贴金额：${policy.subsidyAmount}
- 申请条件：${policy.requirements.join("；")}
- 政策正文：${policy.content.slice(0, 800)}

## 输出要求
请用大白话解读，让普通人一看就懂。严格按照以下 JSON 格式输出：

{
  "whyYou": "为什么推荐你（基于匹配明细，1-2句话，具体说明哪个维度匹配）",
  "whyNow": "为什么现在申请（基于时效和优先级，1句话）",
  "plainLanguage": "用 2-3 句话把政策核心讲清楚，像跟朋友聊天一样",
  "whatYouGet": "这个用户具体能拿到什么（补贴/贷款/培训等）",
  "requirements": ["申请条件1", "申请条件2"],
  "requiredDocuments": ["需要准备的材料1", "材料2", "材料3（如身份证、户口本、营业执照、学历证明等）"],
  "applyLocation": "去哪里办（线上入口/线下窗口/政务服务中心，具体到部门）",
  "contactPhone": "咨询电话（如 12333 或具体号码）",
  "howToApply": ["步骤1：准备材料", "步骤2：提交申请", "步骤3：等待审核", "步骤4：领取补贴"],
  "estimatedAmount": "预计能拿多少钱"
}`;
}

/**
 * 生成 whyYou（基于匹配明细）
 */
function generateWhyYou(
  userProfile: UserProfile,
  matchBreakdown?: MatchBreakdown,
  priority?: MatchPriority
): string {
  if (!matchBreakdown) {
    return `基于您的画像（${userProfile.identity}·${userProfile.education}·${userProfile.province}），该政策与您匹配`;
  }

  const hitDims: string[] = [];
  if (matchBreakdown.identity.hit) hitDims.push("身份");
  if (matchBreakdown.region.hit) hitDims.push("地域");
  if (matchBreakdown.education.hit) hitDims.push("学历");
  if (matchBreakdown.status.hit) hitDims.push("就业状态");
  if (matchBreakdown.industry.hit) hitDims.push("行业意向");

  const priorityLabel = priority === "strong" ? "强烈推荐" : priority === "normal" ? "推荐" : "可选";

  if (hitDims.length >= 4) {
    return `${priorityLabel}：您在${hitDims.slice(0, 3).join("、")}等维度均匹配，高度符合政策要求`;
  }
  if (hitDims.length >= 2) {
    return `${priorityLabel}：您在${hitDims.join("、")}维度匹配`;
  }
  return `可选：您在${hitDims[0] || "身份"}维度匹配`;
}

/**
 * 生成 whyNow（基于时效和优先级）
 */
function generateWhyNow(policy: Policy, priority?: MatchPriority): string {
  const status = (policy as Policy & { effectiveStatus?: string }).effectiveStatus;
  if (status === "expiring") {
    return "政策即将截止，建议尽快申请";
  }
  if (status === "expired") {
    return "政策已过期，可关注后续延续或替代政策";
  }
  if (priority === "strong") {
    return "政策正在申报期，且与您高度匹配，建议优先申请";
  }
  return "政策正在执行期，可随时申请";
}

/**
 * 降级解读（无 API Key 或调用失败时）
 */
function generateFallbackInterpretation(
  policy: Policy,
  userProfile: UserProfile,
  matchBreakdown?: MatchBreakdown,
  priority?: MatchPriority
): PolicyInterpretation {
  return {
    policyId: policy.id,
    whyYou: generateWhyYou(userProfile, matchBreakdown, priority),
    whyNow: generateWhyNow(policy, priority),
    plainLanguage: `这项政策是${policy.agency}发布的，主要面向${policy.applicableGroups.join("、")}等群体。${policy.summary.slice(0, 100)}`,
    whatYouGet: policy.subsidyType
      ? `您可以享受：${policy.subsidyType}`
      : "请查看政策详情了解具体补贴内容",
    requirements: policy.requirements.length > 0 ? policy.requirements : ["请查看政策原文了解具体条件"],
    requiredDocuments: generateRequiredDocuments(policy),
    applyLocation: generateApplyLocation(policy),
    contactPhone: "12333",
    howToApply: [
      `准备申请材料（详见上方材料清单）`,
      `前往${generateApplyLocation(policy)}提交申请`,
      `等待审核结果`,
      `审核通过后领取补贴`,
    ],
    estimatedAmount: policy.subsidyAmount || "请查看政策原文",
  };
}

/**
 * V4 新增：规范化 howToApply 为数组
 * - 如果是数组且非空，直接返回
 * - 如果是字符串，按句号/换行拆分（兼容旧缓存）
 * - 其他情况返回降级数组
 */
function normalizeHowToApply(raw: unknown, policy: Policy): string[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  }
  if (typeof raw === "string" && raw.trim()) {
    // 兼容旧缓存：字符串拆分
    const text = raw.trim();
    if (text.includes("\n")) {
      const parts = text
        .split("\n")
        .map((s) => s.replace(/^[\d.、\s]+/, "").trim())
        .filter((s) => s.length > 5);
      if (parts.length > 0) return parts;
    }
    const parts = text
      .split(/[。；;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);
    if (parts.length > 0) return parts;
    return [text];
  }
  // 降级
  return [
    `准备申请材料`,
    `前往${policy.agency || "当地人社部门"}提交申请`,
    `等待审核结果`,
  ];
}

/**
 * V3 新增：生成申请材料清单（基于补贴类型）
 */
function generateRequiredDocuments(policy: Policy): string[] {
  const docs: string[] = ["身份证", "户口本"];
  const subsidyType = policy.subsidyType || "";
  const content = policy.content || "";

  if (/创业|创业担保|小微企业/.test(subsidyType)) {
    docs.push("营业执照", "创业计划书");
  }
  if (/培训|技能|实训/.test(subsidyType)) {
    docs.push("学历证明", "职业资格证书");
  }
  if (/社保|保险|参保/.test(subsidyType)) {
    docs.push("社保缴费证明");
  }
  if (/贷款|信贷|授信/.test(subsidyType)) {
    docs.push("收入证明", "银行流水");
  }
  if (/税收|减税|免税|退税/.test(subsidyType)) {
    docs.push("税务登记证", "纳税证明");
  }
  if (/见习|实习/.test(subsidyType)) {
    docs.push("毕业证", "就业失业登记证");
  }

  // 基于政策内容补充
  if (/营业执照/.test(content) && !docs.includes("营业执照")) {
    docs.push("营业执照");
  }
  if (/合同/.test(content) && !docs.includes("劳动合同")) {
    docs.push("劳动合同");
  }

  // 通用材料
  docs.push("申请表");

  return docs;
}

/**
 * V3 新增：生成办理地点（基于发文机构和适用地区）
 */
function generateApplyLocation(policy: Policy): string {
  const agency = policy.agency || "";
  const regions = policy.regions || [];

  // 国务院或全国性政策
  if (/国务院/.test(agency) || regions.includes("全国")) {
    return "当地人社局政务服务中心或线上办理（国家政务服务平台 si.12333.gov.cn）";
  }

  // 人社部门
  if (/人社|人力资源/.test(agency)) {
    const region = regions[0] || "当地";
    return `${region}人社局政务服务中心，或登录当地人社局官网线上申请`;
  }

  // 财政部门
  if (/财政/.test(agency)) {
    const region = regions[0] || "当地";
    return `${region}财政局或政务服务中心财政窗口`;
  }

  // 其他省级部门
  if (regions.length > 0 && regions[0] !== "全国") {
    return `${regions[0]}政务服务中心人社窗口`;
  }

  return "当地政务服务中心人社窗口";
}

/**
 * localStorage 缓存管理（V4：加 TTL 7 天 + 版本号 v2_）
 * 缓存结构：{ data: PolicyInterpretation, ts: number }
 */
const CACHE_PREFIX = "policylens_interpret_v2_";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 天，单位毫秒

export function getCachedInterpretation(policyId: string): PolicyInterpretation | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + policyId);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { data: PolicyInterpretation; ts: number } | PolicyInterpretation;

    // 兼容旧格式（无 ts 的纯 interpretation）
    if ("data" in cached && cached.data && typeof cached.ts === "number") {
      // 检查 TTL
      if (Date.now() - cached.ts > CACHE_TTL) {
        localStorage.removeItem(CACHE_PREFIX + policyId);
        return null;
      }
      return cached.data;
    }
    // 旧格式缓存，直接返回（但会被新写入覆盖）
    return cached as PolicyInterpretation;
  } catch {
    // localStorage 不可用或 JSON 解析失败
    return null;
  }
}

export function setCachedInterpretation(interpretation: PolicyInterpretation): void {
  try {
    const payload = {
      data: interpretation,
      ts: Date.now(),
    };
    localStorage.setItem(
      CACHE_PREFIX + interpretation.policyId,
      JSON.stringify(payload)
    );
  } catch {
    // localStorage 不可用时忽略
  }
}
