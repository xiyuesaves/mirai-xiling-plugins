const express = require('express'); // http服务器,处理图片链接请求
const downloadImage = require('./lib/downloadImage.js'); // 下载器封装
const { join } = require('path');
const fs = require('fs'); //文件读写
const db = require("better-sqlite3")(join(__dirname, 'respond.db')); // 数据库

let Pluginoption = {
        imagePort: 81,
        respondList: false,
        respondPort: 82,
        respondHost: `http://127.0.0.1`
    },
    option = null,
    errmsg = function() {
        return "图片找不到了QAQ";
    }

const respond = {
    name: "关键词回应",
    // 加载完成时执行
    mounted: (xilingOption, miraiBot) => {
        // 初始化数据库
        db.prepare("CREATE TABLE IF NOT EXISTS reply_list(\"reply_list_id\" integer NOT NULL PRIMARY KEY AUTOINCREMENT,\"key\" text,\"create_name\" text,\"create_id\" integer,\"group_id\" integer)").run();
        db.prepare("CREATE TABLE IF NOT EXISTS reply_text_list(\"reply_list_id\" integer,\"reply_type\" text,\"content\" text,\"create_name\" text,\"create_id\" integer,\"count\" integer DEFAULT 0,FOREIGN KEY (\"reply_list_id\") REFERENCES \"reply_list\" (\"reply_list_id\") ON DELETE CASCADE ON UPDATE NO ACTION)").run();
        option = xilingOption;

        try {
            Pluginoption = require(join(process.cwd(), "./options/respond.json"))
        } catch (err) {
            fs.writeFileSync(join(process.cwd(), "./options/respond.json"), JSON.stringify(Pluginoption, null, 4));
        }

        let app = express();
        app.use("/reply_image/", express.static('reply_image')); // 指定静态文件路径
        app.listen(Pluginoption.imagePort, function() {
            let port = this.address().port;
            console.log(`[关键词回应] 本地图片服务已启动 - [${port}]`);
        })
        // http服务,展示回应列表
        if (Pluginoption.respondList) {
            let httpServer = express();
            httpServer.get("/replace_list/*", (req, res) => {
                let getGroupId = parseInt(new Buffer.from(req.path.split("/")[2], 'base64').toString()) || "";
                console.log(`[关键词回应] 请求回应列表 - [${getGroupId}]`);
                let dbSearch = db.prepare("SELECT reply_type,content,count,key FROM reply_list a,reply_text_list b WHERE a.reply_list_id = b.reply_list_id AND a.group_id = ?").all(getGroupId);
                res.json(dbSearch);
            });
            httpServer.use("/reply_image/", express.static('reply_image')); // 指定静态文件路径
            httpServer.use("/status", express.static('http_index/status')); // 指定静态文件路径
            httpServer.use("/", express.static('http_index')); // 指定静态文件路径
            httpServer.listen(Pluginoption.respondPort, function() {
                let port = this.address().port;
                console.log(`[关键词回应] 回应列表服务已启动 - [${port}]`);
            })
        }

    },
    // 主动功能
    command: [{
        name: "回应列表",
        exce: (msg) => {
            if (Pluginoption.respondList) {
                let host = Pluginoption.respondHost ? Pluginoption.respondHost : `http://127.0.0.1:${Pluginoption.respondPort}`,
                    text = `请在此处查看\n${host}/?q=${new Buffer.from(msg.sender.group.id+"").toString("base64")}`;
                msg.quoteReply([{ type: "Plain", text: text }], msg);
            } else {
                msg.quoteReply([{ type: "Plain", text: "此功能未启用" }], msg);
            }
        }
    }, {
        name: "添加回应",
        exce: async (msg, parameter) => {
            let command = msg.plain.substring(1),
                imageUrlArr = [];
            // 获取图片链接
            for (var i = 0; i < msg.messageChain.length; i++) {
                if (msg.messageChain[i].type === "Image") {
                    imageUrlArr.push(msg.messageChain[i]);
                };
            };
            let replyArr = parameter,
                tempArr = [],
                keyWord = replyArr.shift();

            // 去除触发词的空格
            if (keyWord) {
                keyWord = keyWord.replace(/\s$/g, '');
            }

            // 去除回应内容的空格,并添加到临时数组
            for (var i = 0; i < replyArr.length; i++) {
                if (replyArr[i].replace(/\s/g, "").length) {
                    tempArr.push(replyArr[i]);
                }
            }
            replyArr = tempArr;

            if (!keyWord) {
                msg.reply([{ type: "Plain", text: "#添加回应\n触发词\n回应内容\n..." }], msg)
            } else if (!replyArr.length && !imageUrlArr.length) {
                msg.reply([{ type: "Plain", text: "缺少回应内容" }], msg)
            } else if (keyWord.substring(0, 1) === option.commandPrefix) {
                msg.reply([{ type: "Plain", text: `触发词开头不能是${option.commandPrefix}` }], msg)
            } else {
                let returnMsg = "附加成功",
                    groupId = msg.sender.group.id,
                    senderId = msg.sender.id,
                    memberName = msg.sender.memberName,
                    replyListId = db.prepare("SELECT reply_list_id FROM reply_list WHERE key = ? AND group_id = ?").get(keyWord, groupId);

                if (!replyListId) {
                    // 添加触发词
                    replyListId = db.prepare("INSERT INTO reply_list (key,create_name,create_id,group_id) VALUES (?,?,?,?)").run(keyWord, memberName, senderId, groupId).lastInsertRowid;
                    returnMsg = "添加成功";
                } else {
                    replyListId = replyListId.reply_list_id;
                }
                // 添加文本回应
                for (var i = 0; i < replyArr.length; i++) {
                    db.prepare("INSERT INTO reply_text_list VALUES (?,?,?,?,?,?)").run(replyListId, "Plain", replyArr[i], memberName, groupId, 0);
                }
                // 添加图片回应
                for (var i = 0; i < imageUrlArr.length; i++) {
                    let content = await downloadImage(imageUrlArr[i].url, `${senderId}-${imageUrlArr[i].imageId}`, join(process.cwd(), "./reply_image"));
                    console.log("[关键词回应] 文件名称", content);
                    db.prepare("INSERT INTO reply_text_list VALUES (?,?,?,?,?,?)").run(replyListId, "Image", content, memberName, groupId, 0);
                }
                msg.reply([{ type: "Plain", text: returnMsg }], msg);
            }
        }
    }, {
        name: "删除回应",
        exce: async (msg, parameter) => {
            let plain = msg.plain,
                groupId = msg.sender.group.id,
                keyWord = parameter.shift(),
                dbSearch = db.prepare("SELECT reply_list_id FROM reply_list WHERE key = ? AND group_id = ?").get(keyWord, groupId);

            if (!keyWord) {
                msg.reply([{ type: "Plain", text: `#删除回应\n触发词` }], msg);
                return false;
            }
            if (dbSearch) {
                let replyId = dbSearch.reply_list_id;
                let imgPathArr = db.prepare("SELECT content FROM reply_text_list WHERE reply_list_id = ? AND reply_type = ?").all(replyId, "Image");
                db.prepare("DELETE FROM reply_list WHERE reply_list_id = ?").run(replyId);
                for (var i = 0; i < imgPathArr.length; i++) {
                    fs.unlink(imgPathArr[i].content, (err) => {
                        if (err) {
                            console.log("[关键词回应] 文件删除失败", err);
                        }
                    })
                }
                msg.reply([{ type: "Plain", text: `删除成功` }], msg);
            } else {
                msg.reply([{ type: "Plain", text: `没有找到该触发词` }], msg);
            }
        }
    }],
    // 被动触发
    passive: {
        name: "自动回应",
        exce: function(msg) {
            // 仅当消息只有文本时才判断是否有触发词
            if (msg.messageChain.length === 2) {
                let plain = msg.plain,
                    groupId = msg.sender.group.id,
                    dbSearch = db.prepare("SELECT a.reply_list_id,reply_type,content FROM reply_list a,reply_text_list b WHERE a.reply_list_id = b.reply_list_id AND a.key = ? AND a.group_id = ?").all(plain, groupId);

                if (dbSearch.length) {
                    let replyContent = dbSearch[Math.floor(Math.random() * dbSearch.length)];
                    db.prepare("UPDATE reply_text_list SET count = count + 1 WHERE reply_list_id = ? AND content = ?").run(replyContent.reply_list_id, replyContent.content);
                    if (replyContent.reply_type === "Plain") {
                        console.log("[关键词回应] 文本回应", replyContent.content);
                        msg.reply([{ type: 'Plain', text: replyContent.content }], msg);
                        return false;
                    } else {
                        console.log("[关键词回应] 回应图片路径", `./reply_image/${replyContent.content.substring(14)}`);
                        try {
                            fs.accessSync(`./reply_image/${replyContent.content.substring(14)}`, fs.constants.F_OK);
                            let url = `http://127.0.0.1:81/reply_image/${replyContent.content.substring(14)}`;
                            msg.reply([{ type: 'Image', imageId: null, url: url, path: null }], msg);
                            return false;
                        } catch (err) {
                            console.log("[关键词回应] 读取文件错误", err);
                            db.prepare("DELETE FROM reply_text_list WHERE content = ?").run(replyContent.content);
                            msg.reply([{ type: 'Plain', text: errmsg }], msg);
                            return false;
                        };
                    };
                } else {
                    // 没有找到回应内容
                    return true;
                };
            } else {
                // 消息链无法触发
                return true;
            };
        }
    }
}


module.exports = respond;