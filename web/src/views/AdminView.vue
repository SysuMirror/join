<template>
  <div class="page">
    <SiteHeader />

    <main class="admin-main">
      <header class="admin-head">
        <div>
          <h1 class="page-title">开发者与人事管理</h1>
          <p class="page-sub">管理部门与岗位、双选报名、成员权限、技术部答辩、圆桌席位与年度复审。</p>
        </div>
        <div v-if="user" class="admin-user">
          <span v-if="adminMe" class="badge" :class="isGlobal ? 'badge-amber' : 'badge-blue'">
            {{ staffRoleLabel }}
          </span>
          <span class="admin-email">{{ user.email }}</span>
        </div>
      </header>

      <p v-if="error" class="notice notice-error">{{ error }}</p>
      <p v-if="notice" class="notice notice-success">{{ notice }}</p>
      <p v-if="adminMe && !adminMe.global" class="notice notice-info">
        <template v-if="hasDepartments">
          你正在管理部门：{{ adminMe.departments.map((d) => d.name).join('、') }}。仅可查看和管理这些部门的岗位、报名、成员与答辩。
        </template>
        <template v-else>
          你作为学院/外院资源方代表，可参与技术部答辩的三级评审。
        </template>
      </p>

      <div class="tabs admin-tabs">
        <button
          v-for="t in visibleTabs"
          :key="t.id"
          class="tab"
          :class="{ active: tab === t.id }"
          @click="tab = t.id"
        >
          {{ t.label }}
          <span v-if="t.id === 'applications' && stats?.pendingReview" class="tab-badge">
            {{ stats.pendingReview }}
          </span>
        </button>
      </div>

      <div v-if="loading" class="admin-loading">加载中…</div>

      <template v-else>
        <!-- ===== 概览 ===== -->
        <section v-show="tab === 'overview'" class="admin-section">
          <div class="stat-grid">
            <div class="stat-card"><b>{{ stats?.developers ?? 0 }}</b><span>项目开发者</span></div>
            <div class="stat-card"><b>{{ stats?.roundtable ?? 0 }}</b><span>圆桌开发者</span></div>
            <div class="stat-card"><b>{{ stats?.defensesOpen ?? 0 }}</b><span>进行中答辩</span></div>
            <div class="stat-card"><b>{{ stats?.pendingReview ?? 0 }}</b><span>待沟通报名</span></div>
            <div class="stat-card"><b>{{ stats?.offered ?? 0 }}</b><span>待本人确认</span></div>
            <div class="stat-card"><b>{{ stats?.users ?? 0 }}</b><span>{{ isGlobal ? '注册开发者' : '部门成员' }}</span></div>
            <div class="stat-card"><b>{{ stats?.openJobs ?? 0 }}</b><span>开放岗位</span></div>
            <div class="stat-card"><b>{{ stats?.applications ?? 0 }}</b><span>累计报名</span></div>
          </div>

          <div class="overview-grid">
            <div class="card panel">
              <div class="row-between">
                <h3>最近报名</h3>
                <button class="btn btn-ghost btn-sm" @click="tab = 'applications'">全部报名 →</button>
              </div>
              <table v-if="applications.length" class="table">
                <thead><tr><th>报名同学</th><th>岗位</th><th>状态</th><th class="hide-sm">时间</th></tr></thead>
                <tbody>
                  <tr v-for="a in applications.slice(0, 6)" :key="a.id">
                    <td><strong>{{ a.name || '匿名' }}</strong><div class="muted small">{{ a.userEmail || a.contact }}</div></td>
                    <td>{{ a.jobTitle || '—' }}</td>
                    <td><span class="badge" :class="stageClass(a.stage)">{{ stageLabel(a.stage) }}</span></td>
                    <td class="hide-sm small mono">{{ formatDate(a.created_at) }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-else class="empty">暂无报名</div>
            </div>

            <div class="card panel">
              <h3>快捷操作</h3>
              <div class="quick-actions">
                <button v-if="isGlobal" class="quick-btn" @click="tab = 'publicities'"><b>+ 创建公示</b><span>记录本次会议的席位、指标与晋升</span></button>
                <button v-if="isGlobal" class="quick-btn" @click="tab = 'users'"><b>成员与权限</b><span>查询用户、设置超管 / 部门管理员 / 负责人</span></button>
                <button class="quick-btn" @click="tab = 'defenses'"><b>答辩评审</b><span>处理待评审答辩、查看多级流水线</span></button>
                <button class="quick-btn" @click="openJobForm()"><b>+ 新建岗位</b><span>在部门下发布岗位</span></button>
                <button v-if="isGlobal" class="quick-btn" @click="openDeptForm()"><b>+ 新建部门</b><span>创建集市下的项目部门</span></button>
                <button class="quick-btn" @click="tab = 'applications'"><b>查看待初审报名</b><span>处理报名同学简历与审批</span></button>
                <button v-if="isGlobal" class="quick-btn" @click="openFaqForm()"><b>+ 新增问答</b><span>补充报名同学常见问题</span></button>
                <button v-if="isGlobal" class="quick-btn" @click="tab = 'site'"><b>编辑站点文案</b><span>首页标题、公告与联系方式</span></button>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== 部门 ===== -->
        <section v-show="tab === 'departments'" class="card panel admin-section">
          <div class="row-between">
            <h3>部门</h3>
            <button class="btn btn-primary btn-sm" @click="openDeptForm()">+ 新建部门</button>
          </div>
          <p class="hint">岗位必须归属于某个部门；部门会展示在首页与岗位筛选中。</p>
          <table v-if="departments.length" class="table">
            <thead>
              <tr><th>部门</th><th class="hide-sm">介绍</th><th class="hide-sm">负责人</th><th>圆桌席位</th><th class="hide-sm">岗位</th><th>状态</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="d in departments" :key="d.id">
                <td>
                  <div class="dept-cell">
                    <div><strong>{{ d.name }}</strong><div class="muted small">{{ d.slug }}</div></div>
                  </div>
                </td>
                <td class="hide-sm muted small cell-summary">{{ d.summary || '—' }}</td>
                <td class="hide-sm small">{{ d.head?.name || '待任命' }}<div v-if="d.head" class="muted small mono">{{ d.head.developer_no }}</div></td>
                <td class="small">{{ d.seats?.occupied ?? 0 }} / {{ d.seats?.total ?? 1 }}<div class="muted small">候补 {{ d.seats?.waitlist ?? 0 }}</div></td>
                <td class="hide-sm small">{{ d.openJobCount ?? d.openJobs ?? 0 }} / {{ d.jobCount ?? 0 }}</td>
                <td><span class="badge" :class="d.enabled ? 'badge-green' : 'badge-red'">{{ d.enabled ? '展示' : '隐藏' }}</span></td>
                <td class="actions">
                  <button class="btn btn-ghost btn-sm" @click="openDeptForm(d)">编辑</button>
                  <button class="btn btn-danger btn-sm" @click="deleteDept(d)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty">暂无部门，先创建一个部门再发布岗位。</div>
        </section>

        <!-- ===== 岗位 ===== -->
        <section v-show="tab === 'jobs'" class="card panel admin-section">
          <div class="row-between">
            <h3>岗位</h3>
            <button class="btn btn-primary btn-sm" @click="openJobForm()">+ 新建岗位</button>
          </div>
          <div class="toolbar">
            <input v-model="jobsFilter.q" class="search" placeholder="搜索岗位 / 技能…" @input="loadJobs" />
            <select v-model="jobsFilter.department" @change="loadJobs">
              <option value="">全部部门</option>
              <option v-for="d in departments" :key="d.id" :value="String(d.id)">{{ d.name }}</option>
            </select>
          </div>
          <table v-if="jobs.length" class="table">
            <thead>
              <tr><th>岗位</th><th>部门</th><th class="hide-sm">方向</th><th class="hide-sm">参与类型</th><th>状态</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="j in jobs" :key="j.id">
                <td>
                  <strong>{{ j.title }}</strong>
                  <div class="muted small">{{ j.slug }} · {{ j.location || '地点未填' }}</div>
                  <div v-if="j.contact_wechat" class="muted small">微信：{{ j.contact_wechat }}</div>
                </td>
                <td>{{ j.department || '—' }}</td>
                <td class="hide-sm">{{ j.direction || '—' }}</td>
                <td class="hide-sm">{{ typeLabel(j.type) }}</td>
                <td><span class="badge" :class="j.enabled ? 'badge-green' : 'badge-red'">{{ j.enabled ? '开放' : '关闭' }}</span></td>
                <td class="actions">
                  <button class="btn btn-ghost btn-sm" @click="openJobForm(j)">编辑</button>
                  <button class="btn btn-danger btn-sm" @click="deleteJob(j)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty">暂无岗位</div>
        </section>

        <!-- ===== 报名 ===== -->
        <section v-show="tab === 'applications'" class="card panel admin-section">
          <div class="row-between">
            <h3>报名审核</h3>
            <button class="btn btn-ghost btn-sm" :disabled="refreshing" @click="refreshOa">
              {{ refreshing ? '刷新中…' : '刷新审批状态' }}
            </button>
          </div>
          <p class="hint">初审通过后会自动提交内部审批；驳回会记录意见。</p>
          <div class="toolbar">
            <input v-model="appsFilter.q" class="search" placeholder="搜索报名同学 / 邮箱 / 手机…" @input="loadApplications" />
            <select v-model="appsFilter.status" @change="loadApplications">
              <option value="">全部阶段</option>
              <option value="submitted">已投递 · 待沟通</option>
              <option value="interview">已约沟通</option>
              <option value="offered">部门已通过 · 待本人确认</option>
              <option value="joined">已加入</option>
              <option value="rejected">未匹配</option>
            </select>
            <select v-model="appsFilter.department" @change="loadApplications">
              <option value="">全部部门</option>
              <option v-for="d in departments" :key="d.id" :value="String(d.id)">{{ d.name }}</option>
            </select>
          </div>
          <table v-if="applications.length" class="table">
            <thead>
              <tr>
                <th>报名同学</th><th>岗位</th><th class="hide-sm">联系方式</th>
                <th>双选阶段</th><th class="hide-sm">沟通 / 确认</th><th class="hide-sm">报名时间</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in applications" :key="a.id">
                <td>
                  <div><strong>{{ a.name || '匿名' }}</strong></div>
                  <div class="muted small">{{ a.resumeTitle || a.userEmail || '' }}</div>
                </td>
                <td>{{ a.jobTitle || '—' }}<div class="muted small">{{ a.jobDepartment }}</div></td>
                <td class="small mono hide-sm">
                  {{ a.phone || a.email || a.contact }}
                  <div v-if="a.wechat" class="admin-wechat">微信：{{ a.wechat }}</div>
                </td>
                <td><span class="badge" :class="stageClass(a.stage)">{{ stageLabel(a.stage) }}</span></td>
                <td class="hide-sm small">
                  <span v-if="a.interview_at">沟通 {{ formatDateTime(a.interview_at) }}</span>
                  <span v-else-if="a.confirmed_at">确认 {{ formatDateTime(a.confirmed_at) }}</span>
                  <span v-else>—</span>
                </td>
                <td class="hide-sm small mono">{{ formatDate(a.created_at) }}</td>
                <td class="actions">
                  <button class="btn btn-ghost btn-sm" @click="openApp(a)">详情</button>
                  <template v-if="a.stage === 'submitted' || a.stage === 'interview'">
                    <button v-if="a.stage === 'submitted'" class="btn btn-ghost btn-sm" @click="scheduleInterview(a)">约沟通</button>
                    <button class="btn btn-primary btn-sm" @click="pass(a)">双选通过</button>
                    <button class="btn btn-danger btn-sm" @click="reject(a)">未匹配</button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty">暂无报名</div>
        </section>

        <!-- ===== 成员与权限 ===== -->
        <section v-if="tab === 'users'" class="admin-section">
          <UsersPanel
            :global="isGlobal"
            :departments="departments"
            @notice="showNotice"
            @error="setError"
          />
        </section>

        <!-- ===== 答辩 ===== -->
        <section v-if="tab === 'defenses'" class="admin-section">
          <DefensesPanel
            :global="isGlobal"
            @notice="showNotice"
            @error="setError"
            @changed="loadStats"
          />
        </section>

        <!-- ===== 圆桌与复审 ===== -->
        <section v-if="tab === 'roundtable'" class="admin-section">
          <RoundtablePanel
            :global="isGlobal"
            @notice="showNotice"
            @error="setError"
            @changed="loadStats"
          />
        </section>

        <!-- ===== 公示 ===== -->
        <section v-if="tab === 'publicities'" class="admin-section">
          <PublicityPanel
            @notice="showNotice"
            @error="setError"
          />
        </section>

        <!-- ===== 部门介绍 ===== -->
        <section v-if="tab === 'department-intro'" class="admin-section">
          <DepartmentIntroPanel @notice="showNotice" @error="setError" />
        </section>

        <!-- ===== 问答 ===== -->
        <section v-show="tab === 'faqs'" class="card panel admin-section">
          <div class="row-between">
            <h3>常见问题</h3>
            <button class="btn btn-primary btn-sm" @click="openFaqForm()">+ 新增问答</button>
          </div>
          <p class="hint">问答会展示在 /faq 页面，并可能在首页推荐。</p>
          <table v-if="faqs.length" class="table">
            <thead><tr><th>分类</th><th>问题</th><th>状态</th><th class="hide-sm">排序</th><th></th></tr></thead>
            <tbody>
              <tr v-for="f in faqs" :key="f.id">
                <td><span class="badge badge-blue">{{ f.category }}</span></td>
                <td><strong>{{ f.question }}</strong><div class="muted small cell-summary">{{ f.answer }}</div></td>
                <td><span class="badge" :class="f.enabled ? 'badge-green' : 'badge-red'">{{ f.enabled ? '展示' : '隐藏' }}</span></td>
                <td class="hide-sm small mono">{{ f.sort_order }}</td>
                <td class="actions">
                  <button class="btn btn-ghost btn-sm" @click="openFaqForm(f)">编辑</button>
                  <button class="btn btn-danger btn-sm" @click="deleteFaq(f)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty">暂无问答</div>
        </section>

        <!-- ===== 站点配置 ===== -->
        <section v-show="tab === 'site'" class="card panel admin-section">
          <div class="row-between">
            <h3>站点文案</h3>
            <button class="btn btn-primary btn-sm" :disabled="siteSaving" @click="saveSite">
              {{ siteSaving ? '保存中…' : '保存配置' }}
            </button>
          </div>
          <p class="hint">保存后前台即时生效。</p>
          <div class="fields">
            <div class="field">
              <label>品牌名</label>
              <input v-model="siteForm.brand" maxlength="60" />
            </div>
            <div class="field">
              <label>联系邮箱</label>
              <input v-model="siteForm.contactEmail" maxlength="120" />
            </div>
            <div class="field full">
              <label>管理员 UniSSO sub（逗号分隔，登记后可用邮箱密码登录后台）</label>
              <input v-model="siteForm.adminSubs" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            </div>
            <div class="field full">
              <label>首页主标题</label>
              <input v-model="siteForm.heroTitle" maxlength="120" />
            </div>
            <div class="field full">
              <label>首页副标题（换行用 \n）</label>
              <textarea v-model="siteForm.heroSubtitle" rows="3" />
            </div>
            <div class="field full">
              <label>顶部公告（留空则不显示）</label>
              <input v-model="siteForm.announcement" maxlength="120" />
            </div>
            <div class="field full">
              <label>页脚标语</label>
              <input v-model="siteForm.tagline" maxlength="120" />
            </div>
            <div class="field full">
              <label>背景装饰词（用 · 分隔）</label>
              <input v-model="siteForm.bgWords" maxlength="300" />
            </div>
          </div>
        </section>
      </template>
    </main>

    <!-- ===== 部门弹窗 ===== -->
    <div v-if="deptModalOpen" class="modal-backdrop" @click.self="deptModalOpen = false">
      <form class="modal wide" @submit.prevent="saveDept">
        <h3>{{ editingDept ? '编辑部门' : '新建部门' }}</h3>
        <div class="fields">
          <div class="field full">
            <label>部门名称 *</label>
            <input v-model="deptForm.name" required maxlength="60" placeholder="如：AI 应用组" />
          </div>
          <div class="field full">
            <label>一句话介绍</label>
            <input v-model="deptForm.summary" maxlength="300" placeholder="展示在首页部门卡片上" />
          </div>
          <div class="field full">
            <label>详细介绍</label>
            <textarea v-model="deptForm.description" rows="4" placeholder="部门职责、方向与团队情况" />
          </div>
          <div class="field full">
            <label>部门管理员邮箱（旧数据兼容）</label>
            <input v-model="deptForm.admin_emails" placeholder="alice@example.com,bob@example.com" />
            <span class="hint">推荐在「成员与权限」中按用户设置部门管理员；这里仅用于兼容旧数据，保存用户角色后会自动清理多余邮箱。</span>
          </div>
          <div class="field">
            <label>部门负责人</label>
            <select v-model.number="deptForm.head_user_id">
              <option :value="0">未设置</option>
              <option v-for="u in headOptions" :key="u.id" :value="u.id">
                {{ u.name }}（{{ u.developer_no }}）
              </option>
            </select>
            <span class="hint">负责人是一级答辩「陈述事实」的评审人，自动获得部门管理员权限。</span>
          </div>
          <div class="field full">
            <p class="hint">
              席位、产出指标与产出说明由「公示」发布维护，发布后自动写回部门；这里不能直接修改。
            </p>
          </div>
          <div class="field">
            <label>排序（小在前）</label>
            <input v-model.number="deptForm.sort_order" type="number" />
          </div>
          <div class="field">
            <label>前台展示</label>
            <select v-model.number="deptForm.enabled">
              <option :value="1">展示</option>
              <option :value="0">隐藏</option>
            </select>
          </div>
        </div>
        <p v-if="modalError" class="notice notice-error">{{ modalError }}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" type="submit" :disabled="saving">保存</button>
          <button class="btn btn-ghost" type="button" @click="deptModalOpen = false">取消</button>
        </div>
      </form>
    </div>

    <!-- ===== 岗位弹窗 ===== -->
    <div v-if="jobModalOpen" class="modal-backdrop" @click.self="jobModalOpen = false">
      <form class="modal wide" @submit.prevent="saveJob">
        <h3>{{ editingJob ? '编辑岗位' : '新建岗位' }}</h3>
        <div class="fields">
          <div class="field">
            <label>岗位名称 *</label>
            <input v-model="jobForm.title" required maxlength="100" />
          </div>
          <div class="field">
            <label>所属部门 *</label>
            <select v-model.number="jobForm.department_id" required>
              <option :value="0" disabled>请选择部门</option>
              <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>岗位方向</label>
            <input v-model="jobForm.direction" list="direction-options" maxlength="40" placeholder="如：技术研发" />
            <datalist id="direction-options">
              <option v-for="d in directionOptions" :key="d" :value="d" />
            </datalist>
          </div>
          <div class="field">
            <label>活动地点</label>
            <input v-model="jobForm.location" maxlength="60" placeholder="如：广州校区 / 线上" />
          </div>
          <div class="field">
            <label>参与类型</label>
            <select v-model="jobForm.type">
              <option value="fulltime">社团成员</option>
              <option value="intern">项目成员</option>
              <option value="parttime">志愿者</option>
            </select>
          </div>
          <div class="field">
            <label>招募对象</label>
            <input v-model="jobForm.experience" list="experience-options" maxlength="40" />
            <datalist id="experience-options">
              <option v-for="e in experienceOptions" :key="e" :value="e" />
            </datalist>
          </div>
          <div class="field">
            <label>年级要求</label>
            <input v-model="jobForm.education" list="education-options" maxlength="40" />
            <datalist id="education-options">
              <option v-for="e in educationOptions" :key="e" :value="e" />
            </datalist>
          </div>
          <div class="field">
            <label>时间投入</label>
            <input v-model="jobForm.salary" maxlength="60" placeholder="如：每周 4-6 小时 / 时间灵活" />
          </div>
          <div class="field">
            <label>咨询微信（选填）</label>
            <input v-model="jobForm.contact_wechat" maxlength="60" placeholder="微信号 / 手机号，展示在岗位详情" />
          </div>
          <div class="field">
            <label>招募人数（0 = 不限）</label>
            <input v-model.number="jobForm.headcount" type="number" min="0" />
          </div>
          <div class="field">
            <label>标签（逗号分隔）</label>
            <input v-model="jobForm.tags" maxlength="300" placeholder="TypeScript,Node.js,大模型" />
          </div>
          <div class="field">
            <label>开放报名</label>
            <select v-model.number="jobForm.enabled">
              <option :value="1">开放</option>
              <option :value="0">关闭</option>
            </select>
          </div>
          <div class="field">
            <label>排序（小在前）</label>
            <input v-model.number="jobForm.sort_order" type="number" />
          </div>
          <div class="field full">
            <label>岗位摘要</label>
            <textarea v-model="jobForm.summary" rows="2" maxlength="300" placeholder="列表页展示的一句话介绍" />
          </div>
          <div class="field full">
            <label>岗位职责</label>
            <textarea v-model="jobForm.responsibilities" rows="5" />
          </div>
          <div class="field full">
            <label>招募要求</label>
            <textarea v-model="jobForm.requirements" rows="5" />
          </div>
          <div class="field full">
            <label>加分项（选填）</label>
            <textarea v-model="jobForm.bonus" rows="3" />
          </div>
          <div class="field full">
            <label>其他描述（选填，旧数据兼容）</label>
            <textarea v-model="jobForm.description" rows="3" />
          </div>
        </div>
        <p v-if="modalError" class="notice notice-error">{{ modalError }}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" type="submit" :disabled="saving">保存</button>
          <button class="btn btn-ghost" type="button" @click="jobModalOpen = false">取消</button>
        </div>
      </form>
    </div>

    <!-- ===== 报名详情弹窗 ===== -->
    <div v-if="appDetailOpen" class="modal-backdrop" @click.self="closeAppDetail">
      <div class="modal wide app-detail">
        <div class="app-detail-head">
          <div>
            <h3>{{ appDetail?.name || '报名同学' }}</h3>
            <p class="muted small">{{ appDetail?.jobTitle }} · {{ appDetail?.jobDepartment }}</p>
          </div>
          <span v-if="appDetail" class="badge" :class="stageClass(appDetail.stage)">
            {{ stageLabel(appDetail.stage) }}
          </span>
        </div>

        <div v-if="appDetailLoading" class="empty">加载中…</div>
        <template v-else-if="appDetail">
          <div class="detail-grid">
            <div><span>邮箱</span>{{ appDetail.email || appDetail.userEmail || '—' }}</div>
            <div><span>手机</span>{{ appDetail.phone || '—' }}</div>
            <div>
              <span>微信</span>
              <template v-if="appDetail.wechat">
                {{ appDetail.wechat }}
                <button class="link-btn" type="button" @click="copyText(appDetail.wechat, '微信号已复制')">
                  {{ copiedText === appDetail.wechat ? '已复制' : '复制' }}
                </button>
              </template>
              <template v-else>—</template>
            </div>
            <div><span>账号</span>{{ appDetail.userEmail || '—' }}</div>
            <div><span>报名时间</span>{{ formatDateTime(appDetail.created_at) }}</div>
            <div><span>双选阶段</span>{{ stageLabel(appDetail.stage) }}</div>
            <div v-if="appDetail.interview_at"><span>沟通时间</span>{{ formatDateTime(appDetail.interview_at) }}</div>
            <div v-if="appDetail.confirmed_at"><span>本人确认</span>{{ formatDateTime(appDetail.confirmed_at) }}</div>
            <div><span>简历</span>{{ appDetail.resumeTitle || '—' }}</div>
            <div>
              <span>附件</span>
              <button v-if="appDetail.resume_id" class="link-btn" @click="openResumePdf(appDetail)">
                {{ appDetail.resumeFileName || '查看 PDF' }}
              </button>
              <template v-else>无</template>
            </div>
          </div>

          <section v-if="appDetail.interview_note" class="detail-block">
            <h4>双向沟通记录</h4>
            <p>{{ appDetail.interview_note }}</p>
          </section>

          <section class="detail-block">
            <h4>报名同学信息</h4>
            <p v-if="snapshotLine"><span class="detail-label">教育：</span>{{ snapshotLine }}</p>
            <p v-if="appDetail.snapshot?.intention"><span class="detail-label">意向：</span>{{ appDetail.snapshot.intention }}</p>
            <p v-if="appDetail.snapshot?.skills"><span class="detail-label">技能：</span>{{ appDetail.snapshot.skills }}</p>
            <p v-if="appDetail.snapshot?.summary"><span class="detail-label">自述：</span>{{ appDetail.snapshot.summary }}</p>
            <p v-if="appDetail.snapshot?.work_experience"><span class="detail-label">工作经历：</span>{{ appDetail.snapshot.work_experience }}</p>
            <p v-if="appDetail.snapshot?.project_experience"><span class="detail-label">项目经历：</span>{{ appDetail.snapshot.project_experience }}</p>
          </section>

          <section v-if="appDetail.note" class="detail-block">
            <h4>报名备注</h4>
            <p>{{ appDetail.note }}</p>
          </section>

          <section v-if="appDetail.review_note" class="detail-block">
            <h4>审核意见</h4>
            <p>{{ appDetail.review_note }}</p>
          </section>

          <section v-if="appDetail.resumeText" class="detail-block">
            <h4>PDF 解析原文</h4>
            <pre class="resume-text">{{ appDetail.resumeText }}</pre>
          </section>

          <section v-if="appDetail.oaTimeline?.length" class="detail-block">
            <h4>审批流转记录</h4>
            <ol class="timeline">
              <li v-for="(e, i) in appDetail.oaTimeline" :key="i" class="tl-item">
                <span class="tl-dot" :class="`dot-${e.action}`" />
                <div>
                  <div class="tl-head"><strong>{{ actionLabel(e.action) }}</strong><span class="muted small">{{ e.by || e.viaModule || '' }}</span></div>
                  <div v-if="e.note" class="small">{{ e.note }}</div>
                  <div class="muted small mono">{{ formatDateTime(e.at) }}</div>
                </div>
              </li>
            </ol>
          </section>

          <p v-if="appError" class="notice notice-error">{{ appError }}</p>

          <div class="modal-actions">
            <template v-if="appDetail.stage === 'submitted' || appDetail.stage === 'interview'">
              <button v-if="appDetail.stage === 'submitted'" class="btn btn-ghost" @click="scheduleInterview(appDetail)">约沟通</button>
              <button class="btn btn-primary" @click="pass(appDetail)">双选通过，等待本人确认</button>
              <button class="btn btn-danger" @click="reject(appDetail)">未匹配</button>
            </template>
            <button class="btn btn-ghost" @click="closeAppDetail">关闭</button>
          </div>
        </template>
      </div>
    </div>

    <!-- ===== 问答弹窗 ===== -->
    <div v-if="faqModalOpen" class="modal-backdrop" @click.self="faqModalOpen = false">
      <form class="modal wide" @submit.prevent="saveFaq">
        <h3>{{ editingFaq ? '编辑问答' : '新增问答' }}</h3>
        <div class="fields">
          <div class="field">
            <label>分类 *</label>
            <input v-model="faqForm.category" list="faq-categories" required maxlength="40" />
            <datalist id="faq-categories">
              <option v-for="c in faqCategories" :key="c" :value="c" />
            </datalist>
          </div>
          <div class="field">
            <label>排序（小在前）</label>
            <input v-model.number="faqForm.sort_order" type="number" />
          </div>
          <div class="field full">
            <label>问题 *</label>
            <input v-model="faqForm.question" required maxlength="200" />
          </div>
          <div class="field full">
            <label>答案 *</label>
            <textarea v-model="faqForm.answer" rows="6" required />
          </div>
          <div class="field">
            <label>前台展示</label>
            <select v-model.number="faqForm.enabled">
              <option :value="1">展示</option>
              <option :value="0">隐藏</option>
            </select>
          </div>
        </div>
        <p v-if="modalError" class="notice notice-error">{{ modalError }}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" type="submit" :disabled="saving">保存</button>
          <button class="btn btn-ghost" type="button" @click="faqModalOpen = false">取消</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  api,
  type AdminApplication,
  type AdminJob,
  type AdminSession,
  type AdminStats,
  type Department,
  type Faq,
  type JobType,
  type SiteConfig,
} from '../api'
import SiteHeader from '../components/SiteHeader.vue'
import UsersPanel from '../components/admin/UsersPanel.vue'
import DefensesPanel from '../components/admin/DefensesPanel.vue'
import RoundtablePanel from '../components/admin/RoundtablePanel.vue'
import PublicityPanel from '../components/admin/PublicityPanel.vue'
import DepartmentIntroPanel from '../components/admin/DepartmentIntroPanel.vue'
import { useAuth } from '../stores/auth'
import {
  actionLabel,
  formatDate,
  formatDateTime,
  stageClass,
  stageLabel,
  typeLabel,
} from '../utils/labels'

