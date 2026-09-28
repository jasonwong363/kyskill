# KY 公司内部业务工具箱

统一入口 `kys`，包含历史报价查询、餐饮小红书诊断与方案报价、通用已确认报价排版。

## 安装

```sh
npx skills add jasonwong363/kyskill --skill kys -g
```

安装后使用 `$kys`。子模块位于 `skills/kys/references/modules/`。

历史客户报价数据保存在本机 `~/.codex/knowledge/kys-pricing/`，不随仓库上传；使用查询功能前需自行配置。合同功能依赖独立安装的 `kys-contract`，本仓库不包含合同母版。

仓库只包含技能规则、工具和通用样式，不包含客户报价库、客户方案截图或本地测试记录。
