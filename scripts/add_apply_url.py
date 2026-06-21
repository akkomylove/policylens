"""
为 policies.json 批量补充 applyUrl 字段（官方申报入口）
基于 agency 和 regions 字段推断
"""
import json
import re
from pathlib import Path

POLICIES_PATH = Path(r"d:\trae比赛\policylens\public\data\policies.json")

def generate_apply_url(policy):
    """基于 agency 和 regions 生成 applyUrl"""
    agency = policy.get("agency", "")
    regions = policy.get("regions", [])
    subsidy_type = policy.get("subsidyType", "")
    content = policy.get("content", "")

    # 国家级政策
    if "国务院" in agency or "全国" in regions:
        return "https://si.12333.gov.cn/"

    # 人社部
    if "人力资源" in agency or "人社" in agency:
        # 创业担保贷款
        if "创业担保贷款" in subsidy_type or "创业担保贷款" in content:
            return "https://si.12333.gov.cn/"
        # 社保补贴
        if "社保" in subsidy_type or "社会保险" in subsidy_type:
            return "https://si.12333.gov.cn/"
        # 通用
        return "https://si.12333.gov.cn/"

    # 财政部
    if "财政" in agency:
        return "https://www.mof.gov.cn/"

    # 省级政策：基于 region 推断省级政务服务平台
    if regions and regions[0] != "全国":
        region = regions[0]
        # 各省政务服务平台 URL 映射
        province_urls = {
            "北京": "https://banshi.beijing.gov.cn/",
            "上海": "https://zwdt.sh.gov.cn/",
            "广东": "https://www.gdzwfw.gov.cn/",
            "江苏": "https://www.jszwfw.gov.cn/",
            "浙江": "https://www.zjzwfw.gov.cn/",
            "山东": "http://www.shandong.gov.cn/",
            "河南": "https://www.hnzwfw.gov.cn/",
            "四川": "https://www.sczwfw.gov.cn/",
            "湖北": "https://zwfw.hubei.gov.cn/",
            "湖南": "https://zwfw-new.hunan.gov.cn/",
            "福建": "https://zwfw.fujian.gov.cn/",
            "安徽": "https://www.ahzwfw.gov.cn/",
            "辽宁": "https://www.lnzwfw.gov.cn/",
            "陕西": "http://zwfw.shaanxi.gov.cn/",
            "重庆": "https://zwykb.cq.gov.cn/",
            "天津": "https://zwfw.tj.gov.cn/",
            "云南": "https://zwfw.yn.gov.cn/",
            "广西": "http://zwfw.gxzf.gov.cn/",
            "江西": "http://www.jxzwfww.gov.cn/",
            "河北": "http://www.hebzwfw.gov.cn/",
            "山西": "http://www.sxzwfw.gov.cn/",
            "吉林": "http://zw.jl.gov.cn/",
            "黑龙江": "https://zwfw.hlj.gov.cn/",
            "贵州": "https://zwfw.guizhou.gov.cn/",
            "甘肃": "https://zwfw.gansu.gov.cn/",
            "海南": "https://wssp.hainan.gov.cn/",
            "内蒙古": "https://zwfw.nmg.gov.cn/",
            "宁夏": "https://zwfw.nx.gov.cn/",
            "青海": "http://zwfwj.qinghai.gov.cn/",
            "新疆": "https://zwfw.xinjiang.gov.cn/",
            "西藏": "http://zwfw.xizang.gov.cn/",
        }
        for prov, url in province_urls.items():
            if prov in region:
                return url

    return "https://si.12333.gov.cn/"


def main():
    with open(POLICIES_PATH, "r", encoding="utf-8") as f:
        policies = json.load(f)

    print(f"读取 {len(policies)} 条政策")

    updated = 0
    for policy in policies:
        if "applyUrl" not in policy or not policy["applyUrl"]:
            policy["applyUrl"] = generate_apply_url(policy)
            updated += 1

    with open(POLICIES_PATH, "w", encoding="utf-8") as f:
        json.dump(policies, f, ensure_ascii=False, indent=2)

    print(f"已为 {updated} 条政策补充 applyUrl")
    print(f"总计 {len(policies)} 条政策")

    # 统计分布
    from collections import Counter
    url_dist = Counter(p.get("applyUrl", "") for p in policies)
    print("\napplyUrl 分布：")
    for url, count in url_dist.most_common(10):
        print(f"  {url}: {count}")


if __name__ == "__main__":
    main()
