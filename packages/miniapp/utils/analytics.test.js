const assert = require('node:assert/strict')
const test = require('node:test')

function loadAnalytics(wxMock) {
  global.wx = wxMock
  delete require.cache[require.resolve('./analytics')]
  return require('./analytics')
}

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve))
}

function randomValuesMock({ length, success }) {
  randomValuesMock.calls = (randomValuesMock.calls || 0) + 1
  const bytes = new Uint8Array(length)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (index + randomValuesMock.calls) % 256
  }
  success({ randomValues: bytes.buffer })
}

test('并发 onShow 只初始化一个 visitorId，每次生成不同 eventId', async () => {
  randomValuesMock.calls = 0
  const requests = []
  const storage = new Map()
  const analytics = loadAnalytics({
    getRandomValues: randomValuesMock,
    getStorageSync(key) { return storage.get(key) },
    setStorageSync(key, value) { storage.set(key, value) },
    request(options) { requests.push(options); options.fail(new Error('offline')) },
  })
  const app = { globalData: { apiBaseUrl: 'https://example.test/api', token: 'valid-token' } }

  assert.equal(analytics.trackAppVisit(app), true)
  assert.equal(analytics.trackAppVisit(app), true)
  await flushAsyncWork()

  assert.equal(requests.length, 2)
  assert.equal(requests[0].url, 'https://example.test/api/analytics/app-visits')
  assert.equal(requests[0].timeout, 5000)
  assert.match(requests[0].data.eventId, /^[0-9a-f-]{36}$/)
  assert.match(requests[0].data.visitorId, /^v_[0-9a-f]{32}$/)
  assert.equal(requests[0].data.visitorId, requests[1].data.visitorId)
  assert.notEqual(requests[0].data.eventId, requests[1].data.eventId)
  assert.equal(requests[0].header.Authorization, 'Bearer valid-token')
  assert.equal(randomValuesMock.calls, 3, '一个 visitorId 加两个独立 eventId')
})

test('没有安全随机接口时同步跳过采集', async () => {
  const analytics = loadAnalytics({ getStorageSync() {}, request() { throw new Error('should not request') } })
  assert.equal(analytics.trackAppVisit({ globalData: { apiBaseUrl: 'https://example.test' } }), false)
  await flushAsyncWork()
})

test('随机接口失败或同步抛错时不请求', async () => {
  for (const getRandomValues of [
    ({ fail }) => fail(new Error('random unavailable')),
    () => { throw new Error('sync random failure') },
  ]) {
    let requested = false
    const analytics = loadAnalytics({
      getRandomValues,
      getStorageSync() { throw new Error('storage unavailable') },
      setStorageSync() { throw new Error('storage unavailable') },
      request() { requested = true; throw new Error('sync request failure') },
    })
    assert.equal(analytics.trackAppVisit({ globalData: { apiBaseUrl: 'https://example.test' } }), true)
    await flushAsyncWork()
    assert.equal(requested, false)
  }
})

test('visitorId 随机初始化临时失败后，下次 onShow 可以恢复', async () => {
  let randomCalls = 0
  const requests = []
  const analytics = loadAnalytics({
    getRandomValues({ length, success, fail }) {
      randomCalls += 1
      if (randomCalls === 1) {
        fail(new Error('temporary failure'))
        return
      }
      const bytes = new Uint8Array(length).fill(randomCalls)
      success({ randomValues: bytes.buffer })
    },
    getStorageSync() {},
    setStorageSync() {},
    request(options) { requests.push(options) },
  })
  const app = { globalData: { apiBaseUrl: 'https://example.test' } }

  analytics.trackAppVisit(app)
  await flushAsyncWork()
  assert.equal(requests.length, 0)

  analytics.trackAppVisit(app)
  await flushAsyncWork()
  assert.equal(requests.length, 1)
  assert.match(requests[0].data.visitorId, /^v_[0-9a-f]{32}$/)
  assert.match(requests[0].data.eventId, /^[0-9a-f-]{36}$/)
})

test('存储和请求同步失败不影响采集调用', async () => {
  randomValuesMock.calls = 0
  let requestCalls = 0
  const analytics = loadAnalytics({
    getRandomValues: randomValuesMock,
    getStorageSync() { throw new Error('read failed') },
    setStorageSync() { throw new Error('write failed') },
    request() { requestCalls += 1; throw new Error('request failed') },
  })

  assert.equal(analytics.trackAppVisit({ globalData: { apiBaseUrl: 'https://example.test' } }), true)
  await flushAsyncWork()
  assert.equal(requestCalls, 1)
})
