<script setup lang="ts">
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { ref } from 'vue'
import LegalLinks from '@/components/LegalLinks.vue'
import { trpc } from '@/lib/trpc'
import { useUserStore } from '@/store'
import { getAuthSessionVersion, saveTokens } from '@/utils/auth'
import { safeLoginRedirect, SessionChangedError } from '@/utils/auth-core'
import { acceptLegalTerms, clearLegalConsent, hasLegalConsent } from '@/utils/legal'

const phone = ref('')
const password = ref('')
const busy = ref(false)
const errorMessage = ref('')
const agreed = ref(hasLegalConsent())
let destination = '/pages/index/index'
let active = true
onUnload(() => {
  active = false
})

onLoad((query) => {
  destination = safeLoginRedirect(query?.redirect)
})

async function login() {
  if (!active || busy.value)
    return
  errorMessage.value = ''
  if (!agreed.value) {
    errorMessage.value = '请先阅读并同意隐私政策和用户协议'

    return
  }
  if (!/^1\d{10}$/.test(phone.value.trim()) || password.value.length < 6) {
    errorMessage.value = '请输入有效手机号和至少 6 位密码'

    return
  }
  const version = getAuthSessionVersion()
  busy.value = true
  try {
    acceptLegalTerms()
    const result = await trpc.auth.loginByPhoneNumber.mutate({ phoneNumber: phone.value.trim(), password: password.value })
    if (!active || version !== getAuthSessionVersion() || !hasLegalConsent())
      throw new SessionChangedError()
    saveTokens(result)
    useUserStore().setUserInfo(result.user)
    password.value = ''
    uni.reLaunch({ url: destination })
  }
  catch (error) {
    if (active && version === getAuthSessionVersion())
      errorMessage.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
  }
  finally {
    if (active)
      busy.value = false
  }
}

function changeAgreement(event: { detail: { value: string[] } }) {
  agreed.value = event.detail.value.includes('agreed')
  if (!agreed.value)
    clearLegalConsent()
}
</script>

<template>
  <view class="account-page">
    <view class="account-heading">
      <text class="account-title">登录</text>
      <text class="account-subtitle">登录后继续使用你的工作空间</text>
    </view>
    <view class="account-panel">
      <label class="field-label" for="phone">手机号</label>
      <input id="phone" v-model="phone" class="text-input" type="number" :maxlength="11" placeholder="请输入手机号" :disabled="busy">
      <label class="field-label" for="password">密码</label>
      <input id="password" v-model="password" class="text-input" password :maxlength="128" placeholder="请输入密码" :disabled="busy" confirm-type="done" @confirm="login">
      <checkbox-group @change="changeAgreement">
        <label class="helper-text"><checkbox value="agreed" :checked="agreed" :disabled="busy" />我已阅读并同意以下协议</label>
      </checkbox-group>
      <LegalLinks />
      <text v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</text>
      <button class="primary-button" :loading="busy" :disabled="busy" @click="login">
        登录
      </button>
      <text class="helper-text">还没有账号？请联系工作空间管理员。</text>
    </view>
  </view>
</template>
