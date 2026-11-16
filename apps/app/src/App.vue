<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { checkAndRefreshToken } from '@/utils/auth'
import { needsLaunchConsent } from '@/utils/legal'
import { LEGAL_PAGE, PRIVACY_PAGE } from '@/utils/legal-core'

onShow(() => {
  if (needsLaunchConsent()) {
    const pages = getCurrentPages()
    const route = `/${pages[pages.length - 1]?.route || ''}`
    if (route !== PRIVACY_PAGE && route !== LEGAL_PAGE)
      uni.reLaunch({ url: PRIVACY_PAGE })

    return
  }
  void checkAndRefreshToken()
})
</script>

<style>
page {
  background: #f3f6fb;
  color: #20314a;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
#app {
  min-height: 100vh;
}
view,
scroll-view,
swiper-item,
text,
image,
input,
textarea,
label,
button {
  box-sizing: border-box;
}
.account-page {
  max-width: 960rpx;
  margin: 0 auto;
  padding: calc(env(safe-area-inset-top) + 88rpx) 40rpx calc(env(safe-area-inset-bottom) + 48rpx);
}
.account-heading {
  margin-bottom: 48rpx;
}
.account-title {
  display: block;
  font-size: 52rpx;
  font-weight: 700;
  line-height: 1.3;
}
.account-subtitle {
  display: block;
  margin-top: 18rpx;
  font-size: 28rpx;
  line-height: 1.6;
  color: #64748b;
}
.account-panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 20rpx;
  padding: 36rpx;
  margin-bottom: 28rpx;
}
.field-label {
  display: block;
  margin-bottom: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
}
.text-input {
  height: 92rpx;
  padding: 0 24rpx;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 12rpx;
  margin-bottom: 32rpx;
  font-size: 30rpx;
}
.text-input:focus {
  border-color: #3c68cb;
}
.primary-button {
  background: #3c68cb;
  color: #fff;
  font-size: 30rpx;
  border-radius: 12rpx;
  margin: 28rpx 0 0;
  line-height: 92rpx;
}
.secondary-button {
  background: #fff;
  color: #315aab;
  border: 1px solid #cbd5e1;
  font-size: 28rpx;
  border-radius: 12rpx;
  margin-top: 24rpx;
  line-height: 84rpx;
}
.primary-button[disabled],
.secondary-button[disabled] {
  opacity: 0.6;
}
.helper-text {
  display: block;
  margin-top: 24rpx;
  color: #64748b;
  font-size: 24rpx;
  line-height: 1.6;
}
.error-message {
  display: block;
  color: #b42318;
  font-size: 26rpx;
  line-height: 1.6;
  margin-top: 20rpx;
}
</style>