type AdminTab =
  | 'overview'
  | 'users'
  | 'departments'
  | 'jobs'
  | 'applications'
  | 'defenses'
  | 'roundtable'
  | 'publicities'
  | 'department-intro'
  | 'faqs'
  | 'site'

type DeptForm = {
  name: string
  summary: string
  description: string
  color: string
  admin_emails: string
  head_user_id: number
  base_seats: number
  floating_seats: number
  output_delivery: number
  output_usage: number
  output_talent: number
  output_activity: number
  output_note: string
  enabled: number
  sort_order: number
}

type HeadOption = {
  id: number
  name: string
  developer_no: string
  developer_level: string
}

type JobForm = {
  title: string
  department_id: number
  direction: string
  location: string
  type: JobType
  experience: string
  education: string
  salary: string
  contact_wechat: string
  tags: string
  summary: string
  responsibilities: string
  requirements: string
  bonus: string
  description: string
  headcount: number
  enabled: number
  sort_order: number
}

type FaqForm = {
  category: string
  question: string
  answer: string
  enabled: number
  sort_order: number
}

const auth = useAuth()
const user = auth.user

const tabs: Array<{ id: AdminTab; label: string }> = [
  { id: 'overview', label: '概览' },
  { id: 'users', label: '成员与权限' },
  { id: 'departments', label: '部门' },
  { id: 'jobs', label: '岗位' },
  { id: 'applications', label: '报名' },
  { id: 'defenses', label: '答辩' },
  { id: 'roundtable', label: '圆桌与复审' },
  { id: 'publicities', label: '公示' },
  { id: 'department-intro', label: '部门介绍' },
  { id: 'faqs', label: '问答' },
  { id: 'site', label: '站点配置' },
]

