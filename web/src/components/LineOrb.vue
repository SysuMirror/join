<template>
  <canvas ref="cv" class="line-orb" :style="{ width: size + 'px', height: size + 'px' }" aria-hidden="true" />
</template>

<script setup lang="ts">
/**
 * LineOrb —— 还原腾讯混元 (hy.tencent.com) 首页的「线条球」图案：
 * 一团大圆上的极细弧线，围绕圆心缓慢旋转、各自相位呼吸，
 * 视觉上形成莫尔条纹般的流动感。纯黑白灰，无填充。
 *
 * 圆心简笔 logo（一笔画）：外圈六边形起笔，向内盘旋两圈，
 * 圈底逐层堆叠成 V，顶部以小钩收笔 —— 对齐参考 logo（等距立方体螺旋）。
 * 全部顶点做圆角平滑；动画为一支笔从顶点起笔沿路径连续描绘至收笔。
 */
import { onMounted, onUnmounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 画布 CSS 尺寸（正方形） */
    size?: number
    /** 线条数量 */
    lines?: number
    /** 线条基础透明度（叠加后变深） */
    alpha?: number
    /** 旋转速度（弧度/秒） */
    speed?: number
    /** 是否在圆心绘制简笔 logo */
    showLogo?: boolean
    /** 简笔 logo 线条颜色（灰调） */
    logoColor?: string
  }>(),
  { size: 420, lines: 72, alpha: 0.15, speed: 0.1, showLogo: true, logoColor: '#7b8087' },
)

const cv = ref<HTMLCanvasElement | null>(null)
let raf = 0
let running = true
/** 入场生长进度 0→1（约 2.6s），线条由内向外依次展开 */
let intro = 0
const INTRO_DURATION = 2600
/** logo 起笔时间与描绘时长（ms） */
const LOGO_START = 900
const LOGO_DURATION = 2800

// 每条线的独立参数（生成一次，避免每帧随机抖动）
type Lane = {
  rx: number
  ry: number
  phase: number
  breathe: number
  a: number
  w: number
}

function makeLanes(n: number): Lane[] {
  const lanes: Lane[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    lanes.push({
      rx: 0.55 + 0.45 * t + (Math.random() - 0.5) * 0.015,
      ry: 0.55 + 0.45 * t + (Math.random() - 0.5) * 0.015,
      phase: (t * Math.PI) / 2 + Math.random() * 0.2,
      breathe: 0.015 + Math.random() * 0.02,
      a: 0.6 + Math.random() * 0.4,
      w: Math.random() < 0.12 ? 1.2 : 0.7,
    })
  }
  return lanes
}

/** smoothstep：0→1，两端圆滑 */
function smooth(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

/**
 * 简笔 logo 控制点（单位坐标，y 向下为正）—— 等距立方体（正方体）线框。
 * 「一角朝前」的等距投影：外轮廓为尖顶六边形（上尖 T / 下尖 B / 左右垂直棱），
 * 中心 M 为离观察者最近的顶点，向外连三条棱到上、左下、右下三个顶点 → 立体感。
 * 一笔画路径：沿外轮廓绕一圈回 T，再垂直下到中心，分别向 RB、LB 画两条辐条。
 */
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
  // 一笔画：外轮廓一圈 → 回 T → 下到中心 → 辐条到 RB → 回中心 → 辐条到 LB
  return [T, R, RB, B, LB, L, T, M, RB, M, LB]
}

const LOGO_PATH = buildLogoPath()

type Pt = { x: number; y: number }
let logoPts: Pt[] = []
let logoCum: number[] = []
let logoTotal = 0
let logoBuiltFor = 0

/**
 * 按 u（外接圆半径像素）构建「圆角加密」折线：
 * 每个顶点用二次贝塞尔做圆角（半径 0.09u，按邻边长度自适应截断），
 * 曲线细分采样成密集点列 —— 既用于描边渲染，也用于笔尖弧长定位。
 */
function ensureLogoBuilt(u: number) {
  if (logoBuiltFor === u) return
  logoBuiltFor = u
  const raw = LOGO_PATH.map(([x, y]) => ({ x: x * u, y: y * u }))
  const R = 0.09 * u
  const out: Pt[] = [raw[0]]
  const qbez = (a: Pt, c: Pt, b: Pt, t: number): Pt => ({
    x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
    y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
  })
  for (let i = 1; i < raw.length - 1; i++) {
    const p = raw[i - 1]
    const v = raw[i]
    const n = raw[i + 1]
    const d1 = Math.hypot(v.x - p.x, v.y - p.y) || 1
    const d2 = Math.hypot(n.x - v.x, n.y - v.y) || 1
    const r1 = Math.min(R, d1 * 0.45)
    const r2 = Math.min(R, d2 * 0.45)
    const inP = { x: v.x - ((v.x - p.x) / d1) * r1, y: v.y - ((v.y - p.y) / d1) * r1 }
    const outP = { x: v.x + ((n.x - v.x) / d2) * r2, y: v.y + ((n.y - v.y) / d2) * r2 }
    out.push(inP)
    for (let s = 1; s <= 6; s++) out.push(qbez(inP, v, outP, s / 7))
  }
  out.push(raw[raw.length - 1])
  logoPts = out
  logoCum = [0]
  for (let i = 1; i < logoPts.length; i++) {
    logoCum.push(logoCum[i - 1] + Math.hypot(logoPts[i].x - logoPts[i - 1].x, logoPts[i].y - logoPts[i - 1].y))
  }
  logoTotal = logoCum[logoCum.length - 1]
}

