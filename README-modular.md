# 模块化版本（实验性）

`index-modular.html` 是对经典单页应用的模块化重构。当前状态：

- ✅ 启动、图片列表、搜索、排序、分页、网格/列表/瀑布流切换
- ✅ 图片详情模态框、主题切换、管理员登录表单
- ✅ 图片源降级：GitHub Contents API → `images/manifest.json` → 目录索引
- ✅ 管理员登录后通过 GitHub Contents API 持久化上传（浏览器端压缩为 JPEG）
- ✅ AI 分析标签页：调用后端视觉模型（需启动后端并配置 API 地址）
- ⏸ Prompt/多模态 UI 尚未接入
- ⏸ 默认不请求后端；未配置时 AI 标签页只显示配置提示

> 生产使用请优先选择 `index.html`。模块化版用于验证架构和逐步迁移。

## 运行

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080/index-modular.html
```

## 模块结构

```
src/js/
├── app.js               # 应用入口、生命周期、UI 绑定
├── config.js            # 全局配置（唯一配置源）
├── utils.js             # 工具函数（含 GitHub Token 校验、哈希）
├── logger.js            # 日志命名空间
├── eventManager.js      # 发布-订阅事件总线
├── storageManager.js    # localStorage/sessionStorage/内存适配器
├── imageSource.js       # 图片来源：GitHub API / manifest / 目录索引
├── uploader.js          # 模块化版上传：压缩、sha 覆盖、GitHub Contents API
├── imageManager.js      # 图片加载、元数据、缩略图、内存缓存
├── galleryManager.js    # 搜索、过滤、排序、分页、视图
├── galleryRenderer.js   # 网格/列表/瀑布流 DOM 渲染
├── aiEngine.js          # TensorFlow.js 分析引擎（默认关闭）
├── adminManager.js      # GitHub Token 登录、权限、日志
├── apiClient.js         # FastAPI 客户端（可选）
├── promptEngine.js      # Prompt 规则引擎（本地降级）
├── multimodalEngine.js  # 多模态客户端（未接入 UI）
└── imageWorker.js       # 图像处理 Worker（已修复脚本语法，暂未启用）
```

## 数据流

1. `app.initialize()` → `galleryManager.refreshGallery()`
2. `imageSource.loadImages()`
   - GitHub Contents API 获取最新文件名/大小
   - 并行读取 `images/manifest.json`，补齐 Git 提交时间
   - API 失败时回退清单，再失败回退目录索引
3. `galleryManager` 过滤/排序/分页 → 发 `gallery:display-updated`
4. `galleryRenderer` 渲染 → 发 `gallery:rendered`
5. `app` 触发 `LazyLoader.observeAll()`，并同步分页/计数 UI
6. 上传：`uploader.uploadFiles()` → 压缩 → GitHub Contents API → `imageSource.invalidate()` → 重新拉取
7. AI：详情页标签页 → `analysisAPI.analyzeUrl()` → 后端视觉模型（或 mock）→ 更新标签/描述/检测对象

## 后端联调

默认 `CONFIG.API.ENABLED=false`，不会发送任何后端请求。启用方式：

```js
localStorage.setItem('api_base_url', 'http://localhost:8000/api/v1');
location.reload();
```

启用后 `apiClient` 会做健康检查并加载 Prompt 模板。注意 `index-modular.html` 的 CSP 已允许
`http://localhost:8000` 与 `https://api.github.com`。

## AI 分析模式

模块化版不再加载 TensorFlow.js（避免模型体积与 CSP `unsafe-eval` 问题），AI 分析通过
后端 `POST /api/v1/analysis/url` 完成：

1. 启动 `backend/`，可选配置 `OPENAI_API_KEY`（无 Key 时后端返回 mock，`provider` 字段区分）；
2. 在浏览器控制台设置：
   ```js
   localStorage.setItem('api_base_url', 'http://localhost:8000/api/v1');
   location.reload();
   ```
3. 打开图片详情 → AI 分析 → 自动调用后端并显示标签、描述、检测对象。

URL 分析只允许配置中的 `ALLOWED_IMAGE_HOSTS`；如果前端部署在其他域名，需要在
`backend/.env` 中追加对应主机。

## 已知缺口

- AI 结果目前只展示在详情模态框，尚未写入卡片层。
- Prompt/多模态引擎没有对应 UI。
- `imageWorker.js` 未接入图片管线。
- 后端风格迁移/图像编辑仍是 mock；图像分析/Prompt/多模态在配置 Key 后为真实模型。
- 新上传图片不会自动生成 WebP 缩略图，需要运行 `npm run generate:thumbnails`。

## 已知修复记录

- 修复 `storageManager.specializedStorage` 未挂载、`userPreferences`/`adminData` 访问器缺失。
- 补齐 `CONFIG.SEARCH/GITHUB/ADMIN/UI/IMAGE` 配置，修复 `ResponsiveManager`、`ActivityLogManager` 初始化崩溃。
- 修复 `galleryRenderer` 未监听 `gallery:display-updated`、分页空结果、空搜索显示全部图片。
- 修复 GitHub Token 校验方法名、`StringUtils.hash`、`emitImageLoading`、`ModalManager.closeAll` 等缺失 API。
- 将 Tailwind/Font Awesome 本地化，避免 CDN/SRI 漂移；PWA 资源与 WebP 缩略图已补齐。
- 接入 GitHub 持久化上传，并复用管理员 Token（sessionStorage）。
