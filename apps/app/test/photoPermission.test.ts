import assert from 'node:assert/strict'
import { it } from 'node:test'
import { classifyPhotoSelectionError, createPhotoSelectionFailureHandler } from '../src/utils/photoPermission'

function setup(platform: string, confirm = true) {
  const toasts: string[] = []
  const modals: { content: string, confirmText: string }[] = []
  const opened: string[] = []
  const handler = createPhotoSelectionFailureHandler(platform, {
    showToast: ({ title }) => toasts.push(title),
    showModal: (options) => {
      modals.push(options)
      options.success({ confirm })
    },
    openSetting: () => opened.push('mini-program'),
    openAppAuthorizeSetting: () => opened.push('system'),
  })

  return { handler, toasts, modals, opened }
}

it('image picker cancellation is silent on every platform', () => {
  for (const platform of ['app', 'app-plus', 'mp-weixin', 'app-harmony', 'h5']) {
    const state = setup(platform)
    for (const error of [{ errMsg: 'chooseImage:fail cancel' }, { errMsg: 'chooseImage:fail 用户取消', errCode: -2 }, { errCode: 1101001 }])
      assert.equal(state.handler(error), 'cancelled')
    assert.deepEqual([state.toasts, state.modals, state.opened], [[], [], []])
  }
})

it('unknown failures and ambiguous native codes are not treated as permission denial', () => {
  for (const error of [undefined, { errCode: -2 }, { errMsg: 'chooseImage:fail file missing' }]) {
    const state = setup('app')
    assert.equal(state.handler(error), 'failed')
    assert.equal(state.toasts.length, 1)
    assert.deepEqual(state.opened, [])
  }
  assert.equal(classifyPhotoSelectionError({ errCode: -2, errMsg: 'permission denied' }), 'denied')
})

it('native denial opens system settings only after confirmation', () => {
  for (const platform of ['app', 'app-plus', 'app-harmony']) {
    const accepted = setup(platform)
    accepted.handler({ errMsg: 'permission denied' })
    assert.deepEqual(accepted.opened, ['system'])
    const declined = setup(platform, false)
    declined.handler({ errCode: 1101005 })
    assert.deepEqual(declined.opened, [])
  }
})

it('WeChat distinguishes mini-program authorization from host system permission', () => {
  const mini = setup('mp-weixin')
  mini.handler({ errMsg: 'chooseImage:fail auth deny' })
  assert.deepEqual(mini.opened, ['mini-program'])
  const system = setup('mp-weixin')
  system.handler({ errMsg: 'chooseImage:fail system permission denied' })
  assert.deepEqual(system.opened, ['system'])
})

it('H5 gives manual instructions without calling native settings APIs', () => {
  const state = setup('h5')
  state.handler({ errMsg: 'permission denied' })
  assert.deepEqual(state.opened, [])
  assert.match(state.modals[0].content, /浏览器/)
  assert.equal(state.modals[0].confirmText, '知道了')
})

it('missing or failing settings API provides a manual fallback without retrying selection', () => {
  const messages: string[] = []
  for (const mode of ['missing', 'throw', 'fail']) {
    const handler = createPhotoSelectionFailureHandler('app', {
      showToast: ({ title }) => messages.push(title),
      showModal: (options) => {
        messages.push(options.content)
        options.success({ confirm: true })
      },
      openAppAuthorizeSetting: mode === 'missing'
        ? undefined
        : ({ fail }) => {
            if (mode === 'throw')
              throw new Error('not supported')
            fail()
          },
    })
    assert.equal(handler({ errMsg: 'permission denied' }), 'denied')
  }
  assert.equal(messages.length, 5)
})
