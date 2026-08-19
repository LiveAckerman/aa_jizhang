# 一起分账吧 - API 测试

## 环境变量
```
@baseUrl = http://localhost:9080/api
@token = 你的JWT_TOKEN
```

---

## 1. 用户认证

### 1.1 微信登录（首次）
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "code": "微信登录code"
}

### 1.2 微信登录（返回token后，保存到 @token）

---

## 2. 文件上传

### 2.1 上传头像
POST {{baseUrl}}/upload/avatar
Authorization: Bearer {{token}}
Content-Type: multipart/form-data

# 使用 Postman 或 Apifox 选择文件

---

## 3. 用户信息

### 3.1 获取当前用户信息
GET {{baseUrl}}/user/profile
Authorization: Bearer {{token}}

### 3.2 更新用户信息
PUT {{baseUrl}}/user/profile
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "nickname": "测试用户",
  "avatar": "https://cdn.ljw44.com/avatar/test.png"
}

---

## 4. 账本管理（待开发）

### 4.1 创建账本
POST {{baseUrl}}/books
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "name": "北京旅游",
  "icon": "🏖️",
  "description": "2026年夏季北京旅行"
}

### 4.2 获取账本列表
GET {{baseUrl}}/books
Authorization: Bearer {{token}}

### 4.3 获取账本详情
GET {{baseUrl}}/books/{{bookId}}
Authorization: Bearer {{token}}

---

## 测试流程

### 完整首次登录流程测试

```bash
# Step 1: 微信登录
curl -X POST http://localhost:9080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"code":"测试code"}'

# 预期返回：
# {
#   "code": 200,
#   "data": {
#     "token": "eyJhbGc...",
#     "isNewUser": true,
#     "user": {
#       "nickname": "用户1234",
#       "avatar": "https://cdn.ljw44.com/avatar/default.png"
#     }
#   }
# }

# Step 2: 上传头像（使用 Postman/Apifox）
# POST http://localhost:9080/api/upload/avatar
# Headers: Authorization: Bearer {token}
# Body: form-data, file: 选择图片

# 预期返回：
# {
#   "code": 200,
#   "data": {
#     "url": "https://cdn.ljw44.com/avatar/uuid-xxx.png"
#   }
# }

# Step 3: 更新用户信息
curl -X PUT http://localhost:9080/api/user/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "nickname": "张三",
    "avatar": "https://cdn.ljw44.com/avatar/uuid-xxx.png"
  }'

# 预期返回：
# {
#   "code": 200,
#   "data": {
#     "nickname": "张三",
#     "avatar": "https://cdn.ljw44.com/avatar/uuid-xxx.png",
#     "isProfileComplete": true
#   }
# }

# Step 4: 再次登录（验证 isNewUser 为 false）
curl -X POST http://localhost:9080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"code":"新的测试code"}'

# 预期返回：
# {
#   "data": {
#     "isNewUser": false,  // 已完善信息
#     "user": {
#       "nickname": "张三",
#       "avatar": "https://cdn.ljw44.com/avatar/uuid-xxx.png"
#     }
#   }
# }
```

---

## 常见错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（token无效或过期） |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 推荐工具

- **Postman** - API 测试工具
- **Apifox** - 国产 API 工具，支持中文
- **REST Client** - VS Code 插件
- **curl** - 命令行工具
