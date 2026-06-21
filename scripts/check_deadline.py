"""临时检查脚本"""
import json
from datetime import datetime

POLICIES_PATH = r"d:\trae比赛\policylens\public\data\policies.json"

with open(POLICIES_PATH, "r", encoding="utf-8") as f:
    policies = json.load(f)

now = datetime.now()
print(f"当前时间: {now.strftime('%Y-%m-%d')}")
print(f"总政策数: {len(policies)}")

# 统计 publishDate 分布
years = {}
for p in policies:
    y = p["publishDate"][:4]
    years[y] = years.get(y, 0) + 1
print(f"publishDate 年份分布: {years}")

# 统计 deadline 分布
expired = []
expiring_soon = []  # 30天内
active = []
for p in policies:
    deadline = datetime.strptime(p["deadline"], "%Y-%m-%d")
    days_left = (deadline - now).days
    if days_left < 0:
        expired.append((p, days_left))
    elif days_left <= 30:
        expiring_soon.append((p, days_left))
    else:
        active.append((p, days_left))

print(f"\n已过期: {len(expired)} 条")
print(f"即将截止(30天内): {len(expiring_soon)} 条")
print(f"正常: {len(active)} 条")

print("\n已过期政策前 5 条:")
for p, days in expired[:5]:
    print(f"  publishDate={p['publishDate']}, deadline={p['deadline']}, days_left={days}, title={p['title'][:30]}")

print("\n即将截止政策:")
for p, days in expiring_soon:
    print(f"  publishDate={p['publishDate']}, deadline={p['deadline']}, days_left={days}, title={p['title'][:30]}")