const tab = ref<AdminTab>('overview')
const loading = ref(true)
const error = ref('')
const notice = ref('')
const copiedText = ref('')
const saving = ref(false)
const modalError = ref('')
const appError = ref('')
const refreshing = ref(false)
const siteSaving = ref(false)

const adminMe = ref<AdminSession | null>(null)
const stats = ref<AdminStats | null>(null)
const departments = ref<Department[]>([])
const jobs = ref<AdminJob[]>([])
const applications = ref<AdminApplication[]>([])
const faqs = ref<Faq[]>([])

const jobsFilter = reactive({ q: '', department: '' })
const appsFilter = reactive({ q: '', status: '', department: '' })

const directionOptions = ['技术研发', '设计', '内容运营', '活动策划', '外联合作', '其他']
const experienceOptions = ['不限', '零基础', '有相关经验', '有作品/项目']
const educationOptions = ['不限', '大一', '大二', '大三', '大四', '研究生']
const faqCategories = ['报名流程', '简历/作品', '面试/交流', '开发者体系', '社团生活', '其他']

// 部门弹窗
const deptModalOpen = ref(false)
const editingDept = ref<Department | null>(null)
const deptForm = reactive<DeptForm>({
  name: '',
  summary: '',
  description: '',
  color: '',
  admin_emails: '',
  head_user_id: 0,
  base_seats: 1,
  floating_seats: 0,
  output_delivery: 0,
  output_usage: 0,
  output_talent: 0,
  output_activity: 0,
  output_note: '',
  enabled: 1,
  sort_order: 0,
})
const headOptions = ref<HeadOption[]>([])

