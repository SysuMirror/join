# 2026-09-05 首页 LineOrb 简笔 logo：改为等距立方体

## 背景

`HomeView.vue` 首页 hero 区域的 `LineOrb` 组件在圆圈内绘制一笔画简笔 logo。用户反馈「形状不一致」，并最终明确要求**画一个正方体（等距立方体）**。

## 最终方案：等距立方体（立方体一角朝前）

用户明确「要不你画个正方体吧」。因此放弃六边形螺旋方案，改为标准**等距立方体线框**：
- 外轮廓：尖顶六边形（上尖 T / 下尖 B / 左右垂直棱）
- 中心 M：离观察者最近的顶点，向外连三条棱到上、左下、右下三个顶点 → `Y` 型立体感
- 一笔画路径：外轮廓一圈 → 回 T → 垂直下到中心 → 辐条到 RB → 回中心 → 辐条到 LB

`web/src/components/LineOrb.vue` 的 `buildLogoPath()`：
```ts
function buildLogoPath(): [number, number][] {
  const w = 1
  const h = 2 / Math.sqrt(3) // 尖顶六边形半高，宽高比 √3/2 ≈ 0.866
  const T: [number, number] = [0, -h] // 上尖
  const R: [number, number] = [w, -h / 2] // 右上
  const RB: [number, number] = [w, h / 2] // 右下
  const B: [number, number] = [0, h] // 下尖
  const LB: [number, number] = [-w, h / 2] // 左下
  const L: [number, number] = [-w, -h / 2] // 左上
  const M: [number, number] = [0, 0] // 中心（近角）
  return [T, R, RB, B, LB, L, T, M, RB, M, LB] // 一笔画
}
```

## 验证方法

本机浏览器截图/画布导出部分不可靠，采用两步：
1. **Node 栅格化**：复刻同款路径，栅格化后用 ASCII 字符画确认轮廓 = 六边形 + 中心 Y 型三条棱。
2. **实际渲染验证**：在首页 Vite 页面通过 CDP 取 `LineOrb` 画布 `toDataURL`，用 `pngjs` 分析，得到 width=550、bbox aspect≈1.03，ASCII 清晰呈现「六边形外轮廓 + 中心 Y」——确认组件已实际渲染立方体。

## 清理

调试临时脚本已删除：`verify-cube.cjs`、`read-snap.cjs` 等。此前批量删除的调试文件见上一版笔记。

## 未决/注意

- `web` 目录 `npm run build` 通过，无类型错误。
- 画布蓝 bbox 检测为 0%：logo 颜色当前是灰调 `#7b8087`，非蓝色，故蓝色检测失败——用通用墨迹检测（非白非透明）正确捕捉到轮廓。
- `LineOrb` 的 `:size` 随 `orbSize`（桌面 440 / 窄屏 280）缩放，logo 按 `R*0.47` 自适应。
- dev server 在 `http://localhost:5175/`，改完路径后按 F5 刷新即可看到立方体。
