"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ClipboardList,
  Sparkles,
  Wallet,
  FileText,
  MapPin,
  ShieldCheck,
} from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      {/* 顶部导航 */}
      <nav className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
            <Sparkles size={18} />
          </div>
          <span className="font-bold text-gray-900">PolicyLens</span>
        </div>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors btn-press"
        >
          立即开始
        </Link>
      </nav>

      {/* Hero 区 */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium mb-6">
            就业政策 · 一键匹配
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            3 分钟知道你能享受
            <br />
            <span className="text-gradient">哪些就业政策补贴</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 mb-8 max-w-xl mx-auto">
            填写简单画像，AI 帮你从 51 条政策中找到最适合你的，翻译成大白话，告诉你怎么申请。
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-base font-medium shadow-lg shadow-emerald-500/25 transition-all btn-press"
          >
            立即开始
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </section>

      {/* 3 步说明 */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: ClipboardList,
              step: "1",
              title: "填写画像",
              desc: "身份、学历、地区，3 步搞定",
            },
            {
              icon: Sparkles,
              step: "2",
              title: "AI 匹配",
              desc: "智能匹配 + 大白话解读",
            },
            {
              icon: Wallet,
              step: "3",
              title: "查看补贴",
              desc: "能拿什么、去哪办、怎么领",
            },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * (i + 1) }}
              className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <item.icon size={20} />
                </div>
                <span className="text-2xl font-bold text-gray-200">{item.step}</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 数据亮点 */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-emerald-600">51</div>
              <div className="text-xs text-gray-500 mt-1">条政策</div>
            </div>
            <div className="border-x border-gray-100">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-600">31</div>
              <div className="text-xs text-gray-500 mt-1">个省份</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-emerald-600">AI</div>
              <div className="text-xs text-gray-500 mt-1">智能解读</div>
            </div>
          </div>
        </div>
      </section>

      {/* 功能亮点 */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
        <div className="space-y-3">
          {[
            {
              icon: FileText,
              title: "把政策翻译成大白话",
              desc: "AI 解读每条政策，告诉你为什么是你、能拿什么、怎么申请",
            },
            {
              icon: MapPin,
              title: "办理地点一键导航",
              desc: "集成地图，告诉你去哪办、带什么材料",
            },
            {
              icon: ShieldCheck,
              title: "官方入口 + 防骗警示",
              desc: "直达官方申报平台，提醒你警惕收费代办骗局",
            },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * (i + 1) }}
              className="flex items-start gap-4 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
                <item.icon size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-8 text-white shadow-lg"
        >
          <h2 className="text-2xl font-bold mb-3">现在就开始</h2>
          <p className="text-emerald-50 mb-6">3 分钟，找到属于你的政策补贴</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-white text-emerald-600 font-medium hover:bg-emerald-50 transition-colors btn-press"
          >
            立即开始
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-4 sm:px-6 pb-8 text-center">
        <p className="text-xs text-gray-400">
          PolicyLens · 就业政策智能解读器
        </p>
      </footer>
    </main>
  );
}
