const fs = require("fs");
const { join } = require("path");

let errMsg = {
        none_comment: ["有个笨蛋打错命令了我不说是谁w"],
        master_comment: ["主人好~"]
    },
    options = null;

// 选择插件
const errorCommand = {
    name: "未知命令处理",
    mounted(_options) {
        options = _options;
        try {
            errMsg = require(join(process.cwd(), "./options/errorCommand.json"))
        } catch (err) {
            fs.writeFileSync(join(process.cwd(), "./options/errorCommand.json"), JSON.stringify(errMsg, null, 4));
        }
    },
    noneCommand: {
        name: "随机返回文本信息",
        exce: (msg) => {
            let sendPlain = "";
            if (msg.sender.id === options.dev) {
                let master_comment = errMsg.master_comment;
                sendPlain = master_comment[Math.floor(Math.random() * master_comment.length)];
            } else {
                let none_comment = errMsg.none_comment;
                sendPlain = none_comment[Math.floor(Math.random() * none_comment.length)];
            }
            msg.reply([{ type: "Plain", text: sendPlain }], msg)
        }
    }
}

module.exports = errorCommand