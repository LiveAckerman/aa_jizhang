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
    cover: '',
    scenes: SCENES,
    saving: false,
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
    try {
      const book = await api.bookDetail(id)
      this.setData({
        name: book.name,
        description: book.description || '',
        scene: book.scene,
        cover: book.cover || '',
      })
    } catch (e) {}
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

  // 选择并上传自定义封面
  async onChooseCover() {
    try {
      const res = await wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['camera', 'album'] })
      const filePath = res.tempFiles[0].tempFilePath
      wx.showLoading({ title: '上传中...', mask: true })
      const url = await this.uploadImage(filePath)
      wx.hideLoading()
      this.setData({ cover: url })
    } catch (e) {
      wx.hideLoading()
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
    if (this.data.saving) return
    this.setData({ saving: true })
    const payload = {
      name,
      scene: this.data.scene,
      description: this.data.description,
      cover: this.data.cover,
    }
    try {
      if (this.data.isEdit) {
        await api.updateBook(this.data.id, payload)
        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 600)
      } else {
        const book = await api.createBook(payload)
        wx.showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => {
          wx.redirectTo({ url: `/pages/book-detail/book-detail?id=${book.id}` })
        }, 600)
      }
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },
})
