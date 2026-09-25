# NPC角色卡动态加载器 v0.1

在“群像世界主持人”聊天中，扫描最近6条消息；命中NPC名字/别名后，从 SillyTavern 已导入角色列表读取对应角色卡，并只在本轮生成Prompt里临时注入。

默认：每轮最多4张；读取 Description、Personality、Scenario、System Prompt、Post History Instructions；为节省Token默认不读取 Example Messages。

安装：解压后把整个“NPC角色卡动态加载器”文件夹放进当前用户 extensions 目录，重启/刷新酒馆并在扩展管理确认启用。

若酒馆里的实际角色显示名不同，编辑 index.js 顶部 NPC_RULES 的 target。
