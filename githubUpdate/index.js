const axios = require('axios') // http请求
const fs = require('fs');
const { join } = require('path');

let options = {
  token: "", // token
  userId: "", // 用户名
  repositories: "", // 储存库
  useJsDelivr: true, // 启用JsDelivr加速
  message: "add new image", // commint信息
  path: "imgs" // 存储路径
},
uploadGroupId = null,
devId = null;


const githubUpdate = {
  name: "github上传服务",
  mounted(xilingOptions) {
    devId = xilingOptions.dev;
    try {
      options = require(join(process.cwd(), "./options/githubUpdate.json"))
    } catch (err) {
      console.log("[githubUpdate] 需要初始化配置信息");
      fs.writeFileSync(join(process.cwd(), "./options/githubUpdate.json"), JSON.stringify(options, null, 4));
    }
  },
  command: [{
    name: "上传模式",
    exce(msg, parameter) {
      if (msg.sender.id === devId) {
        msg.reply([{ type: "Plain", text: "上传模式已开启" }]);
        uploadGroupId = msg.sender.group.id;
      }
    },
  }, {
    name: "结束",
    exce(msg, parameter) {
      if (msg.sender.id === devId) {
        msg.reply([{ type: "Plain", text: "上传模式已关闭，" }]);
        uploadGroupId = null;
      }
    }
  }],
  passive: [{
    name: "监听方法",
    async exce(msg) {
      if (msg.sender.group.id === uploadGroupId && msg.sender.id === devId) {
        // 过滤出所有的图片信息
        let imgLink = msg.messageChain.filter(_msg => _msg.type === "Image");
        if (imgLink.length === 1) {
          let axiosOption = {
              url: imgLink[0].url,
              methods: "GET",
              responseType: "arraybuffer"
            },
            img = await axios(axiosOption),
            imgId = imgLink[0].imageId;
          axios({
            method: "PUT",
            headers: { "Authorization": `token ${options.token}` },
            url: `https://api.github.com/repos/${options.userId}/${options.repositories}/contents/${options.path}/${imgId}`,
            data: {
              "message": options.message,
              "content": img.data.toString('base64')
            }
          }).then(res => {
            if (options.useJsDelivr) {
              msg.quoteReply(`![${imgId}](https://cdn.jsdelivr.net/gh/${options.userId}/${options.repositories}/${res.data.content.path})`);
            } else {
              msg.quoteReply(`![${imgId}](${res.data.content.download_url})`);
            }
          }).catch(err => {
            console.log(err.response.data)
            msg.quoteReply("上传失败");
            msg.quoteReply(err.response.data);
          })
        } else if (imgLink.length) {
          msg.reply("一次只能上传一张图片");
        }
      }
      return true;
    }
  }]
}

module.exports = githubUpdate;