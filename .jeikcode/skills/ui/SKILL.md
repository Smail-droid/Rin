---
name: ui
description: 🌸 前端界面与二次元微光美学工程：专精于日系二次元微光、拍立得拟物手账、粉白柔和渐变、高密单屏超级表格 (Dense DataGrid) 与响应式组件设计。
---

# 🌸 前端 UI 与微光美学工程指南

## 1. 核心设计原则
1. **二次元微光美学 (Anime Luminescence)**：
   - 主色 `#ff4d79` / `#ff7e95`，辅助粉 `#ffd0da`，温润深棕文字 `#503e42`；
   - 通透拟态毛玻璃（`backdrop-blur-md` / `backdrop-blur-xl`），去除任何沉闷死板的黑深灰色块。
2. **高密单屏超级数据表格 (Dense DataGrid)**：
   - 杜绝无效滚动与大空白浪费，行高控制在 38px~42px，集成快捷操作；
   - 序号支持直接输入数字调序（如 14 改为 3 自动插入并顺延后续行）。
3. **断崖式瘦身防线**：
   - 绝不静态打包重型库（Monaco、Mermaid、Highlighter），首屏必须保持按需异步 Chunk。
