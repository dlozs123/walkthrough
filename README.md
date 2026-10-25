# 轨迹系列攻略 · 手机离线阅读版

《英雄传说》轨迹系列（零之轨迹改 / 碧之轨迹改 / 闪之轨迹 I–IV）完美攻略的静态阅读站，
为手机上阅读重新排版：无 App 跳转、无广告、无登录，图片本地化，弱网也能翻。

- 站点：<https://wt.flan.uno>
- 结构：`index.html` 目录页 + `p/cv*.html` 单篇 + `img/*.webp` 配图

## 内容来源

原文来自 B 站文集 [英雄传说：轨迹系列攻略](https://www.bilibili.com/read/readlist/rl540438)，
作者 **浅闻小鉴攻略组**（夏浅线、箫笙、Lip 等）。

本仓库仅为个人阅读用途的排版转存，**内容版权归原作者所有**，不作任何商用。
如需转载请回到 B 站原文支持作者。

## 技术说明

- 数据不是抓 HTML 正文，而是解析页面内 `__INITIAL_STATE__` 的结构化段落
  （`MODULE_TYPE_CONTENT.paragraphs`），因此图片、标题、分隔符都能保留。
- 图片走 B 站图床的 `@1000w.webp` 缩放参数下载，原图 6.8 GB → 约 280 MB。
- 纯静态，无构建依赖；`.nojekyll` 跳过 GitHub Pages 的 Jekyll 处理。
