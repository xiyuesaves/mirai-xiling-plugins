const request = require('request');
const { cloudsearch } = require('NeteaseCloudMusicApi');

let sageTime = 3 * 60 * 1000, // 贤者时间
    lastTime = 0; // 上次调用时间

const neteaseCloudMusic = {
    name: "网易云点歌",
    command: {
        name: "点歌",
        exce: async (msg, parameter) => {
            if (parameter.length === 1) {
                let newTime = new Date().getTime();
                if (newTime - lastTime > sageTime) {
                    let searchCallback = await cloudsearch({ keywords: parameter[0], limit: 1 }, request),
                        sonsInfoArr = searchCallback.body.result.songs;
                    if (sonsInfoArr) {
                        let sonsInfo = sonsInfoArr[0],
                            sonsId = sonsInfo.id.toString();
                        let musicChain = {
                            type: 'MusicShare',
                            kind: 'NeteaseCloudMusic',
                            title: sonsInfo.name,
                            summary: sonsInfo.alia[0] || sonsInfo.al.name,
                            jumpUrl: `https://music.163.com/#/song/${sonsId}`,
                            pictureUrl: sonsInfo.al.picUrl,
                            musicUrl: `http://music.163.com/song/media/outer/url?id=${sonsId}`,
                            brief: `来自${msg.sender.memberName}的点歌`
                        }
                        lastTime = new Date().getTime();
                        msg.reply([musicChain], msg);
                    } else {
                        msg.reply([{ type: "Plain", text: "没有找到该歌曲" }], msg);
                    }
                } else {
                    msg.reply([{ type: "Plain", text: `先听完这首歌吧[${Math.floor((sageTime - (newTime - lastTime)) / 1000)}s]` }], msg);
                }
            } else {
                msg.reply([{ type: "Plain", text: "#点歌\n歌名" }], msg);
            }
        }
    }
}

module.exports = neteaseCloudMusic;