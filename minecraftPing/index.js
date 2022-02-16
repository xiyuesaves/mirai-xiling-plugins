const { ping } = require("minecraft-protocol");
const fs = require("fs");
const { join } = require("path");

let options = {
    host: null,
    port: null,
    closeTimeout: 2 * 1000, // 连接超时时间
    noPongTimeout: 1 * 1000, // 连接后未响应时间
}

// mc模块
const minecraft = {
    name: "minecraft 服务器检测",
    mounted() {
        try {
            options = require(join(process.cwd(),"./options/minecraftPing.json"))
        } catch (err) {
            console.log("[mc] 需要初始化服务器信息")
            fs.writeFileSync(join(process.cwd(),"./options/minecraftPing.json"),JSON.stringify(options,null,4));
        }
    },
    command: {
        name: "mc",
        exce: async (msg) => {
            let data = null;
            try {
                data = await ping(options);
            } catch (err) {
                console.log(err);
            };
            if (data) {
                try {
                    let serverInfo = `正常运行中\n版本: ${data.version.name}`;
                    if (data.players.sample) {
                        serverInfo += `\n在线列表[${data.players.sample.length}]:`;
                        for (var i = 0; i < data.players.sample.length; i++) {
                            serverInfo += `\n${data.players.sample[i].name}`;
                        };
                    };
                    msg.quoteReply([{ type: "Plain", text: serverInfo }], msg);
                } catch (err) {
                    msg.quoteReply([{ type: "Plain", text: "解构数据失败,请重试" }], msg);
                };
            } else {
                msg.quoteReply([{ type: "Plain", text: "服务器已离线" }], msg);
            };
        }
    }
}

module.exports = minecraft;