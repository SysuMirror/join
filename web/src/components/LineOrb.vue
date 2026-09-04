<template>
  <canvas ref="cv" class="line-orb" :style="{ width: size + 'px', height: size + 'px' }" aria-hidden="true" />
</template>

<script setup lang="ts">
/**
 * LineOrb —— 还原腾讯混元 (hy.tencent.com) 首页的「线条球」图案：
 * 一团大圆上的极细弧线，围绕圆心缓慢旋转、各自相位呼吸，
 * 视觉上形成莫尔条纹般的流动感。纯黑白灰，无填充。
 *
 * 本次增强：
 * - 所有插值用 smoothstep 缓动，过渡更圆滑（无硬切）。
 * - 圆心处用品牌蓝「一行一行」地绘制简笔 logo（六边形外框 + 双层 S 折线），
 *   随扫描线自上而下渐次显现，与圆环入场错开。
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
    /** 简笔 logo 线条颜色 */
    logoColor?: string
  }>(),
  { size: 420, lines: 72, alpha: 0.15, speed: 0.1, showLogo: true, logoColor: '#3370ff' },
)

const cv = ref<HTMLCanvasElement | null>(null)
let raf = 0
let running = true
/** 入场生长进度 0→1（约 2.6s），线条由内向外依次展开 */
let intro = 0
const INTRO_DURATION = 2600

// 每条线的独立参数（生成一次，避免每帧随机抖动）
type Lane = {
  /** 椭圆横向半径系数（0~1，相对 R） */
  rx: number
  /** 椭圆纵向半径系数 */
  ry: number
  /** 初始相位 */
  phase: number
  /** 呼吸幅度（rx/ry 随时间摆动的比例） */
  breathe: number
  /** 透明度乘数 */
  a: number
  /** 线宽 */
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

/** smoothstep：0→1，两端圆滑，用于一切过渡插值 */
function smooth(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

/** 简笔 logo：六边形外框 + 双层 S 折线（归一化坐标，y 向下为正） */
const LOGO_LINES: [number, number][][] = [
  // 六边形外框（闭合，尖顶朝上）
  [
    [-0.866, -0.5],
    [0, -1],
    [0.866, -0.5],
    [0.866, 0.5],
    [0, 1],
    [-0.866, 0.5],
    [-0.866, -0.5],
  ],
  // S 折线（外层）
  [
    [-0.5, -0.6],
    [0.5, -0.6],
    [0.5, -0.1],
    [-0.5, -0.1],
    [-0.5, 0.45],
    [0.36, 0.45],
  ],
  // S 折线（内层）
  [
    [-0.32, -0.42],
    [0.32, -0.42],
    [0.32, -0.22],
    [-0.32, -0.22],
    [-0.32, 0.32],
  ],
]

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
    // 每条线按自身半径错峰出现：内侧先展开，外侧后展开（smoothstep 圆滑过渡）
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

  // 简笔 logo：在 intro 后半段开始「一行一行」自上而下显现
  if (props.showLogo) {
    const logoProgress = smooth((intro - 0.5) / 0.5)
    if (logoProgress > 0) {
      drawLogo(ctx, cx, cy, R * 0.42, logoProgress, cssSize)
    }
  }
}

/** 逐行绘制简笔 logo：用 clip 从顶向下扩展，形成扫描式「一行行画」效果 */
function drawLogo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  u: number,
  p: number,
  cssSize: number,
) {
  const top = cy - u * 2
  const bottom = cy + u * 2
  const scanY = top + (bottom - top) * p

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, cssSize, scanY)
  ctx.clip()

  ctx.strokeStyle = props.logoColor
  ctx.lineWidth = Math.max(u * 0.08, 1.5)
  ctx.lineJoin = 'round'
  ctx.globalAlpha = smooth(p) // 随扫描增强

  for (const line of LOGO_LINES) {
    ctx.beginPath()
    for (let i = 0; i < line.length; i++) {
      const x = cx + line[i][0] * u
      const y = cy + line[i][1] * u
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()
  ctx.globalAlpha = 1
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
