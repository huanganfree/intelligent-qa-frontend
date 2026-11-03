import { createRouter, createWebHistory } from 'vue-router'
import { mockRouters } from './mockRouters'
import Layout from '@/components/Layout.vue'
import { fetchGetUserMenus } from '@/api/login/login'
import { flatToTree, type MenuNode } from '@/utils/utilFunc'
import { useAuthStore } from '@/stores/useAuthStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_PUBLIC_PATH),
  routes: [
    {
      path: '/',
      name: 'layout',
      component: Layout,
      redirect: '/ai/qa',
      children: []
    },
    {
      path: '/ai/qa',
      name: 'qa',
      component: () => import('@/views/ai/aiQA/aiQA.vue')
    }
  ]
})


export default router