// 岗位弹窗
const jobModalOpen = ref(false)
const editingJob = ref<AdminJob | null>(null)
const jobForm = reactive<JobForm>({
  title: '',
  department_id: 0,
  direction: '',
  location: '',
  type: 'fulltime',
  experience: '不限',
  education: '不限',
  salary: '',
  contact_wechat: '',
  tags: '',
  summary: '',
  responsibilities: '',
  requirements: '',
  bonus: '',
  description: '',
  headcount: 0,
  enabled: 1,
  sort_order: 0,
})

// 问答弹窗
const faqModalOpen = ref(false)
const editingFaq = ref<Faq | null>(null)
const faqForm = reactive<FaqForm>({
  category: '报名流程',
  question: '',
  answer: '',
  enabled: 1,
  sort_order: 0,
})

// 报名详情
const appDetailOpen = ref(false)
const appDetailLoading = ref(false)
const appDetail = ref<AdminApplication | null>(null)

// 站点配置
const siteForm = reactive({
  brand: '',
  heroTitle: '',
  heroSubtitle: '',
  announcement: '',
  tagline: '',
  contactEmail: '',
  bgWords: '',
  adminSubs: '',
})

const isGlobal = computed(() => Boolean(adminMe.value?.global))
const hasDepartments = computed(() => Boolean(adminMe.value?.departments?.length))
const staffRoleLabel = computed(() => {
  if (isGlobal.value) return '超级管理员'
  if (adminMe.value?.resourceReviewer) return '资源方代表'
  return '部门管理员'
})
const visibleTabs = computed(() =>
  tabs.filter((t) => {
    if (isGlobal.value) return true
    if (['overview', 'defenses'].includes(t.id)) return true
    if (
      hasDepartments.value &&
      ['jobs', 'applications', 'users', 'department-intro'].includes(t.id)
    ) {
      return true
    }
    return false
  }),
)

