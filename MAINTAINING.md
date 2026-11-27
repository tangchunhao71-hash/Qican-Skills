# Qican-Skills 维护与发行

公开仓库为 [Qican-Skills](https://github.com/tangchunhao71-hash/Qican-Skills)。公开插件、CLI 和目录使用 ID `qican-skills`，历史发行保留当时的 ID 和文件名。已有私人插件继续沿其现有身份和发布入口维护。

## 新增和维护 Skill

在真实需求出现后新增 Skill。在 `skills.json` 登记其目录名和依赖，并把审核过的文件逐个加入 `scripts/release-files.json`。每个入口单独校验其依赖闭包和文件引用。文章镜像保留原路径以兼容既有分发，供文章流程按阶段读取。

通用方法只在本仓库 skills/cyber-qican/references/reasoning.md 维护。私人包采用时从已同意的固定版本派生，单独保留本人知识入口及生产配置。

新知识先留在其原有知识来源。考虑对外分享时，复核原证、时效、反例、适用范围、第三方授权及重新识别风险；仅将获准的独立表述和公开出处放进已有参考文件。正式写作规则改变只核对受影响的文章依赖。若想改思考入口的行为，单独提出改动理由，用同题对照检验。四类更新均不自动触发公开发行。

## 发行

1. 核对发版差异、隐私、来源和许可。补上当前验证记录，统一两个插件清单和 CLI 版本。
2. 运行测试、构建和检查。完整 Git 检出可附加历史扫描。

```sh
npm test
npm run build
npm run check -- --git
```

3. 以通过审核的签名提交为准，打标签并发布 Release。当前产物为 `cyber-qican.md`、`qican-skills-skills.zip`、`qican-skills-plugin.zip` 和 `SHA256SUMS`。
4. 匿名读回仓库和新版 Release 附件，校验版本、引用、安装与哈希，确认新版标为 Latest。更新已存在的入口指针。
5. 新版验证通过后，将其他已公开的 Release 转为草稿。维护者可用 `gh release edit <旧版版本号> --draft` 逐个处理。保留历史 Git Tag、Release 记录和附件。匿名复查 Releases 页面只展示最新版，维护者复查旧附件仍随草稿保留。
6. Codex 的仓库目录可用 `codex plugin marketplace upgrade qican-skills` 更新。独立 npx 安装按 README 流程选择 Skill 并升级。

这套流程由获授权的维护任务启动。公开仓库保存已审阅的方法镜像和构建工具。
