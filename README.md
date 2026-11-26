# Qican-Skills · 祈蚕的 Skills 合集

有个问题还说不清，可以用「赛博祈蚕」一起想。已经有想法、选题卡或稿件，可以用「文章流程」从当前阶段继续。两项 Skill 可以独立调用，共用 [规则镜像 v0.35](skills/cyber-qican/references/confirmed-rules-mirror.md)。

> 我试了很多学习方法，但真正做事时还是反复卡在同一步。先陪我想一下。

第一次用从这句口述就够了。你也可以带上相关笔记、旧文或提纲。[第一次使用](START.md)

| Skill | 用途 | 安装依赖 |
| --- | --- | --- |
| [赛博祈蚕 · cyber-qican](skills/cyber-qican/SKILL.md) | 定义问题，找反例和知识缺口，形成并检验自己的判断。 | 无 |
| [文章流程 · article-workflow](skills/article-workflow/SKILL.md) | 接续选题、研究、交接、初稿、审阅、精修和发布后复盘。 | cyber-qican 提供共用规则文件 |

## 三种使用方式

- **普通 AI**　下载 [零安装单文件](https://github.com/tangchunhao71-hash/Qican-Skills/releases/latest/download/cyber-qican.md)，把全文粘进对话或上传，再说你想弄清楚的事。
- **Agent Skills**　用下方安装器选单项或全部安装，也可以下载 [Skills ZIP](https://github.com/tangchunhao71-hash/Qican-Skills/releases/latest/download/qican-skills-skills.zip) 手动安装。
- **Plugin**　从 [GitHub Release](https://github.com/tangchunhao71-hash/Qican-Skills/releases/latest) 下载 Plugin ZIP，或在 Codex 添加下面的 GitHub 插件目录。

### 安装到 Agent

需要 Node.js 22.2 或更新版本，以及 npm 和 Git。以下以 Codex 为例，固定到 v0.5.1。

```sh
# 查看可用 Skill 和依赖
npx github:tangchunhao71-hash/Qican-Skills#v0.5.1 --list

# 只安装赛博祈蚕
npx github:tangchunhao71-hash/Qican-Skills#v0.5.1 --target codex --skill cyber-qican

# 预览文章流程及其依赖
npx github:tangchunhao71-hash/Qican-Skills#v0.5.1 --target codex --skill article-workflow --preview

# 安装全部
npx github:tangchunhao71-hash/Qican-Skills#v0.5.1 --target codex --all
```

`--skill` 可重复。省略选择时默认全装。`--target` 可用 `codex`、`agents`、`claude-code` 或 `cursor`，也可用 `--dir "<技能目录>"`。安装前会显示计划。同名手动安装默认保留。非交互写入需要你显式指定目标和 `--yes`。GitHub 简写遇到 SSH 配置问题时可用 `npx git+https://github.com/tangchunhao71-hash/Qican-Skills.git#v0.5.1`。

手动安装时，将所选 Skill 的目录放入宿主 Skills 目录。装文章流程时，把两个目录并排放置，保留相对引用。目录来自宿主文档，当前版本的实测范围见 [验证记录](examples/validation.md)。

| 宿主 | 个人 Skills 目录 |
| --- | --- |
| Codex / Agents | `~/.agents/skills` |
| Claude Code | `~/.claude/skills` |
| Cursor | `~/.cursor/skills` |

### Codex 插件目录

```sh
codex plugin marketplace add tangchunhao71-hash/Qican-Skills
codex plugin add qican-skills@qican-skills
```

[Codex 插件分发文档](https://developers.openai.com/plugins/build/plugins)

## 从旧版升级

**通过 npx 装过 Skill**　用新仓库命令加 `--upgrade`，建议先加 `--preview`。安装器能识别旧包的安装记录。升级共用规则的 Skill 时，已由本安装器管理且依赖它的 Skill 会一起进入计划。在同一版本追加所需 Skill 时，文件完整的依赖可以直接复用。升级备份位于 Skills 扫描目录外，替换报错会按原目录恢复。若进程被强制终止，保留锁和备份，核对目录后再处理。

**通过公开插件目录安装**　已在使用 `qican-skills@qican-skills` 的用户可以沿用原目录升级。仍在使用 v0.3.0 旧公开插件的用户，先按上方命令切换到 `qican-skills`。切换成功后可移除旧公开安装 `qican-article-system@qican-article-system`。私人插件继续使用自己的入口。

**已克隆仓库或锁定版本**　旧仓库链接由 GitHub 重定向。历史 v0.3.0 的 Tag、发行包名和内容按原版保留。旧固定版本的命令可以继续取旧版本。已有克隆可改用新远端：

```sh
git remote set-url origin https://github.com/tangchunhao71-hash/Qican-Skills.git
```

[历史 Release v0.3.0](https://github.com/tangchunhao71-hash/Qican-Skills/releases/tag/v0.3.0) · [GitHub 仓库重命名说明](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)

[六类使用示例](examples/usage.md) · [变更记录](CHANGELOG.md) · [反馈与贡献](CONTRIBUTING.md) · [维护与发布](MAINTAINING.md)
