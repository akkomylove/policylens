"""
PolicyLens policies.json 数据扩展脚本
为每条政策补充 deadline（申报截止日期）和 successCount（同类用户申请数）字段
"""
import json
import re
import random
from datetime import datetime, timedelta

# 使用 raw string 处理 Windows 路径
POLICIES_PATH = r"d:\trae比赛\policylens\public\data\policies.json"

def extract_amount(amount_str):
    """简化版补贴金额提取（万元），复刻 scoreCalculator.ts 的核心逻辑"""
    if not amount_str:
        return 0.0

    total = 0.0
    matched_ranges = []

    def is_overlapping(start, end):
        for s, e in matched_ranges:
            if start < e and end > s:
                return True
        return False

    def mark_range(start, end):
        matched_ranges.append((start, end))

    # 1. "XX-XX万元/年" 范围（取最大值）
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*[-—]\s*(\d+(?:\.\d+)?)\s*万元\s*/\s*年", amount_str):
        total += float(m.group(2))
        mark_range(m.start(), m.end())

    # 2. "XX-XX万元" 范围（取最大值，排除"万人次"和"/年"）
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*[-—]\s*(\d+(?:\.\d+)?)\s*万元(?!次|/年)", amount_str):
        if not is_overlapping(m.start(), m.end()):
            total += float(m.group(2))
            mark_range(m.start(), m.end())

    # 3. "最高XX万元" / "不超过XX万元"
    for m in re.finditer(r"(?:最高|不超过|至多)\s*(\d+(?:\.\d+)?)\s*万元(?!次)", amount_str):
        if not is_overlapping(m.start(), m.end()):
            total += float(m.group(1))
            mark_range(m.start(), m.end())

    # 4. "XX万元/年"（排除"万人次"）
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*万元\s*/\s*年", amount_str):
        if not is_overlapping(m.start(), m.end()):
            total += float(m.group(1))
            mark_range(m.start(), m.end())

    # 5. "XX万元"（排除"万人次"、"/年"、范围、最高/不超过）
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*万元(?!次|/年)", amount_str):
        if not is_overlapping(m.start(), m.end()):
            total += float(m.group(1))
            mark_range(m.start(), m.end())

    # 6. "XXX-XXX元/人" 范围（取最大值）
    for m in re.finditer(r"(\d+)\s*[-—]\s*(\d+)\s*元\s*/\s*人(?!次)", amount_str):
        if not is_overlapping(m.start(), m.end()):
            total += float(m.group(2)) / 10000
            mark_range(m.start(), m.end())

    # 7. "XXX元/人"（排除"人次"）
    for m in re.finditer(r"(\d+(?:[,，]\d+)*)\s*元\s*/\s*人(?!次)", amount_str):
        if not is_overlapping(m.start(), m.end()):
            value = float(m.group(1).replace(",", "").replace("，", ""))
            total += value / 10000
            mark_range(m.start(), m.end())

    # 8. 兜底：单独的"XXX元"
    if total == 0:
        for m in re.finditer(r"(\d+(?:[,，]\d+)*)\s*元(?!次|/人)", amount_str):
            value = float(m.group(1).replace(",", "").replace("，", ""))
            if value >= 100:
                total += value / 10000

    return total


def main():
    # 读取 policies.json
    with open(POLICIES_PATH, "r", encoding="utf-8") as f:
        policies = json.load(f)

    print(f"读取到 {len(policies)} 条政策")

    # 固定随机种子，保证可复现
    random.seed(42)

    for i, p in enumerate(policies):
        # 补充 deadline 字段
        if "deadline" not in p or not p["deadline"]:
            publish_date = datetime.strptime(p["publishDate"], "%Y-%m-%d")
            # 80% 政策设为 6 个月后，10% 设为 3 个月后（即将截止），10% 设为已过期
            if i % 10 == 0:
                deadline = publish_date + timedelta(days=90)  # 3个月（即将截止）
            elif i % 10 == 1:
                deadline = publish_date - timedelta(days=30)  # 已过期
            else:
                deadline = publish_date + timedelta(days=180)  # 6个月
            p["deadline"] = deadline.strftime("%Y-%m-%d")

        # 补充 successCount 字段
        if "successCount" not in p:
            amount = extract_amount(p.get("subsidyAmount", ""))
            # 基于补贴金额生成（金额越高越热门）
            if amount > 20:
                p["successCount"] = random.randint(300, 500)
            elif amount > 5:
                p["successCount"] = random.randint(150, 300)
            elif amount > 0:
                p["successCount"] = random.randint(80, 150)
            else:
                p["successCount"] = random.randint(50, 100)

    # 写回 policies.json
    with open(POLICIES_PATH, "w", encoding="utf-8") as f:
        json.dump(policies, f, ensure_ascii=False, indent=2)

    print(f"已为 {len(policies)} 条政策补充 deadline + successCount 字段")

    # 验证：打印前 3 条
    print("\n前 3 条政策示例：")
    for p in policies[:3]:
        print(f"  - {p['title'][:30]}...")
        print(f"    publishDate: {p['publishDate']}, deadline: {p['deadline']}, successCount: {p['successCount']}")

    # 统计：即将截止（30天内）和已过期的数量
    now = datetime.now().strftime("%Y-%m-%d")
    expiring_soon = sum(1 for p in policies if p["deadline"] > now and
                        (datetime.strptime(p["deadline"], "%Y-%m-%d") - datetime.now()).days <= 30)
    expired = sum(1 for p in policies if p["deadline"] < now)
    print(f"\n统计：即将截止（30天内）{expiring_soon} 条，已过期 {expired} 条")


if __name__ == "__main__":
    main()
