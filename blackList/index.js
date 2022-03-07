// 黑名单插件
const { join } = require("path");
const db = require("better-sqlite3")(join(process.cwd(), "database/blackList.db"));
let option = null;

const blackList = {
    name: "黑名单",
    mounted(xilingOption, miraiBot) {
        db.prepare("CREATE TABLE IF NOT EXISTS blackList(\"id\" integer NOT NULL,PRIMARY KEY (\"id\"))").run();
        option = xilingOption;
    },
    priority: {
        name: "检测黑名单用户",
        exce: (msg) => {
            let dbSearch = db.prepare("SELECT * FROM blackList WHERE id = ?").get(msg.sender.id);
            if (dbSearch) {
                console.log(`[黑名单] 黑名单用户[${msg.sender.id}]${msg.sender.memberName}`)
                return true;
            } else {
                return false;
            }
        }
    },
    command: [{
        name: "添加黑名单",
        exce: (msg, parameter) => {
            if (msg.sender.id === option.dev) {
                if (parameter[0]) {
                    let dbSearch = db.prepare("SELECT * FROM blackList WHERE id = ?").get(parameter[0]);
                    if (!dbSearch) {
                        db.prepare("INSERT INTO blackList (id) VALUES (?)").run(parameter[0]);
                        msg.quoteReply([{ type: 'Plain', text: '添加成功' }], msg);
                    } else {
                        msg.quoteReply([{ type: 'Plain', text: '已在黑名单中' }], msg);
                    }
                } else {
                    msg.quoteReply([{ type: 'Plain', text: '没有找到参数' }], msg);
                }
            } else {
                msg.quoteReply([{ type: 'Plain', text: '没有权限' }], msg);
            }
        }
    }, {
        name: "删除黑名单",
        exce: (msg, parameter) => {
            if (msg.sender.id === option.dev) {
                if (parameter[0]) {
                    let dbSearch = db.prepare("SELECT * FROM blackList WHERE id = ?").get(parameter[0])
                    if (dbSearch) {
                        db.prepare("DELETE FROM blackList WHERE id = ?").run(parameter[0])
                        msg.quoteReply([{ type: 'Plain', text: '删除成功' }], msg)
                    } else {
                        msg.quoteReply([{ type: 'Plain', text: '目标没有在黑名单' }], msg)
                    }
                } else {
                    msg.quoteReply([{ type: 'Plain', text: '没有找到参数' }], msg);
                }
            } else {
                msg.quoteReply([{ type: 'Plain', text: '没有权限' }], msg)
            }
        }
    }]
}

module.exports = blackList;