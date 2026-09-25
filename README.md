# NPC角色卡动态加载器 v0.4

SillyTavern 1.19.0 兼容性诊断版。

- 使用 `hooks.activate` 初始化入口，并保留模块加载兜底。
- 使用原生 toastr + 页面顶部诊断条双重提示。
- 使用 `generate_interceptor` 拦截生成。
- 优先用 `SillyTavern.getContext().setExtensionPrompt()` 注入，避免把调试内容写入真实聊天。
- 普通名字即可触发，@名字不是必须。
- 当前用户消息优先，上一条AI回复辅助维持在场NPC；每轮最多4卡。

测试：刷新后应看到“NPC Loader v0.4 · 入口已执行 · 等待生成”或“模块已加载 · 等待生成”。
然后在“群像世界主持人”发送“娜娜，你怎么看？”，生成时应显示“已加载：伊蕾娜（娜娜）”（实际名称以导入卡为准）。

更新：把 ZIP 根目录的 manifest.json、index.js、README.md 覆盖上传到 GitHub 仓库根目录并 Commit，再在 SillyDroid 中更新到 0.4.0 后刷新酒馆。