const snapshotLine = computed(() => {
  const s = appDetail.value?.snapshot || {}
  return [s.school, s.education, s.major, s.graduation_year].filter(Boolean).join(' · ')
})

function setError(msg: string) {
  error.value = msg
}

function showNotice(msg: string) {
  notice.value = msg
  window.setTimeout(() => {
    if (notice.value === msg) notice.value = ''
  }, 3000)
}

async function copyText(text: string, msg: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedText.value = text
    window.setTimeout(() => {
      if (copiedText.value === text) copiedText.value = ''
    }, 2000)
    showNotice(msg)
  } catch {
    window.prompt('复制', text)
  }
}

function clearMessages() {
  error.value = ''
  notice.value = ''
  modalError.value = ''
  appError.value = ''
}

async function loadAdminMe() {
  adminMe.value = await api.adminMe()
}
async function loadStats() {
  stats.value = await api.adminStats()
}
async function loadDepartments() {
  departments.value = (await api.adminDepartments()) || []
}
async function loadJobs() {
  jobs.value =
    (await api.adminJobs({
      q: jobsFilter.q,
      department: jobsFilter.department,
    })) || []
}
async function loadApplications() {
  applications.value =
    (await api.adminApplications({
      q: appsFilter.q,
      stage: appsFilter.status,
      department: appsFilter.department,
    })) || []
}
async function loadFaqs() {
  faqs.value = (await api.adminFaqs()) || []
}
async function loadHeadOptions() {
  try {
    headOptions.value = (await api.adminUserLookup('')) || []
  } catch {
    headOptions.value = []
  }
}

