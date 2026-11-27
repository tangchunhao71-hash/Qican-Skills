# 版式与运行方式

需要 Python 3、Pillow 和两份 Noto 可变字体。已经有字体时，在渲染命令中指向它们所在的目录，文件名为 `NotoSansSC.ttf` 和 `NotoSerifSC.ttf`。字体按 [SIL Open Font License](https://openfontlicense.org/) 提供，仓库留有对应许可证和下载源。

在这个 Skill 目录下运行：

```sh
python -m pip install Pillow
python scripts/prepare_fonts.py --out quote-fonts
python scripts/render.py examples/handoff.json --fonts-dir quote-fonts --out quote-output --preview
```

字体准备脚本从 Google Fonts 固定版本下载，并校验 SHA-256。已通过校验的文件会复用。命令生成 `quote-output/01-handoff.png` 和 `quote-output/preview/01-handoff.png`。出下一篇时换成自己的页面 JSON，并指定新的输出目录。

使用普通 Chat 时，可提供正文和本 Skill 的可读运行文件。只有代码环境能实际打开脚本和两款字体时才确认可以交付 PNG。没有运行环境时可先交付可编辑页面 JSON。

源 JSON 为 UTF-8。图像路径相对于 JSON 文件所在目录，也可用绝对路径。目标目录可以是新目录。同名文件已有时，选新版本目录再渲染。每页可选 `height`，默认 2880。组图默认统一到全组最高的指定高度，确需不同高度时使用顶层 `"height_policy": "per-page"`。输出宽度 1440。标题每行建议 4–7 个汉字。组图用同一套字体和页眉，正文模块类型根据内容变化。

```json
{
  "series": "作者名",
  "source": "原文  /  作者 · @handle",
  "pages": [
    {
      "slug": "短文件名",
      "section": "本页主题",
      "title": ["把标题拆成", "一或两行"],
      "subtitle": "说明这页回答的读者问题。",
      "art": "art/01.png",
      "chapters": "原文 I–III",
      "blocks": [
        {"type": "heading", "title": "一个具体的问题"},
        {"type": "side", "label": "左栏短提示", "text": "简述判断和适用条件。", "items": [["第一项","短说明"],["第二项","短说明"]]},
        {"type": "heading", "title": "用两个情境看差别", "hint": "一个可选的小注"},
        {"type": "compare", "items": [["情境一","一段短文"],["情境二","一段短文"]]},
        {"type": "callout", "label": "读者能试什么", "text": "说清楚下一步。"}
      ]
    }
  ]
}
```

常用模块：

| 类型 | 字段与用法 |
| --- | --- |
| `heading` | `title`，可带 `hint`。开启一节。 |
| `banner` | `label`、`text`，可带 `dark: true`。适合开篇点题，慎用。 |
| `side` | `text`、`items`，可带 `label`。左为解释，右为短标签和短说明。 |
| `compare` | 两组 `[标签, 说明]` 放入 `items`。 |
| `steps` | 二至五组 `[标签, 说明]` 放入 `items`。表示真实的顺序。 |
| `table` | 若干组 `[短标签, 说明]` 放入 `items`。长标签在左列自动换行；可用 `label_width` 调整列宽。 |
| `grid` | 用 `items` 罗列同层级概念，通常三列。 |
| `timeline` | `when`、`title`、`items`，可带 `accent: true`。每段时间一个模块。 |
| `text` | `text`。可说明图解适用范围或补足没有进入图表的关键关系。 |
| `callout` | `label`、`text`。适合读者示例、做法或边界。 |

有不足一版高的短帖可缩短 `height`。溢出时优先缩写、拆页或增高画幅。正文摆放后检查原尺寸和缩略图。渲染通过只能说明文件与版面可生成，准确性和审美要看成品。

