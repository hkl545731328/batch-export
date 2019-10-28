# 七牛文件迁移

# 导出步骤
- 按照需要导出的数据库在tasks编写需要导出的任务
- 运行node index.js, 数据会备份到downloads文件夹
- 把downlowds文件夹移动到fileserver
- 检查log，并把qiniu_export中的collection导入到正式collection中，命名规则为db?collection