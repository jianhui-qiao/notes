# 大文件上传方案：秒传、分片与断点续传实现

## 一、核心功能概述
本方案基于 Node.js 实现了大文件上传的三大核心功能，兼具实用价值与面试参考意义：
- **秒传**：通过 MD5 校验实现已上传文件的快速复用
- **大文件分片上传**：将文件分割为小块并发传输，提升效率
- **断点续传**：支持上传中断后从断点位置继续，避免重复传输

## 二、技术栈说明
- **前端**：原生 JavaScript、Web Worker（处理 MD5 计算）、SparkMD5（MD5 计算库）
- **后端**：Node.js、Express（Web 框架）、Multer（文件上传中间件）
- **构建工具**：Vite（前端开发服务）

## 三、实现原理详解
### 1. 秒传机制
- 核心原理：利用 MD5 散列函数对文件内容生成唯一标识
- 流程：
  - 用户上传文件时，前端计算文件 MD5 并随请求发送
  - 后端以 MD5 作为文件唯一标识进行存储
  - 当其他用户上传相同文件时，后端通过 MD5 校验发现文件已存在，直接复制文件并修改文件名完成上传
### 2. 大文件分片上传
- 问题背景：超大文件（如 10G）直接上传易超时、失败且速度慢
- 解决方案：
  - 按固定大小（本方案为 5MB）将文件分割为多个切片
  - 利用浏览器并发能力上传切片（浏览器通常支持 6 个并发连接，IE 为 5 个）
  - 后端接收并存储切片，全部上传完成后合并为完整文件
### 3. 断点续传
- 问题背景：上传过程中若遇网络故障等中断，重新上传需从头开始
- 解决方案：
  - 上传前验证已上传的切片索引
  - 仅上传缺失的切片
  - 减少重复传输，节省带宽和时间
### 4. 切片索引的作用
- 必要性：合并文件时通过索引确定每个切片的正确位置，保证文件合并的完整性（类似哈夫曼合并的位置定位原理）
- 实现方式：每个切片命名格式为 文件名-索引，合并时按索引排序拼接

## 四、代码实现
### 前端实现
#### 1. 页面结构（web/index.html）
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>大文件上传</title>
</head>
<body>
     <h3>大文件上传</h3>
     <input type="file" id="file">
     <button id="upload">上传</button>
     <div id="progress"></div>
    <script src="./index.js"></script>
</body>
</html>
```
#### 2. 主逻辑（web/index.js）
```javascript
const upload = document.getElementById("upload");
const file = document.getElementById("file");
const worker = new Worker("./worker.js");
const chunkSize = 1024 * 1024 * 5; // 5MB 切片大小
const chunks = [];

// 监听上传按钮点击事件
upload.addEventListener("click", () => {
    const fs = file.files[0]; // 获取选择的文件
    const total = Math.ceil(fs.size / chunkSize); // 计算切片总数
    // 分割文件为切片（file继承于blob，blob提供slice方法）
    chunks.push(...Array.from({ length: total }, (_, i) => 
        fs.slice(i * chunkSize, (i + 1) * chunkSize)
    ));
    // 向Web Worker发送切片和文件名，用于计算MD5
    worker.postMessage({
        chunks,
        filename: fs.name,
    });
});

// 接收Web Worker计算的MD5结果
worker.onmessage = async function (e) {
    const { filename, hash } = e.data;
    // 验证已上传的切片
    const res = await fetch(`http://localhost:3000/verify?hash=${hash}`);
    const { files } = await res.json();
    const uploadedSet = new Set(files);
    
    // 筛选出未上传的切片
    const tasks = chunks.map((chunk, index) => ({ chunk, index }))
        .filter(({ index }) => !uploadedSet.has(`${filename}-${index}`));

    // 上传所有未上传的切片
    for (const { chunk, index } of tasks) {
        const formData = new FormData();
        formData.append("filename", filename);
        formData.append("hash", hash);
        formData.append("index", index);
        formData.append("file", chunk);
        await fetch("http://localhost:3000/upload", {
            method: "POST",
            body: formData
        });
    }

    // 所有切片上传完成后，请求合并
    await fetch(`http://localhost:3000/merge?hash=${hash}&filename=${filename}`);
};
```
#### 3. Web Worker（web/worker.js）
用于在后台计算文件 MD5，避免阻塞主线程
```javascript
// Web Worker是运行在后台的JS，不会阻塞页面
// 不能进行DOM操作，不能访问window和document对象
// self代表当前worker的全局作用域
self.importScripts("./spark-md5.min.js");

