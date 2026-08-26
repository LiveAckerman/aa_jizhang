const { DOCUMENTS } = require('../../../constants/documents')

Page({
  data: {
    title: '',
    content: '',
    version: '',
    updatedAt: '',
  },

  onLoad(query) {
    const type = query.type || 'terms'
    const doc = DOCUMENTS[type]

    if (!doc) {
      wx.showToast({ title: '文档不存在', icon: 'none' })
      return
    }

    // 标题由自定义 nav-bar 组件的 title 属性渲染

    this.setData({
      title: doc.title,
      content: doc.content,
      version: doc.version,
      updatedAt: doc.updatedAt,
    })
  },
})
