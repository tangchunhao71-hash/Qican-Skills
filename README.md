# 赛博祈蚕 · Qican Article System

从一句没说清楚的困惑开始。赛博祈蚕会帮你找到真正卡住的判断，看看有哪些解释，找有用的知识和反例。你想写成长文时，文章流程会把这些认识接成选题卡、稿件和可回查的复盘。

> 我试了很多学习方法，但真正做事时还是反复卡在同一步。先陪我想一下。

不必准备 Prompt 或整理知识库。你可以只聊一件事，也可以带上旧文章、笔记或已确认的提纲。第一次使用见 [START](START.md)。

## 选择一种用法

| 想怎么用 | 入口 |
| --- | --- |
| 随手在常用 AI 里聊 | 下载 [零安装单文件](https://github.com/tangchunhao71-hash/qican-article-system/releases/latest/download/cyber-qican.md)，把全文粘进去或作为附件上传。有网页读取能力的 AI 也可以打开文件链接。 |
| 在本机 Agent 里反复调用 | 用下面的一键安装，或解压 [双 Skill 包](https://github.com/tangchunhao71-hash/qican-article-system/releases/latest/download/qican-article-system-skills.zip)。 |
| 按 Plugin 管理两个 Skill | 从 [GitHub Release](https://github.com/tangchunhao71-hash/qican-article-system/releases/latest) 下载插件 ZIP，或在 Codex 添加此仓库的插件目录。 |

### 一键安装与固定版本

需要 Node.js 22.2 或更新版本，以及 npm 和 Git。默认显示目标和操作，再由你确认。只装到你选的一个目录。

```sh
npx github:tangchunhao71-hash/qican-article-system
npx github:tangchunhao71-hash/qican-article-system#v0.3.0 --target codex --preview
npx github:tangchunhao71-hash/qican-article-system#v0.3.0 --target codex
npx git+https://github.com/tangchunhao71-hash/qican-article-system.git#v0.3.0 --target codex
```

`--target` 可用 `codex`、`agents`、`claude-code` 或 `cursor`。Codex 与 Agents 共享 `~/.agents/skills`。`--dir "<目标技能目录>"` 可选项目或自定义目录。已有同名目录时默认停下。由本安装器安装的版本可加 `--upgrade` 更新，备份位置会显示在结果里。手动安装的版本请先自行备份并移出扫描目录。无人值守时，只有你显式提供目标和 `--yes` 才执行。

npx 首次使用需要从 GitHub 下载包。安装器从包内读取文件，仅写本机选定位置。

进程被强制终止时，请保留目标目录旁的备份和锁，核对旧版本位置后再处理。安装器会在捕获到替换失败时主动恢复，两次目录替换之间仍存在短暂的中间状态。

### 手动安装

解压双 Skill ZIP，把 `cyber-qican` 和 `article-workflow` 两个目录并排放进同一个 Skills 目录。文章流程由相邻目录读取共用镜像。常见个人目录见下表。表中是按各宿主文档配置的路径，安装器文件操作和实际对话加载分别验证。

| 宿主 | 个人目录 | 参考 |
| --- | --- | --- |
| Codex / Agents | `~/.agents/skills` | [Codex Skills 文档](https://learn.chatgpt.com/docs/build-skills) |
| Claude Code | `~/.claude/skills` | [Claude Code Skills 文档](https://code.claude.com/docs/en/skills) |
| Cursor | `~/.cursor/skills` | [Cursor Skills 文档](https://cursor.com/docs/skills) |

把两个目录放好后，在宿主里选对应 Skill，或直接说「用赛博祈蚕陪我想清楚」和「用文章流程从这份提纲继续」。已经通过插件安装时，通常直接使用其中的 Skill 即可。

### Codex 插件目录

```sh
codex plugin marketplace add tangchunhao71-hash/qican-article-system
codex plugin add qican-article-system@qican-article-system
```

也可以在支持本地插件的桌面端选择仓库目录。此发行版通过 GitHub 分发。 [Codex 插件文档](https://developers.openai.com/plugins/build/plugins)

## 两个 Skill

- [赛博祈蚕](skills/cyber-qican/SKILL.md)从真实处境定义问题，比较解释和证据，按需连接知识，帮助用户形成并检验自己的判断。
- [文章流程](skills/article-workflow/SKILL.md)按当前成果接续选题、研究、交接、初稿、审阅、精修和发布后复盘。涉及外部保存或发布时，以当前环境的能力和你的明确授权为准。
- [规则镜像 v0.33](skills/cyber-qican/references/confirmed-rules-mirror.md)是两者共用的维护源派生版。共用认知方法 A–F，文章方法 G–I。规则镜像版本和发行版本独立记录。

[六类使用示例](examples/usage.md) · [变更记录](CHANGELOG.md) · [贡献反馈](CONTRIBUTING.md) · [维护与发布](MAINTAINING.md)

本项目处于试用阶段。安装成功只证明文件安装路径通过。实际比较见[验证记录](examples/validation.md)，欢迎提供能改变判断的反馈与反例。
