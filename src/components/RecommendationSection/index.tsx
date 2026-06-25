"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Sparkles, ArrowRight, Users } from "lucide-react";
import { Policy, UserProfile, MatchedPolicy } from "@/types/policy";
import { recommendByUserProfile, RecommendedPolicy } from "@/lib/recommender";

interface RecommendationSectionProps {
  allPolicies: Policy[];
  matchedPolicies: MatchedPolicy[];
  userProfile: UserProfile;
}

/**
 * 个性化推荐区块
 * 基于用户画像推荐未匹配的政策
 */
export default function RecommendationSection({
  allPolicies,
  matchedPolicies,
  userProfile,
}: RecommendationSectionProps) {
  const recommendations = useMemo<RecommendedPolicy[]>(() => {
    return recommendByUserProfile(allPolicies, matchedPolicies, userProfile, 3);
  }, [allPolicies, matchedPolicies, userProfile]);

  if (recommendations.length === 0) return null;

  return (
    <section className="mt-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={18} className="text-indigo-600" />
        <h2 className="text-base font-semibold text-gray-900">你可能也感兴趣</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        基于你的画像（{userProfile.identity}·{userProfile.province}），这些政策你也可能符合
      </p>

      <div className="space-y-2">
        {recommendations.map(({ policy, reason }) => (
          <Link
            key={policy.id}
            href={`/policy/${policy.id}`}
            className="block w-full bg-white rounded-xl p-3 border border-gray-100 hover:border-indigo-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 leading-snug line-clamp-1 group-hover:text-indigo-600 transition-colors">
                  {policy.title}
                </h3>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-2xs">
                    <Users size={10} />
                    {reason}
                  </span>
                  {policy.subsidyAmount && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-2xs">
                      {policy.subsidyAmount.slice(0, 20)}
                    </span>
                  )}
                </div>
              </div>
              <ArrowRight
                size={14}
                className="text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1"
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
