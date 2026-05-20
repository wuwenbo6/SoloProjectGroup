<template>
  <div class="library-page">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>古籍库</span>
          <div class="header-actions">
            <el-input
                v-model="searchKeyword"
                placeholder="搜索古籍名称"
                style="width: 250px; margin-right: 10px;"
                clearable
            />
            <el-button type="primary" @click="searchBooks">搜索</el-button>
          </div>
        </div>
      </template>

      <el-table :data="bookList" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="bookName" label="古籍名称" width="150" />
        <el-table-column prop="pageNumber" label="页码" width="100" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="extractedText" label="提取文字预览" show-overflow-tooltip />
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" @click="goToRestoration(scope.row.id)">
              修复
            </el-button>
            <el-button type="success" size="small" @click="viewDetail(scope.row.id)">
              详情
            </el-button>
            <el-button type="danger" size="small" @click="deleteBook(scope.row.id)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { databaseApi } from '@/api'

const router = useRouter()

const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

const bookList = ref([
  { id: 1, bookName: '论语', pageNumber: 1, status: 1, extractedText: '子曰学而时习之...', createTime: '2024-01-15 10:30:00' },
  { id: 2, bookName: '孟子', pageNumber: 3, status: 2, extractedText: '孟子见梁惠王...', createTime: '2024-01-15 14:20:00' },
  { id: 3, bookName: '大学', pageNumber: 2, status: 1, extractedText: '大学之道在明明德...', createTime: '2024-01-16 09:15:00' },
  { id: 4, bookName: '中庸', pageNumber: 1, status: 3, extractedText: '天命之谓性...', createTime: '2024-01-16 11:45:00' }
])

const getStatusType = (status) => {
  const typeMap = { 1: 'info', 2: 'warning', 3: 'success' }
  return typeMap[status] || 'info'
}

const getStatusText = (status) => {
  const textMap = { 1: '待处理', 2: '修复中', 3: '已完成' }
  return textMap[status] || '未知'
}

const searchBooks = async () => {
  console.log('搜索:', searchKeyword.value)
}

const goToRestoration = (id) => {
  router.push(`/restoration/${id}`)
}

const viewDetail = (id) => {
  console.log('查看详情:', id)
}

const deleteBook = (id) => {
  console.log('删除:', id)
}

const handleSizeChange = (size) => {
  pageSize.value = size
}

const handleCurrentChange = (page) => {
  currentPage.value = page
}

onMounted(() => {
  total.value = 128
})
</script>

<style scoped>
.library-page {
  min-height: 600px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination {
  margin-top: 20px;
  text-align: right;
}
</style>
