// 选择插件
const choose = {
    name: "选择",
    command: {
        name: "选择",
        exce: (msg, parameter) => {
            let plain = msg.plain;
            let strArr = [];
            if (!parameter.length) {
                msg.reply([{ type: "Plain", text: "#选择\n[选项1]还是[选项2]还是[...]" }], msg);
                return false;
            }
            if (parameter.length === 1) {
                strArr = parameter[0].split("还是");
            } else {
                strArr = parameter;
            }
            let select = strArr[Math.floor(Math.random() * strArr.length)];
            msg.reply([{ type: "Plain", text: `建议选择 ${select}` }], msg);
        }
    }
}

module.exports = choose