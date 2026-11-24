import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, saved) {
    if (saved) return saved
    // 只有页面上确实存在该锚点时才滚动，避免旧链接（如 /#team）刷新后乱跳
    if (
      to.hash &&
      typeof document !== 'undefined' &&
      document.querySelector(to.hash)
    ) {
      return { el: to.hash, behavior: 'smooth' }
    }
    // 同一页面上仅 query 变化（筛选）时不回顶；首次加载/刷新必须回顶
    if (from.name && to.path === from.path) return false
    return { top: 0, left: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/jobs',
      name: 'jobs',
      component: () => import('../views/JobsView.vue'),
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('../views/ProjectsView.vue'),
    },
    {
      path: '/join-team',
      name: 'join-team',
      component: () => import('../views/JoinTeamView.vue'),
    },
    {
      path: '/jobs/:slug',
      name: 'job-detail',
      component: () => import('../views/JobDetailView.vue'),
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../views/HistoryView.vue'),
    },
    {
      path: '/hall-invite/:token',
      name: 'hall-invite',
      component: () => import('../views/HallInviteView.vue'),
    },
    {
      path: '/faq',
      name: 'faq',
      component: () => import('../views/FaqView.vue'),
    },
    {
      path: '/teams',
      name: 'teams',
      component: () => import('../views/TeamsView.vue'),
    },
    {
      path: '/publicity/:id',
      name: 'publicity-detail',
      component: () => import('../views/PublicityDetailView.vue'),
    },
    {
      path: '/departments/:slug',
      name: 'department-detail',
      component: () => import('../views/DepartmentView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/me',
      name: 'me',
      component: () => import('../views/MeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/me/defense/new',
      name: 'defense-new',
      component: () => import('../views/DefenseNewView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/defenses/:id',
      name: 'defense-detail',
      component: () => import('../views/DefenseDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/me/resumes/new',
      name: 'resume-new',
      component: () => import('../views/ResumeEditView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/me/resumes/:id',
      name: 'resume-edit',
      component: () => import('../views/ResumeEditView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth && !to.meta.requiresAdmin) return true
  const auth = useAuth()

  // 本地会话（SSO 回调种下的 HttpOnly join_session Cookie）是权威登录态。
  // 静默 SSO 探测只用于「尚未登录时」的冷启动尝试：它打的是父域共享 Cookie 的
  // session/verify，可能在 SSO 刚授权、切换联动账号、或中继抖动时短暂返回 401。
  // 绝不能因为一次探测失败就清掉刚刚建立的本地会话（否则表现为授权后必须刷新）。
  let current = await auth.ensure()
  if (!current) {
    const probe = await auth.probeSharedSso()
    current = probe === 'ok' ? auth.user.value : null
  }
  if (!current) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.meta.requiresAdmin && !current.is_admin && !current.is_staff) {
    return { path: '/', query: { denied: '1' } }
  }
  return true
})

export default router