async function loadSite() {
  const s = (await api.adminSite()) as SiteConfig
  siteForm.brand = s.brand || ''
  siteForm.heroTitle = s.heroTitle || ''
  siteForm.heroSubtitle = s.heroSubtitle || ''
  siteForm.announcement = s.announcement || ''
  siteForm.tagline = s.tagline || ''
  siteForm.contactEmail = s.contactEmail || ''
  siteForm.bgWords = s.bgWords || ''
  siteForm.adminSubs = s.adminSubs || ''
}

async function loadAll() {
  loading.value = true
  clearMessages()
  try {
    await loadAdminMe()
    const tasks: Promise<unknown>[] = [
      loadStats(),
      loadDepartments(),
      loadJobs(),
      loadApplications(),
    ]
    // 部门管理员没有问答/站点权限，跳过这两个请求
    if (isGlobal.value) {
      tasks.push(loadFaqs(), loadSite(), loadHeadOptions())
    }
    await Promise.all(tasks)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

// ===== 部门 =====
function openDeptForm(d?: Department) {
  clearMessages()
  editingDept.value = d || null
  deptForm.name = d?.name || ''
  deptForm.summary = d?.summary || ''
  deptForm.description = d?.description || ''
  deptForm.color = d?.color || ''
  deptForm.admin_emails = d?.admin_emails || ''
  deptForm.head_user_id = Number((d as Record<string, unknown> | undefined)?.head_user_id) || 0
  deptForm.base_seats = Number((d as Record<string, unknown> | undefined)?.base_seats) || 1
  deptForm.floating_seats = Number((d as Record<string, unknown> | undefined)?.floating_seats) || 0
  deptForm.output_delivery = Number((d as Record<string, unknown> | undefined)?.output_delivery) || 0
  deptForm.output_usage = Number((d as Record<string, unknown> | undefined)?.output_usage) || 0
  deptForm.output_talent = Number((d as Record<string, unknown> | undefined)?.output_talent) || 0
  deptForm.output_activity = Number((d as Record<string, unknown> | undefined)?.output_activity) || 0
  deptForm.output_note = String((d as Record<string, unknown> | undefined)?.output_note || '')
  deptForm.enabled = d?.enabled ?? 1
  deptForm.sort_order = d?.sort_order ?? departments.value.length + 1
  if (!headOptions.value.length) void loadHeadOptions()
  const currentHead = (d as Record<string, unknown> | undefined)?.head as HeadOption | undefined
  if (currentHead && !headOptions.value.some((u) => u.id === currentHead.id)) {
    headOptions.value = [currentHead, ...headOptions.value]
  }
  deptModalOpen.value = true
}

async function saveDept() {
  modalError.value = ''
  saving.value = true
  try {
    const {
      base_seats: _base,
      floating_seats: _floating,
      output_delivery: _delivery,
      output_usage: _usage,
      output_talent: _talent,
      output_activity: _activity,
      output_note: _note,
      ...payload
    } = deptForm
    if (editingDept.value) {
      await api.adminUpdateDepartment(editingDept.value.id, payload)
      showNotice('部门已更新')
    } else {
      await api.adminCreateDepartment(payload)
      showNotice('部门已创建')
    }
    deptModalOpen.value = false
    await Promise.all([loadDepartments(), loadStats()])
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function deleteDept(d: Department) {
  if (!window.confirm(`确认删除部门「${d.name}」？`)) return
  try {
    await api.adminDeleteDepartment(d.id)
    showNotice('部门已删除')
    await Promise.all([loadDepartments(), loadStats()])
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
  }
}

// ===== 岗位 =====
function openJobForm(j?: AdminJob) {
  clearMessages()
  editingJob.value = j || null
  jobForm.title = j?.title || ''
  jobForm.department_id = j?.department_id || departments.value[0]?.id || 0
  jobForm.direction = j?.direction || ''
  jobForm.location = j?.location || ''
  jobForm.type = j?.type || 'fulltime'
  jobForm.experience = j?.experience || '不限'
  jobForm.education = j?.education || '不限'
  jobForm.salary = j?.salary || ''
  jobForm.contact_wechat = j?.contact_wechat || ''
  jobForm.tags = typeof j?.tags === 'string' ? j.tags : ''
  jobForm.summary = j?.summary || ''
  jobForm.responsibilities = j?.responsibilities || ''
  jobForm.requirements = j?.requirements || ''
  jobForm.bonus = j?.bonus || ''
  jobForm.description = j?.description || ''
  jobForm.headcount = j?.headcount || 0
  jobForm.enabled = j?.enabled ?? 1
  jobForm.sort_order = j?.sort_order ?? jobs.value.length + 1
  jobModalOpen.value = true
}

async function saveJob() {
  modalError.value = ''
  if (!jobForm.department_id) {
    modalError.value = '请选择所属部门'
    return
  }
  saving.value = true
  try {
    const payload = { ...jobForm }
    if (editingJob.value) {
      await api.adminUpdateJob(editingJob.value.id, payload)
      showNotice('岗位已更新')
    } else {
      await api.adminCreateJob(payload)
      showNotice('岗位已创建')
    }
    jobModalOpen.value = false
    await Promise.all([loadJobs(), loadStats(), loadDepartments()])
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function deleteJob(j: AdminJob) {
  if (!window.confirm(`确认删除岗位「${j.title}」？已有报名的岗位不能删除，请改为关闭。`)) return
  try {
    await api.adminDeleteJob(j.id)
    showNotice('岗位已删除')
    await Promise.all([loadJobs(), loadStats(), loadDepartments()])
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
  }
}

// ===== 报名 =====
async function openApp(a: AdminApplication) {
  clearMessages()
  appDetailOpen.value = true
  appDetailLoading.value = true
  appDetail.value = null
  try {
    appDetail.value = await api.adminApplication(a.id)
  } catch (e) {
    appError.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    appDetailLoading.value = false
  }
}

function closeAppDetail() {
  appDetailOpen.value = false
  appDetail.value = null
  appError.value = ''
}

async function scheduleInterview(a: AdminApplication) {
  const when = window.prompt('沟通时间（如 2026-11-06 19:00）', '')
  if (when === null) return
  const note = window.prompt('沟通记录（动机 / 时间投入，选填）', '') ?? ''
  try {
    await api.adminApplicationStage(a.id, {
      stage: 'interview',
      interview_at: when.trim(),
      interview_note: note.trim(),
    })
    showNotice('已记录沟通安排')
    await Promise.all([loadApplications(), loadStats()])
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败'
  }
}

async function pass(a: AdminApplication) {
  const msg =
    a.stage === 'submitted' || a.stage === 'interview'
      ? '确认部门双选通过？将向该同学发出确认，本人确认后才会进组。'
      : '刷新该报名的状态？'
  if (!window.confirm(msg)) return
  appError.value = ''
  try {
    await api.adminPassApplication(a.id)
    showNotice(a.stage === 'submitted' || a.stage === 'interview' ? '已发出双选确认，等待本人确认' : '状态已刷新')
    await Promise.all([loadApplications(), loadStats()])
    if (appDetailOpen.value && appDetail.value) {
      appDetail.value = await api.adminApplication(appDetail.value.id)
    }
  } catch (e) {
    const msg2 = e instanceof Error ? e.message : '操作失败'
    if (appDetailOpen.value) appError.value = msg2
    else error.value = msg2
  }
}

async function reject(a: AdminApplication) {
  const note = window.prompt('驳回原因（选填）', '')
  if (note === null) return
  appError.value = ''
  try {
    await api.adminRejectApplication(a.id, note)
    showNotice('已驳回')
    await Promise.all([loadApplications(), loadStats()])
    if (appDetailOpen.value && appDetail.value) {
      appDetail.value = await api.adminApplication(appDetail.value.id)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '操作失败'
    if (appDetailOpen.value) appError.value = msg
    else error.value = msg
  }
}

async function refreshOa() {
  refreshing.value = true
  try {
    const r = await api.adminRefreshOa()
    showNotice(`已刷新 ${r.refreshed ?? 0} 条申请`)
    await Promise.all([loadApplications(), loadStats()])
  } catch (e) {
    error.value = e instanceof Error ? e.message : '刷新失败'
  } finally {
    refreshing.value = false
  }
}

function openResumePdf(a: AdminApplication) {
  if (!a.resume_id) return
  window.open(api.resumeFileUrl(a.resume_id), '_blank')
}

// ===== 问答 =====
function openFaqForm(f?: Faq) {
  clearMessages()
  editingFaq.value = f || null
  faqForm.category = f?.category || '报名流程'
  faqForm.question = f?.question || ''
  faqForm.answer = f?.answer || ''
  faqForm.enabled = f?.enabled ?? 1
  faqForm.sort_order = f?.sort_order ?? 0
  faqModalOpen.value = true
}

async function saveFaq() {
  modalError.value = ''
  saving.value = true
  try {
    const payload = { ...faqForm }
    if (editingFaq.value) {
      await api.adminUpdateFaq(editingFaq.value.id, payload)
      showNotice('问答已更新')
    } else {
      await api.adminCreateFaq(payload)
      showNotice('问答已创建')
    }
    faqModalOpen.value = false
    await Promise.all([loadFaqs(), loadStats()])
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function deleteFaq(f: Faq) {
  if (!window.confirm(`确认删除问题「${f.question}」？`)) return
  try {
    await api.adminDeleteFaq(f.id)
    showNotice('问答已删除')
    await Promise.all([loadFaqs(), loadStats()])
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
  }
}

// ===== 站点 =====
async function saveSite() {
  siteSaving.value = true
  error.value = ''
  try {
    await api.adminUpdateSite({ ...siteForm })
    showNotice('站点配置已保存')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    siteSaving.value = false
  }
}

onMounted(loadAll)
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}
.admin-main {
  max-width: 1120px;
  margin: 0 auto;
  padding: 36px 24px 64px;
}
.admin-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.admin-user {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.admin-email {
  color: var(--ink-soft);
  font-size: 12px;
}
.admin-tabs {
  margin-top: 10px;
}
.admin-loading {
  padding: 80px 0;
  text-align: center;
  color: var(--ink-soft);
}
.admin-section {
  margin-top: 4px;
}
.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 16px;
  margin-top: 16px;
}
.quick-actions {
  display: grid;
  gap: 8px;
}
.quick-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 10px 0;
  border: none;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  text-align: left;
  transition: color 0.15s ease;
}
.quick-btn:hover {
  color: var(--ink);
}
.quick-btn b {
  font-size: 13px;
}
.quick-btn span {
  color: var(--ink-faint);
  font-size: 11px;
}
.dept-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cell-summary {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.admin-section .search {
  min-width: 220px;
}
.app-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.app-detail-head h3 {
  margin: 0 0 4px;
}
.app-detail-head p {
  margin: 0;
}
.admin-wechat {
  margin-top: 2px;
  color: var(--ink-soft);
  font-family: var(--font);
  font-size: 11px;
}
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 20px;
  padding: 14px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}
.detail-grid > div {
  display: flex;
  gap: 8px;
  min-width: 0;
}
.detail-grid span {
  color: var(--ink-faint);
  flex: none;
  min-width: 52px;
}
.detail-block {
  padding-top: 4px;
}
.detail-block h4 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-soft);
}
.detail-block p {
  margin: 0 0 6px;
  font-size: 13px;
  line-height: 1.75;
  color: var(--ink-soft);
  white-space: pre-wrap;
}
.detail-label {
  color: var(--ink-faint);
}
.resume-text {
  margin: 0;
  max-height: 300px;
  overflow: auto;
  padding: 12px;
  border-radius: 10px;
  background: var(--bg);
  white-space: pre-wrap;
  font-family: var(--font);
  font-size: 12px;
  line-height: 1.8;
  color: var(--ink-soft);
}
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.tl-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.tl-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 5px;
  background: #94a3b8;
  flex: none;
}
.dot-approve,
.dot-submit {
  background: #16a34a;
}
.dot-reject,
.dot-revoke {
  background: #dc2626;
}
.tl-head {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.link-btn {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--ink);
  font-size: 13px;
  text-align: left;
}

@media (max-width: 900px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .admin-main {
    padding: 24px 16px 48px;
  }
  .admin-section .search {
    min-width: 0;
    flex: 1 1 140px;
  }
}
</style>
