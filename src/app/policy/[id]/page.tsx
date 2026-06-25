import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  MapPin,
  Users,
  Wallet,
  ClipboardCheck,
  ExternalLink,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { getAllPolicies, getPolicyById } from "@/lib/data.server";
import { recommendSimilarPolicies } from "@/lib/recommender";
import PolicyDetailTracker from "@/components/PolicyDetailTracker";
import PolicyChat from "@/components/PolicyChat";

/**
 * 政策详情页（SSG）
 * 每条政策生成独立静态页面，便于 SEO 和分享
 */

// 仅允许 generateStaticParams 生成的路由，未知 id 直接 404
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPolicies().map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const policy = getPolicyById(id);
  if (!policy) {
    return {
      title: "政策未找到",
      description: "该政策不存在或已下线",
    };
  }

  const description = policy.summary.slice(0, 150);
  return {
    title: policy.title,
    description,
    alternates: { canonical: `/policy/${policy.id}` },
    openGraph: {
      title: policy.title,
      description,
      url: `/policy/${policy.id}`,
      type: "article",
      siteName: "PolicyLens",
    },
    twitter: {
      card: "summary",
      title: policy.title,
      description,
    },
  };
}

/**
 * 计算截止倒计时信息
 */
function getDeadlineInfo(deadline?: string): { label: string; color: string } | null {
  if (!deadline) return null;
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: "已截止", color: "#9ca3af" };
  }
  if (diffDays <= 30) {
    return { label: `还剩 ${diffDays} 天截止`, color: "#ef4444" };
  }
  if (diffDays <= 90) {
    return { label: `还剩 ${diffDays} 天截止`, color: "#f59e0b" };
  }
  return { label: `还剩 ${diffDays} 天`, color: "#10b981" };
}

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const policy = getPolicyById(id);
  if (!policy) {
    notFound();
  }

  const deadlineInfo = getDeadlineInfo(policy.deadline);
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://policylens.vercel.app";

  // JSON-LD 结构化数据（政策文档）
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    name: policy.title,
    description: policy.summary.slice(0, 200),
    url: `${baseUrl}/policy/${policy.id}`,
    serviceOperator: {
      "@type": "GovernmentOrganization",
      name: policy.agency,
    },
    datePublished: policy.publishDate,
    areaServed: policy.regions.map((r) => ({ "@type": "AdministrativeArea", name: r })),
    audience: policy.applicableGroups.map((g) => ({ "@type": "Audience", audienceType: g })),
  };

  // 政策正文按段落分割
  const paragraphs = policy.content.split(/\n+/).filter((p) => p.trim().length > 0);

  // 相似政策推荐
  const similarPolicies = recommendSimilarPolicies(getAllPolicies(), policy, 3);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-gray-50 outline-none"
    >
      <PolicyDetailTracker policyId={policy.id} />

      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-emerald-600 transition-colors"
          >
            <ArrowLeft size={16} />
            返回首页
          </Link>
          <span className="text-xs text-gray-400">PolicyLens · 政策详情</span>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-4 py-6 pb-20">
        {/* 标题区 */}
        <header className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
              <Building2 size={12} />
              {policy.agency}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">
              <Calendar size={12} />
              {policy.publishDate}
            </span>
            {policy.regions.map((region) => (
              <span
                key={region}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs"
              >
                <MapPin size={12} />
                {region}
              </span>
            ))}
            {deadlineInfo && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${deadlineInfo.color}15`,
                  color: deadlineInfo.color,
                }}
              >
                <Calendar size={12} />
                {deadlineInfo.label}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
            {policy.title}
          </h1>
        </header>

        {/* 政策正文 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ClipboardCheck size={18} className="text-emerald-600" />
            政策原文
          </h2>
          <div className="prose prose-sm max-w-none text-gray-700 space-y-3 leading-relaxed">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-wrap">
                {p}
              </p>
            ))}
          </div>
        </section>

        {/* 适用人群 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users size={18} className="text-emerald-600" />
            适用人群
          </h2>
          <div className="flex flex-wrap gap-2">
            {policy.applicableGroups.map((group) => (
              <span
                key={group}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm"
              >
                {group}
              </span>
            ))}
          </div>
        </section>

        {/* 补贴信息 */}
        <section className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Wallet size={18} />
            补贴信息
          </h2>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-emerald-100 mb-1">补贴类型</div>
              <div className="text-sm font-medium">{policy.subsidyType || "未明确"}</div>
            </div>
            <div>
              <div className="text-xs text-emerald-100 mb-1">补贴金额</div>
              <div className="text-lg font-bold">{policy.subsidyAmount || "未明确"}</div>
            </div>
          </div>
        </section>

        {/* 申请条件 */}
        {policy.requirements.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ClipboardCheck size={18} className="text-emerald-600" />
              申请条件
            </h2>
            <ul className="space-y-2">
              {policy.requirements.map((req, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                  {req}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* AI 智能追问 */}
        <PolicyChat policy={policy} />

        {/* 官方入口 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <ExternalLink size={18} className="text-emerald-600" />
            官方入口
          </h2>
          <a
            href={policy.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full px-4 py-3 rounded-xl border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors text-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-gray-700">查看政策原文</span>
              <ExternalLink size={14} className="text-gray-400" />
            </div>
            <div className="text-xs text-gray-400 mt-1 truncate">{policy.sourceUrl}</div>
          </a>
          {policy.applyUrl && (
            <a
              href={policy.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 transition-colors text-sm text-white"
            >
              <div className="flex items-center justify-between font-medium">
                <span>前往官方申报平台</span>
                <ExternalLink size={14} />
              </div>
              <div className="text-xs text-emerald-100 mt-1 truncate">{policy.applyUrl}</div>
            </a>
          )}
          {/* 防骗警示 */}
          <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <ShieldAlert size={14} className="flex-shrink-0 mt-0.5" />
            <span>任何收费代办、承诺包过均为骗局。请通过官方渠道申请，不向第三方支付任何费用。</span>
          </div>
        </section>

        {/* 相似政策推荐 */}
        {similarPolicies.length > 0 && (
          <section className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-600" />
              相似政策推荐
            </h2>
            <p className="text-xs text-gray-500 mb-4">同样面向该群体或地区的其他政策</p>
            <div className="space-y-2">
              {similarPolicies.map(({ policy: recPolicy, reason }) => (
                <Link
                  key={recPolicy.id}
                  href={`/policy/${recPolicy.id}`}
                  className="block w-full bg-white rounded-xl p-3 border border-gray-100 hover:border-indigo-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 leading-snug line-clamp-1 group-hover:text-indigo-600 transition-colors">
                        {recPolicy.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-2xs">
                          {reason}
                        </span>
                        {recPolicy.subsidyAmount && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-2xs">
                            {recPolicy.subsidyAmount.slice(0, 20)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ExternalLink
                      size={14}
                      className="text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1"
                    />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA：填画像看你能拿多少 */}
        <section className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg text-center">
          <Sparkles size={28} className="mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-2">想知道这条政策你能拿多少？</h2>
          <p className="text-sm text-emerald-100 mb-4">
            填写你的画像，AI 帮你智能匹配并解读你符合的所有政策
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-emerald-600 font-medium hover:bg-emerald-50 transition-colors"
          >
            立即开始匹配
          </Link>
        </section>
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
