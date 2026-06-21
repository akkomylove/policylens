"""
PolicyLens policies.json deadline 重新生成脚本
基于当前时间生成合理的 deadline 分布：
- 70% 政策设为当前时间 + 3-6 个月（正常）
- 15% 政策设为当前时间 + 7-30 天（即将截止）
- 15% 政策设为当前时间 - 30 天（已过期）
"""
import json
import random
from datetime import datetime, timedelta

POLICIES_PATH = r"d:\trae比赛\policylens\public\data\policies.json"

def main():
    with open(POLICIES_PATH, "r", encoding="utf-8") as f:
        policies = json.load(f)

    print(f"读取到 {len(policies)} 条政策")

    random.seed(42)
    now = datetime.now()
    print(f"当前时间: {now.strftime('%Y-%m-%d')}")

    # 重新生成所有 deadline（基于当前时间）
    for i, p in enumerate(policies):
        # 强制重新生成 deadline
        r = random.random()
        if r < 0.15:
            # 15% 已过期（1-30天前）
            deadline = now - timedelta(days=random.randint(1, 30))
        elif r < 0.30:
            # 15% 即将截止（7-30天后）
            deadline = now + timedelta(days=random.randint(7, 30))
        else:
            # 70% 正常（3-6个月后）
            deadline = now + timedelta(days=random.randint(90, 180))
        p["deadline"] = deadline.strftime("%Y-%m-%d")

    # 写回 policies.json
    with open(POLICIES_PATH, "w", encoding="utf-8") as f:
        json.dump(policies, f, ensure_ascii=False, indent=2)

    print(f"已重新生成 {len(policies)} 条政策的 deadline")

    # 统计
    expired = sum(1 for p in policies if p["deadline"] < now.strftime("%Y-%m-%d"))
    expiring_soon = sum(1 for p in policies if p["deadline"] >= now.strftime("%Y-%m-%d") and
                        (datetime.strptime(p["deadline"], "%Y-%m-%d") - now).days <= 30)
    active = len(policies) - expired - expiring_soon
    print(f"\n统计：正常 {active} 条，即将截止(30天内) {expiring_soon} 条，已过期 {expired} 条")

    # 打印前 5 条示例
    print("\n前 5 条政策示例：")
    for p in policies[:5]:
        days_left = (datetime.strptime(p["deadline"], "%Y-%m-%d") - now).days
        status = "已过期" if days_left < 0 else ("即将截止" if days_left <= 30 else "正常")
        print(f"  - {p['title'][:30]}...")
        print(f"    publishDate: {p['publishDate']}, deadline: {p['deadline']}, days_left: {days_left} ({status}), successCount: {p.get('successCount', 'N/A')}")


if __name__ == "__main__":
    main()
