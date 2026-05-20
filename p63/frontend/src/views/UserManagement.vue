<template>
  <div class="user-management-page">
    <el-page-header @back="goBack" content="用户管理" class="page-header" />
    
    <el-card class="user-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>用户列表</span>
          <el-select
            v-model="filterRole"
            placeholder="按角色筛选"
            size="small"
            style="width: 140px; margin-right: 12px;"
            clearable
            @change="loadUsers"
          >
            <el-option label="普通用户" value="user" />
            <el-option label="编辑" value="editor" />
            <el-option label="管理员" value="admin" />
          </el-select>
          <el-input
            v-model="searchKeyword"
            placeholder="搜索用户名/邮箱"
            size="small"
            style="width: 200px;"
            clearable
            @clear="loadUsers"
            @keyup.enter.native="loadUsers"
          >
            <template #suffix>
              <el-icon @click="loadUsers"><Search /></el-icon>
            </template>
          </el-input>
        </div>
      </template>

      <el-table :data="users" stripe style="width: 100%">
        <el-table-column prop="username" label="用户名" width="150">
          <template #default="{ row }">
            <div class="user-name-cell">
              <el-avatar :size="32">{{ row.username.charAt(0) }}</el-avatar>
              <span>{{ row.username }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="200" />
        <el-table-column prop="role" label="角色" width="140">
          <template #default="{ row }">
            <el-tag :type="getRoleType(row.role)" size="small">
              {{ getRoleText(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="lastActive" label="最后活跃" width="180">
          <template #default="{ row }">
            {{ row.lastActive ? formatDate(row.lastActive) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              @click="openRoleDialog(row)"
              :disabled="!canEditRole(row)"
            >
              修改角色
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="handleDelete(row)"
              :disabled="!canDeleteUser(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="total > 0"
        v-model:current-page="page"
        v-model:page-size="limit"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @current-change="loadUsers"
        @size-change="loadUsers"
      />
    </el-card>

    <el-dialog
      v-model="roleDialogVisible"
      title="修改用户角色"
      width="500px"
      @close="resetRoleForm"
    >
      <el-form
        ref="roleFormRef"
        :model="roleForm"
        label-width="100px"
        class="role-form"
      >
        <el-form-item label="用户名">
          <el-input v-model="currentUser.username" disabled />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="currentUser.email" disabled />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="roleForm.role" placeholder="请选择角色" style="width: 100%;">
            <el-option label="普通用户" value="user">
              <div style="display: flex; align-items: center; gap: 8px;">
                <el-tag size="small" type="info">普通用户</el-tag>
                <span style="font-size: 12px; color: #909399;">可上传拓片、释读文字</span>
              </div>
            </el-option>
            <el-option label="编辑" value="editor">
              <div style="display: flex; align-items: center; gap: 8px;">
                <el-tag size="small" type="success">编辑</el-tag>
                <span style="font-size: 12px; color: #909399;">可确认释读、查看统计、导出数据</span>
              </div>
            </el-option>
            <el-option label="管理员" value="admin">
              <div style="display: flex; align-items: center; gap: 8px;">
                <el-tag size="small" type="danger">管理员</el-tag>
                <span style="font-size: 12px; color: #909399;">拥有所有权限，可管理用户</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRole" :loading="savingRole">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { userAPI } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const savingRole = ref(false)
const users = ref([])
const page = ref(1)
const limit = ref(10)
const total = ref(0)
const filterRole = ref('')
const searchKeyword = ref('')

const roleDialogVisible = ref(false)
const roleFormRef = ref(null)
const currentUser = ref({})
const roleForm = ref({ role: '' })

const permissions = ref({})

const loadPermissions = async () => {
  try {
    const response = await userAPI.getPermissions()
    permissions.value = response.data.permissions || {}
    
    if (!permissions.value.canManageUsers) {
      ElMessage.error('您没有用户管理权限')
      router.push('/')
    }
  } catch (error) {
    console.error('加载权限失败:', error)
    ElMessage.error('加载用户权限失败')
  }
}

const loadUsers = async () => {
  loading.value = true
  try {
    const params = {
      page: page.value,
      limit: limit.value
    }
    
    if (filterRole.value) {
      params.role = filterRole.value
    }
    
    if (searchKeyword.value) {
      params.search = searchKeyword.value
    }
    
    const response = await userAPI.list(params)
    users.value = response.data.users || []
    total.value = response.data.pagination?.total || 0
  } catch (error) {
    ElMessage.error('加载用户列表失败')
  } finally {
    loading.value = false
  }
}

const openRoleDialog = (user) => {
  currentUser.value = { ...user }
  roleForm.value.role = user.role
  roleDialogVisible.value = true
}

const resetRoleForm = () => {
  currentUser.value = {}
  roleForm.value = { role: '' }
}

const saveRole = async () => {
  if (!roleForm.value.role) {
    ElMessage.warning('请选择角色')
    return
  }

  savingRole.value = true
  try {
    await userAPI.updateRole(currentUser.value._id, roleForm.value.role)
    ElMessage.success('角色修改成功')
    roleDialogVisible.value = false
    loadUsers()
  } catch (error) {
    if (error.response?.status === 403) {
      ElMessage.error(error.response.data.message || '权限不足')
    } else {
      ElMessage.error('修改角色失败')
    }
  } finally {
    savingRole.value = false
  }
}

const handleDelete = async (user) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 "${user.username}" 吗？删除后无法恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await userAPI.delete(user._id)
    ElMessage.success('用户删除成功')
    loadUsers()
  } catch (error) {
    if (error !== 'cancel') {
      if (error.response?.status === 403) {
        ElMessage.error(error.response.data.message || '权限不足')
      } else {
        ElMessage.error('删除用户失败')
      }
    }
  }
}

const canEditRole = computed(() => (user) => {
  if (!permissions.value.canManageUsers) return false
  if (user._id === authStore.user?.id) return false
  if (user.role === 'admin' && authStore.user?.role !== 'admin') return false
  return true
})

const canDeleteUser = computed(() => (user) => {
  if (!permissions.value.canDelete) return false
  if (user._id === authStore.user?.id) return false
  if (user.role === 'admin') return false
  return true
})

const getRoleType = (role) => {
  const map = {
    user: 'info',
    editor: 'success',
    admin: 'danger'
  }
  return map[role] || 'info'
}

const getRoleText = (role) => {
  const map = {
    user: '普通用户',
    editor: '编辑',
    admin: '管理员'
  }
  return map[role] || role
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

const goBack = () => {
  router.back()
}

onMounted(() => {
  loadPermissions()
  loadUsers()
})
</script>

<style scoped>
.user-management-page {
  min-height: 100%;
  background: #f5f7fa;
}

.page-header {
  background: #fff;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.user-card {
  margin: 0 20px 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pagination {
  margin-top: 20px;
  text-align: right;
}

.role-form {
  padding: 20px 0;
}
</style>
