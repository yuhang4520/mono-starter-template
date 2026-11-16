import type { UserInfo } from '@/types/user'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authSession, clearTokens } from '@/utils/auth'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo | null>(null)
  authSession.onClear(() => {
    userInfo.value = null
  })
  const setUserInfo = (info: UserInfo) => {
    userInfo.value = info
  }
  const logout = () => {
    clearTokens()
  }

  return { userInfo, setUserInfo, logout }
}, { persist: true })
