import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/main.css'

// 刷新时不要由浏览器恢复上一次的滚动位置，统一交给路由回到顶部
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

const app = createApp(App)

/**
 * v-reveal：滚动入场指令。
 * 每个元素单独 observe，异步渲染的内容（岗位列表等）也能正常触发。
 */
const revealObserver =
  typeof window !== 'undefined' && 'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add('in')
              revealObserver?.unobserve(e.target)
            }
          }
        },
        { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
      )
    : null

app.directive('reveal', {
  mounted(el: HTMLElement) {
    if (!revealObserver) {
      el.classList.add('reveal', 'in')
      return
    }
    el.classList.add('reveal')
    revealObserver.observe(el)
  },
  unmounted(el: HTMLElement) {
    revealObserver?.unobserve(el)
  },
})

app.use(router).mount('#app')
