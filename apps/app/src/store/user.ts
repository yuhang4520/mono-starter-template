import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface UserInfo {
  id: string
  name: string
  email?: string
  phoneNumber?: string
}

export const useUserStore = defineStore(
  'user',
  () => {
    const userInfo = ref<UserInfo>({
      id: '-1',
      name: '',
    })

    const setUserInfo = (info: UserInfo) => {
      userInfo.value = info
    }

    const logout = () => {
      userInfo.value = {
        id: '-1',
        name: '',
      }
    }

    return {
      userInfo,
      setUserInfo,
      logout,
    }
  },
  {
    persist: true,
  },
)