/** 弧长定位：返回距起点 len 处的坐标（笔尖位置） */
function pointAtLength(len: number): Pt {
  for (let i = 1; i < logoCum.length; i++) {
    if (logoCum[i] >= len) {
      const t = (len - logoCum[i - 1]) / (logoCum[i] - logoCum[i - 1] || 1)
      return {
        x: logoPts[i - 1].x + (logoPts[i].x - logoPts[i - 1].x) * t,
        y: logoPts[i - 1].y + (logoPts[i].y - logoPts[i - 1].y) * t,
      }
    }
  }
  return logoPts[logoPts.length - 1]
}

let lanes: Lane[] = []
let startTime = 0

function draw(time: number) {
  const canvas = cv.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const cssSize = props.size
  if (canvas.width !== cssSize * dpr) {
    canvas.width = cssSize * dpr
    canvas.height = cssSize * dpr
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssSize, cssSize)

  const cx = cssSize / 2
  const cy = cssSize / 2
  const R = cssSize * 0.46
  const t = time / 1000

  // 入场生长：easeOutCubic
  if (intro < 1) {
    intro = Math.min(1, (time - startTime) / INTRO_DURATION)
    intro = 1 - Math.pow(1 - intro, 3)
  }

  ctx.strokeStyle = '#111111'
  ctx.lineCap = 'round'

  for (const lane of lanes) {
    const wob = Math.sin(t * 0.6 + lane.phase) * lane.breathe
    const laneStart = (lane.rx - 0.55) / 0.45
    const laneProgress = smooth((intro - laneStart * 0.5) / 0.5)
    if (laneProgress <= 0) continue

    const grow = 0.55 + 0.45 * laneProgress
    const rx = lane.rx * R * grow * (1 + wob)
    const ry = lane.ry * R * grow * (1 - wob)
    const rot = t * props.speed + lane.phase * 0.35

    ctx.globalAlpha = props.alpha * lane.a * laneProgress
    ctx.lineWidth = lane.w
    ctx.beginPath()
    ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), rot, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // 简笔 logo：一笔画描绘（起笔于外圈顶点，螺旋向内，收笔小卷）
  if (props.showLogo) {
    const q = smooth((time - startTime - LOGO_START) / LOGO_DURATION)
    if (q > 0) drawLogo(ctx, cx, cy, R * 0.47, q)
  }
}

/** 一笔画 logo：dash 渐描绘 + 笔尖圆点（模拟「笔」沿路径行进） */
function drawLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number, q: number) {
  ensureLogoBuilt(u)
  const lw = Math.max(u * 0.055, 1.6)

  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = props.logoColor
  ctx.fillStyle = props.logoColor
  ctx.lineWidth = lw
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // 渐描绘：q=0 不显示，q=1 全部画完（路径从起点向终点生长）
  ctx.setLineDash([logoTotal, logoTotal])
  ctx.lineDashOffset = logoTotal * (1 - q)
  ctx.beginPath()
  ctx.moveTo(logoPts[0].x, logoPts[0].y)
  for (let i = 1; i < logoPts.length; i++) ctx.lineTo(logoPts[i].x, logoPts[i].y)
  ctx.stroke()
  ctx.setLineDash([])

  // 笔尖：描绘中在笔画末端画一个小圆点
  if (q < 1) {
    const tip = pointAtLength(logoTotal * q)
    ctx.beginPath()
    ctx.arc(tip.x, tip.y, lw * 0.72, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function loop(time: number) {
  if (!running) return
  if (!startTime) startTime = time
  draw(time)
  raf = requestAnimationFrame(loop)
}

function onVisibility() {
  if (document.hidden) {
    running = false
    cancelAnimationFrame(raf)
  } else if (!running) {
    running = true
    raf = requestAnimationFrame(loop)
  }
}

onMounted(() => {
  lanes = makeLanes(props.lines)
  raf = requestAnimationFrame(loop)
  document.addEventListener('visibilitychange', onVisibility)
})

onUnmounted(() => {
  running = false
  cancelAnimationFrame(raf)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style scoped>
.line-orb {
  display: block;
  user-select: none;
  pointer-events: none;
}
</style>