self.onmessage = function (e) {
    const { chunks, filename } = e.data;
    const spark = new self.SparkMD5.ArrayBuffer(); // 创建MD5计算实例
    let currentChunk = 0;

    // 递归处理所有切片计算MD5
    function loadNext() {
        const reader = new FileReader(); // 用于格式转换（base64/blob/ArrayBuffer/file）
        reader.onload = function (e) {
            spark.append(e.target.result); // 累加计算MD5
            currentChunk++;
            if (currentChunk < chunks.length) {
                loadNext(); // 处理下一个切片
            } else {
                // 计算完成，发送结果给主线程
                self.postMessage({
                    filename,
                    hash: spark.end() // 最终MD5值
                });
            }
        };
        reader.readAsArrayBuffer(chunks[currentChunk]); // 读取切片为ArrayBuffer
    }

    loadNext(); // 开始处理第一个切片
};
```
#### 4. 前端配置（web/vite.config.js）
```javascript
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    open: true,
  },
})
```
### 后端实现（server/index.js）
```javascript
const express = require("express");
const cors = require("cors");
const multer = require("multer"); // 处理文件上传的中间件
const fs = require("fs");
const path = require("path");
const app = express();

app.use(cors()); // 解决跨域问题

// 配置文件存储方式
const storage = multer.diskStorage({
    // 确定切片存储目录
    destination: function (req, file, cb) {
        // 递归创建目录（若不存在）
        fs.mkdirSync(`uploads/${req.body.hash}`, { recursive: true });
        cb(null, `uploads/${req.body.hash}/`);
    },
    // 确定切片文件名（包含索引）
    filename: function (req, file, cb) {
        cb(null, `${req.body.filename}-${req.body.index}`);
    }
});

const upload = multer({ storage });

// 切片上传接口
app.post("/upload", upload.single("file"), (req, res) => {
    res.json({ success: true });
});

// 合并切片接口
app.get("/merge", async (req, res) => {
    const { hash, filename } = req.query;
    // 获取所有切片
    const files = fs.readdirSync(`uploads/${hash}`);
    // 按索引排序切片
    const sortedFiles = files.sort((a, b) => 
        a.split("-")[1] - b.split("-")[1]
    );
    // 创建存储合并后文件的目录
    const targetDir = path.join(__dirname, hash);
    fs.mkdirSync(targetDir, { recursive: true });
    // 创建写入流
    const writeStream = fs.createWriteStream(path.join(targetDir, filename));

    // 依次合并所有切片
    for (const file of sortedFiles) {
        await new Promise((resolve, reject) => {
            const readStream = fs.createReadStream(
                path.join(__dirname, `uploads/${hash}`, file)
            );
            // 将切片内容写入目标文件（不自动关闭流）
            readStream.pipe(writeStream, { end: false });
            readStream.on("end", () => {
                fs.unlinkSync(path.join(__dirname, `uploads/${hash}`, file)); // 删除已合并的切片
                resolve();
            });
            readStream.on("error", reject);
        });
    }

    writeStream.end(); // 手动关闭流
    res.json({ success: true });
});

// 验证文件/切片是否已存在接口
app.get("/verify", (req, res) => {
    const { hash } = req.query;
    const isExist = fs.existsSync(`uploads/${hash}`);
    if (!isExist) {
        return res.json({ success: true, files: [] });
    }
    // 返回已存在的切片列表
    const files = fs.readdirSync(`uploads/${hash}`);
    res.json({ success: true, files });
});

// 启动服务器
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
```
## 五、项目依赖配置
### 前端依赖（web/package.json）
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "express": "^4.21.2",
    "vite": "^6.2.1"
  }
}
```
### 后端依赖（package.json）
```json
{
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "multer": "^1.4.5-lts.1"
  }
}
```
### 额外依赖
- MD5 计算库：spark-md5（通过 CDN 引入）
  - 地址：https://cdnjs.com/libraries/spark-md5

## 六、运行流程
1. 前端选择文件并点击上传按钮 
2. 前端将文件分割为 5MB 大小的切片 
3. 通过 Web Worker 在后台计算文件的 MD5 值
4. 前端请求验证接口，获取已上传的切片信息
5. 前端仅上传缺失的切片
6. 所有切片上传完成后，前端请求合并接口
7. 后端按索引排序切片并合并为完整文件，同时删除临时切片
8. 后端返回合并成功响应

通过以上实现，系统能够高效处理大文件上传，同时支持秒传和断点续传，极大提升了用户体验和传输效率。
