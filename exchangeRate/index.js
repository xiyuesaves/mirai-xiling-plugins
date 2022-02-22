const axios = require("axios");
const comparisonTable = require("./lib/comparisonTable.js");
const fs = require("fs");
const { join } = require("path");
let exchangeRatio = {
    access_key: null
};
try {
    exchangeRatio = require(join(process.cwd(), "./options/exchangeRate.json"));
    if (!exchangeRatio.date) {
        getNewRatio();
    }
} catch (err) {
    console.log("[汇率转换] 请在配置文件中填写access_key");
    fs.writeFileSync(join(process.cwd(), "./options/exchangeRate.json"), JSON.stringify(exchangeRatio, null, 4));
}
// 获取最新汇率数据
async function getNewRatio() {
    if (exchangeRatio.access_key) {
        try {
            let key = exchangeRatio.access_key
            let fixer = await axios.get(`http://data.fixer.io/api/latest?access_key=${key}`);
            exchangeRatio = fixer.data;
            exchangeRatio.access_key = key;
            fs.writeFileSync(join(process.cwd(), "./options/exchangeRate.json"), JSON.stringify(exchangeRatio, null, 4));
            console.log("[汇率转换] 更新完成");
        } catch (err) {
            console.log("[汇率转换] axios请求失败", err);
        }
    } else {
        console.log("[汇率转换] 请在配置文件中填写access_key");
    }
}

// 根据字符串查找对应货币简写
function convert(str) {
    let code = comparisonTable[str];
    if (code) {
        return code;
    } else {
        return false;
    }
}

const exchangeRate = {
    name: "汇率转换",
    command: {
        name: "汇率",
        exce: async (msg, parameter) => {
            let strArr = [],
                msgs = "";
            if (!parameter.length || parameter.length > 2) {
                msg.reply([{ type: "Plain", text: "请按以下格式输入\n#汇率\n[金额]待转币种\n[目标币种(默认人民币)]" }], msg);
                return false;
            } else {
                strArr = parameter;
            }
            if (strArr.length === 1) {
                strArr.push("人民币");
            }
            // console.log(strArr)
            let matchStr = strArr[0].match(/^\d+/); // 货币值
            let amount = matchStr ? matchStr[0] : 1; // 金额
            let selectCurrency = strArr[0].replace(amount, "").replace(/\s/g, ""); // 选择币种
            let targetCurrency = strArr[1].replace(/\s/g, ""); // 目标币种
            let selectCode = convert(selectCurrency); // 选择币种代码
            let targetCode = convert(targetCurrency); // 目标币种代码
            // console.log(amount, selectCurrency, selectCode, targetCurrency, targetCode);
            if (!exchangeRatio.date) {
                msg.reply([{ type: "Plain", text: "此功能当前尚不可用" }], msg);
                return false;
            }
            if (new Date().getTime() - new Date(exchangeRatio.date).getTime() > 86400000) {
                console.log("[汇率转换] 更新汇率表");
                await getNewRatio();
            }
            if (!selectCode || !exchangeRatio.rates[selectCode]) {
                msg.reply([{ type: "Plain", text: "没有找到待转币种" }], msg);
                return false;
            }
            if (!targetCode || !exchangeRatio.rates[targetCode]) {
                msg.reply([{ type: "Plain", text: "没有找到目标币种" }], msg);
                return false;
            }
            if (amount > Number.MAX_SAFE_INTEGER / 1000) {
                msgs = "转换货币超出范围,将固定为1\n";
                amount = 1;
            }
            let num = (exchangeRatio.rates[targetCode] / exchangeRatio.rates[selectCode] * amount).toFixed(2);
            msgs += `转换后为 ${num}${targetCurrency}`;
            msg.reply([{ type: "Plain", text: msgs }], msg);
        }
    }
}

module.exports = exchangeRate