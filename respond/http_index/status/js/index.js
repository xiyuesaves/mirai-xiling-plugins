window.onload = function() {
    var vm = new Vue({
        el: "#app",
        data: {
            url: getQueryVariable("q"),
            items: []
        },
        methods: {

        },
        created: function() {
            let _this = this
            console.log("vue已启动")
            axios.get(`/replace_list/${this.url}`).then(function(res) {
                let data = [],
                    repeat = false;
                for (var i = 0; i < res.data.length; i++) {
                    for (var j = 0; j < data.length; j++) {
                        if (data[j].key === res.data[i].key) {
                            repeat = true
                            data[j].content.push(res.data[i].content)
                            data[j].counts.push(res.data[i].count)
                            data[j].type.push(res.data[i].reply_type)
                        }
                    }
                    if (!repeat) {
                        data.push({
                            key: res.data[i].key,
                            type: [
                                res.data[i].reply_type
                            ],
                            content: [
                                res.data[i].content
                            ],
                            counts: [
                                res.data[i].count
                            ]
                        })
                    }
                    repeat = false
                }
                console.log(data)
                _this.items = data
                console.log(res, _this.items)
            })
        }
    })
}

function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        if (pair[0] == variable) { return pair[1]; }
    }
    return (false);
}