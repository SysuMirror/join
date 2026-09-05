<template>
  <canvas ref="cv" class="line-orb" :style="{ width: size + 'px', height: size + 'px' }" aria-hidden="true" />
</template>

<script setup lang="ts">
/**
 * LineOrb —— 还原腾讯混元 (hy.tencent.com) 首页的「线条球」图案：
 * 一团大圆上的极细弧线，围绕圆心缓慢旋转、各自相位呼吸，
 * 视觉上形成莫尔条纹般的流动感。纯黑白灰，无填充。
 *
 * 圆心简笔 logo：六边形螺旋（等距立方体）一笔画 ——
 * 外圈完整六边形，向内盘旋两圈，顶部紧密堆叠成「卷」，末端小钩收笔；
 * 动画为一支笔从顶点起笔，沿路径连续描绘直至收笔（dash 渐描绘实现）。
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
const LOGO_DURATION = 2600

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
 * 简笔 logo 路径（单位坐标，六边形外接圆半径 = 1，y 向下为正）。
 * 六边形螺旋一笔画：第 k 圈为缩小 δ、中心上移 m 的六边形（顺时针），
 * 圈与圈在顶部顶点处由短竖线连接 → 顶部紧密成卷、底部 V 形疏朗，
 * 与参考 logo（等距立方体螺旋）一致；形状保证完整闭合。
 */
function buildLogoPath(): [number, number][] {
  const h = Math.sqrt(3) / 2
  const DELTA = 0.33 // 每圈外接圆半径收缩量
  const DRIFT = -0.13 // 每圈中心 y 漂移（负 = 上移，顶部更紧密）
  const pts: [number, number][] = []
  for (let k = 0; k < 3; k++) {
    const r = 1 - DELTA * k
    const c = DRIFT * k
    const V: [number, number][] = [
      [0, c - r], // 顶点 T
      [h * r, c - r / 2], // 右上
      [h * r, c + r / 2], // 右下
      [0, c + r], // 底点 B
      [-h * r, c + r / 2], // 左下
      [-h * r, c - r / 2], // 左上
    ]
    pts.push(...V, V[0]) // 闭合本圈；下一圈起点（新顶点）与 本圈顶点 的连线即为顶部连接段
  }
  // 收笔小钩（内圈顶部向内卷）
  pts.push([0.07, -0.55], [0.07, -0.48], [0.01, -0.445])
  return pts
}

const LOGO_PATH = buildLogoPath()

type Pt = { x: number; y: number }
let logoPts: Pt[] = []
let logoCum: number[] = []
let logoTotal = 0
let logoBuiltFor = 0

/** 按 u（外接圆半径像素）缓存缩放后的路径与累计弧长 */
function ensureLogoBuilt(u: number) {
  if (logoBuiltFor === u) return
  logoBuiltFor = u
  logoPts = LOGO_PATH.map(([x, y]) => ({ x: x * u, y: y * u }))
  logoCum = [0]
  for (let i = 1; i < logoPts.length; i++) {
    const dx = logoPts[i].x - logoPts[i - 1].x
    const dy = logoPts[i].y - logoPts[i - 1].y
    logoCum.push(logoCum[i - 1] + Math.hypot(dx, dy))
  }
  logoTotal = logoCum[logoCum.length - 1]
}

/** 弧长定位：返回距离起点 len 处的坐标（及所在段索引） */
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

  // 简笔 logo：一笔画描绘（起笔于顶部顶点，沿螺旋连续画到收笔小钩）
  if (props.showLogo) {
    const q = smooth((time - startTime - LOGO_START) / LOGO_DURATION)
    if (q > 0) drawLogo(ctx, cx, cy, R * 0.47, q)
  }
}

/** 一笔画 logo：dash 渐描绘 + 笔尖圆点 */
function drawLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number, q: number) {
  ensureLogoBuilt(u)
  const lw = Math.max(u * 0.06, 1.6)

  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = props.logoColor
  ctx.fillStyle = props.logoColor
  ctx.lineWidth = lw
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // 渐描绘：q=0 不显示，q=1 全部画完（从路径起点向终点生长）
  ctx.setLineDash([logoTotal, logoTotal])
  ctx.lineDashOffset = logoTotal * (1 - q)
  ctx.beginPath()
  ctx.moveTo(logoPts[0].x, logoPts[0].y)
  for (let i = 1; i < logoPts.length; i++) ctx.lineTo(logoPts[i].x, logoPts[i].y)
  ctx.stroke()
  ctx.setLineDash([])

  // 笔尖：描绘中在当前笔画末端画一个小圆点，模拟「笔」
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
