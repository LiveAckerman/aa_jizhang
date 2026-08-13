---
name: ignore-asset-config-warning
description: User chose to ignore the generate-asset skill configuration warning for this session
metadata:
  type: feedback
---

用户在本次会话中选择「忽略」素材生成工具（generate-asset）的环境变量配置警告。

**Why:** 用户可能：
1. 暂时不需要生成图片素材
2. 稍后再配置环境变量
3. 使用其他方式获取素材

**How to apply:**
- 本次会话不再提醒用户配置环境变量
- 如果用户主动请求生成图片，仍然需要检查配置并提示
- 新会话开始时重置此状态，再次检查配置
