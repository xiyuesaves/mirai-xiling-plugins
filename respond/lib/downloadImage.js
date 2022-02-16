const axios = require('axios') // request http请求
const fs = require('fs') //文件读写
// 图片下载方法
const downloadImage = async function(url, fileName, path, proxy = false) {
    let filePath = `${path}/${fileName}`
    try {
        fs.accessSync(path, fs.constants.F_OK)
    } catch (err) {
        fs.mkdirSync(path)
    }
    let writer = fs.createWriteStream(filePath),
        axiosOption = {
            url,
            methods: "GET",
            responseType: "stream"
        }
    if (proxy) {
        axiosOption.proxy = proxy
    }
    response = await axios(axiosOption)
    response.data.pipe(writer)
    return new Promise((resolve, reject) => {
        writer.on("finish", resolve(filePath));
        writer.on("error", reject);
    });
}
module.exports = downloadImage;