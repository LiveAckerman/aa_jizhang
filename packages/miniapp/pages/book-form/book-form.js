const api = require('../../utils/api')
const { SCENES } = require('../../constants/ledger')
const { request } = require('../../utils/request')

Page({
  data: {
    id: '',
    isEdit: false,
    name: '',
    description: '',
    scene: 'travel',
    customName: '', // scene==='custom' 时用户自定义的场景名
    cover: '',
    scenes: SCENES,
    saving: false,
    loading: false,
  },

  onLoad(query) {
    if (query && query.id) {
      this.setData({ id: query.id, isEdit: true })
      wx.setNavigationBarTitle({ title: '编辑账本' })
      this.loadBook(query.id)
    } else {
      wx.setNavigationBarTitle({ title: '创建账本' })
    }
  },

  async loadBook(id) {
    this.setData({ loading: true })
    try {
      const book = await api.bookDetail(id)
      // scene 不在预设列表里 → 视为自定义场景，回填到自定义输入框
      const isPreset = SCENES.some((s) => s.key === book.scene && s.key !== 'custom')
      if (isPreset) {
        this.setData({
          name: book.name,
          description: book.description || '',
          scene: book.scene,
          cover: book.cover || '',
          loading: false,
        })
      } else {
        this.setData({
          name: book.name,
          description: book.description || '',
          scene: 'custom',
          customName: book.sceneName || book.scene || '',
          cover: book.cover || '',
          loading: false,
        })
      }
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },
  onDescInput(e) {
    this.setData({ description: e.detail.value })
  },
  onPickScene(e) {
    this.setData({ scene: e.currentTarget.dataset.key })
  },
  onCustomNameInput(e) {
    this.setData({ customName: e.detail.value })
  },

  // 选择并上传自定义封面
  async onChooseCover() {
    try {
      const res = await wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['camera', 'album'] })
      if (!res.tempFiles || res.tempFiles.length === 0) return
      const filePath = res.tempFiles[0].tempFilePath
      wx.showLoading({ title: '上传中...', mask: true })
      const url = await this.uploadImage(filePath)
      wx.hideLoading()
      this.setData({ cover: url })
      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      if (e.errMsg && e.errMsg.includes('cancel')) return // 用户取消选图
      console.error('选择封面失败', e)
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  uploadImage(filePath) {
    const baseUrl = getApp().globalData.apiBaseUrl
    const token = getApp().globalData.token
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${baseUrl}/upload/image`,
        filePath,
        name: 'file',
        header: token ? { Authorization: `Bearer ${token}` } : {},
        success(r) {
          try {
            const body = JSON.parse(r.data)
            if (body.code === 0) resolve(body.data.url)
            else reject(body)
          } catch (e) {
            reject(e)
          }
        },
        fail: reject,
      })
    })
  },

  async onSave() {
    const name = this.data.name.trim()
    if (!name) {
      wx.showToast({ title: '请输入账本名称', icon: 'none' })
      return
    }
    // 自定义场景需填写场景名
    const customName = (this.data.customName || '').trim()
    if (this.data.scene === 'custom' && !customName) {
      wx.showToast({ title: '请输入自定义场景名', icon: 'none' })
      return
    }
    if (this.data.saving) return
    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...', mask: true })
    const payload = {
      name,
      scene: this.data.scene,
      sceneName: this.data.scene === 'custom' ? customName : '',
      description: this.data.description,
      cover: this.data.cover,
    }
    try {
      if (this.data.isEdit) {
        await api.updateBook(this.data.id, payload)
        wx.hideLoading()
        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 600)
      } else {
        const book = await api.createBook(payload)
        wx.hideLoading()
        wx.showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => {
          wx.redirectTo({ url: `/pages/book-detail/book-detail?id=${book.id}` })
        }, 600)
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: (e && e.message) || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },
})
