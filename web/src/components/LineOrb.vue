<template>
  <canvas ref="cv" class="line-orb" :style="{ width: size + 'px', height: size + 'px' }" aria-hidden="true" />
</template>

<script setup lang="ts">
/**
 * LineOrb —— 还原腾讯混元 (hy.tencent.com) 首页的「线条球」图案：
 * 一团大圆上的极细弧线，围绕圆心缓慢旋转、各自相位呼吸，
 * 视觉上形成莫尔条纹般的流动感。纯黑白灰，无填充。
 *
 * 实现要点：
 * - 每条线是「以圆心为中心的椭圆弧」：宽度/高度/相位略不同 → 旋转时错落
 * - 全部 stroke 黑色低透明度，叠加处自然加深出「体积感」
 * - devicePixelRatio 适配，requestAnimationFrame 驱动
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
  }>(),
  { size: 420, lines: 64, alpha: 0.16, speed: 0.12 },
)

const cv = ref<HTMLCanvasElement | null>(null)
let raf = 0
let running = true

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
      // 半径从 0.55R 到 1R 均匀铺开，加一点扰动让层次更自然
      rx: 0.55 + 0.45 * t + (Math.random() - 0.5) * 0.02,
      ry: 0.55 + 0.45 * t + (Math.random() - 0.5) * 0.02,
      phase: (t * Math.PI) / 2 + Math.random() * 0.2,
      breathe: 0.015 + Math.random() * 0.02,
      a: 0.6 + Math.random() * 0.4,
      w: Math.random() < 0.12 ? 1.2 : 0.7,
    })
  }
  return lanes
}

let lanes: Lane[] = []

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

  ctx.strokeStyle = '#111111'
  ctx.lineCap = 'round'

  for (const lane of lanes) {
    const wob = Math.sin(t * 0.6 + lane.phase) * lane.breathe
    const rx = lane.rx * R * (1 + wob)
    const ry = lane.ry * R * (1 - wob)
    const rot = t * props.speed + lane.phase * 0.35

    ctx.globalAlpha = props.alpha * lane.a
    ctx.lineWidth = lane.w
    ctx.beginPath()
    ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), rot, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function loop(time: number) {
  if (!running) return
  draw(time)
  raf = requestAnimationFrame(loop)
}

function onVisibility() {
  // 页面隐藏时暂停，回来时恢复（省电）
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
