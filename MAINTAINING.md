# Qican-Skills 维护与发行

公开仓库为 [Qican-Skills](https://github.com/tangchunhao71-hash/Qican-Skills)。公开插件、CLI 和目录使用 ID `qican-skills`，历史发行保留当时的 ID 和文件名。已有私人插件继续沿其现有身份和发布入口维护。

## 新增和维护 Skill

在真实需求出现后新增 Skill。在 `skills.json` 登记其目录名和依赖，并把审核过的文件逐个加入 `scripts/release-files.json`。每个入口单独校验其依赖闭包和文件引用。两项长文相关 Skill 继续共用 `cyber-qican` 下的正式规则镜像。

经作者确认的正式规则在原维护端更新。审阅新增、替代、删除和适用范围，才把获准公开的方法同步到镜像。规则版本和发行版本分别记录。公共源码保留这个镜像。维护端在获准时可以同步既有私人包的通用部分，私人生产配置沿原入口维护。

## 发行

1. 核对发版差异、隐私、来源和许可。补上当前验证记录，统一两个插件清单和 CLI 版本。
2. 运行测试、构建和检查。完整 Git 检出可附加历史扫描。

```sh
npm test
npm run build
npm run check -- --git
```

3. 以通过审核的签名提交为准，打标签并发布 Release。当前产物为 `cyber-qican.md`、`qican-skills-skills.zip`、`qican-skills-plugin.zip` 和 `SHA256SUMS`。
4. 匿名读回仓库和 Release 附件，校验版本、引用、安装与哈希。更新已存在的入口指针。历史 Tag、Release 和附件按原版本保留。
5. Codex 的仓库目录可用 `codex plugin marketplace upgrade qican-skills` 更新。独立 npx 安装按 README 流程选择 Skill 并升级。

这套流程由获授权的维护任务启动。公开仓库保存已审阅的方法镜像和构建工具。
