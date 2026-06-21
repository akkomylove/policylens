"use client";

import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import {
  IdentityType,
  EducationLevel,
  EmploymentStatus,
  IndustryIntent,
} from "@/types/policy";

const IDENTITIES: IdentityType[] = [
  "应届毕业生",
  "往届毕业生",
  "退役军人",
  "返乡创业者",
  "灵活就业人员",
  "在职人员",
  "失业人员",
  "农民工",
];

const EDUCATIONS: EducationLevel[] = ["高中及以下", "大专", "本科", "硕士", "博士"];

const STATUSES: EmploymentStatus[] = ["求职中", "已就业", "创业中", "待业"];

const INDUSTRIES: IndustryIntent[] = [
  "不限",
  "制造业",
  "互联网",
  "农业",
  "服务业",
  "金融业",
  "教育",
  "医疗",
];

const PROVINCES = [
  "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江",
  "上海", "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南",
  "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川", "贵州",
  "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆",
];

// ============ 搜索式省份选择器 ============
function SearchableProvinceSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (province: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = PROVINCES.filter((p) =>
    p.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:outline-none text-left text-gray-900 flex items-center justify-between"
      >
        <span>{value || "请选择省份"}</span>
        <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索省份..."
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-400">
                未找到匹配省份
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    onChange(p);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-emerald-50 transition-colors ${
                    value === p ? "bg-emerald-50 text-emerald-700 font-medium" : "text-gray-700"
                  }`}
                >
                  {p}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ 城市级联选择器 ============
function CitySelect({
  province,
  value,
  onChange,
}: {
  province: string;
  value: string;
  onChange: (city: string) => void;
}) {
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!province) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCities([]);
      return;
    }
    setLoading(true);
    fetch("/data/cities.json")
      .then((res) => res.json())
      .then((data) => {
        setCities(data[province] || []);
        setLoading(false);
      })
      .catch(() => {
        setCities([]);
        setLoading(false);
      });
  }, [province]);

  if (!province) {
    return (
      <select
        disabled
        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-400"
      >
        <option>请先选择省份</option>
      </select>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:outline-none text-gray-900"
    >
      <option value="">不限城市</option>
      {cities.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

export default function ProfileForm() {
  const { userProfile, updateUserProfile, currentStep, setCurrentStep } = useAppStore();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 0) {
      if (!userProfile.identity) newErrors.identity = "请选择身份类型";
      if (!userProfile.education) newErrors.education = "请选择学历";
    }
    if (step === 1) {
      if (!userProfile.province) newErrors.province = "请选择省份";
      if (!userProfile.employmentStatus) newErrors.employmentStatus = "请选择就业状态";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(Math.max(0, currentStep - 1));
  };

  const handleSubmit = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(3); // 进入结果页
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-center mb-8 gap-2">
        {[0, 1, 2].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                currentStep >= step
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {step + 1}
            </div>
            {step < 2 && (
              <div
                className={`w-16 h-0.5 mx-1 ${
                  currentStep > step ? "bg-emerald-500" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* 步骤内容 */}
      <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-gray-100">
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">你的身份</h2>
              <p className="text-sm text-gray-500">选择最符合你的身份类型</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                身份类型
              </label>
              <div className="grid grid-cols-2 gap-3">
                {IDENTITIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => updateUserProfile({ identity: item })}
                    className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all min-h-[44px] ${
                      userProfile.identity === item
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 hover:border-emerald-300 text-gray-700"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              {errors.identity && (
                <p className="text-red-500 text-xs mt-2">{errors.identity}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                最高学历
              </label>
              <div className="grid grid-cols-5 gap-2">
                {EDUCATIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => updateUserProfile({ education: item })}
                    className={`px-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all min-h-[44px] ${
                      userProfile.education === item
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 hover:border-emerald-300 text-gray-700"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              {errors.education && (
                <p className="text-red-500 text-xs mt-2">{errors.education}</p>
              )}
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">你在哪里</h2>
              <p className="text-sm text-gray-500">不同地区的政策有所不同</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                所在省份
              </label>
              <SearchableProvinceSelect
                value={userProfile.province}
                onChange={(province) =>
                  updateUserProfile({
                    province,
                    city: "", // 切换省份时清空城市
                  })
                }
              />
              {errors.province && (
                <p className="text-red-500 text-xs mt-2">{errors.province}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                所在城市（可选）
              </label>
              <CitySelect
                province={userProfile.province}
                value={userProfile.city && userProfile.city !== userProfile.province ? userProfile.city : ""}
                onChange={(city) => updateUserProfile({ city })}
              />
              <p className="text-xs text-gray-400 mt-1.5">
                选择城市可获得更精准的政策匹配
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                就业状态
              </label>
              <div className="grid grid-cols-4 gap-2">
                {STATUSES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => updateUserProfile({ employmentStatus: item })}
                    className={`px-2 py-3 rounded-xl border-2 text-sm font-medium transition-all min-h-[44px] ${
                      userProfile.employmentStatus === item
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 hover:border-emerald-300 text-gray-700"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              {errors.employmentStatus && (
                <p className="text-red-500 text-xs mt-2">{errors.employmentStatus}</p>
              )}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">你的意向</h2>
              <p className="text-sm text-gray-500">选择你感兴趣的行业（可选）</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                行业意向
              </label>
              <div className="grid grid-cols-4 gap-2">
                {INDUSTRIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => updateUserProfile({ industryIntent: item })}
                    className={`px-2 py-3 rounded-xl border-2 text-sm font-medium transition-all min-h-[44px] ${
                      userProfile.industryIntent === item
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 hover:border-emerald-300 text-gray-700"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* 画像预览 */}
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <h3 className="text-sm font-medium text-emerald-800 mb-2">你的画像</h3>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-white rounded-full text-xs text-gray-700">
                  {userProfile.identity}
                </span>
                <span className="px-3 py-1 bg-white rounded-full text-xs text-gray-700">
                  {userProfile.education}
                </span>
                <span className="px-3 py-1 bg-white rounded-full text-xs text-gray-700">
                  {userProfile.province}
                  {userProfile.city && userProfile.city !== userProfile.province
                    ? ` ${userProfile.city}`
                    : ""}
                </span>
                <span className="px-3 py-1 bg-white rounded-full text-xs text-gray-700">
                  {userProfile.employmentStatus}
                </span>
                {userProfile.industryIntent && userProfile.industryIntent !== "不限" && (
                  <span className="px-3 py-1 bg-white rounded-full text-xs text-gray-700">
                    {userProfile.industryIntent}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 导航按钮 */}
        <div className="flex justify-between mt-8">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 0}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            上一步
          </button>
          {currentStep < 2 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-8 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors min-h-[44px]"
            >
              下一步
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="px-8 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors min-h-[44px]"
            >
              查看匹配结果
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
