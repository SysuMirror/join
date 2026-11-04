import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, saved) {
    if (saved) return saved
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    // 同一页面上仅 query 变化（筛选）时不回顶
    if (to.path === from.path) return false
    return { top: 0 }
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
      path: '/jobs/:slug',
      name: 'job-detail',
      component: () => import('../views/JobDetailView.vue'),
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
  const user = await auth.ensure()

  // 单点登出：父域 sse_sso 失效（401）且本地是 staff 会话 → 本地会话一起失效。
  // 候选人（非 staff）与 401 无关（join 的静默端点只放行管理员），保留其会话；
  // 503 / 网络（UniSSO 不可达）保留一切本地会话，不踢人。probe 每次页面加载只跑一次。
  const probe = await auth.probeSharedSso()
  if (probe === 'expired' && user && (user.is_admin || user.is_staff)) {
    auth.clearLocal()
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  const current = probe === 'ok' ? auth.user.value : user
  if (!current) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.meta.requiresAdmin && !current.is_admin && !current.is_staff) {
    return { path: '/', query: { denied: '1' } }
  }
  return true
})

export default router
