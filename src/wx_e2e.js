let script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://cdn.bootcss.com/jquery/3.4.1/jquery.min.js";
script.onload = function() { console.log("jQuery is ready!") };
document.body.appendChild(script);


script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://cdn.bootcss.com/jsencrypt/3.0.0-rc.1/jsencrypt.min.js";
script.onload = function() { console.log("jsencrypt is ready!") };
document.body.appendChild(script);


let log = (msg) => { return console.log("[wx_e2e]:", msg); };

// 监听收到新消息
const origOpen = XMLHttpRequest.prototype.open;
const origsendTextMessage = angular.element('#editArea').scope().sendTextMessage;
var open_prototype = XMLHttpRequest.prototype.open;
let intercept_response = function(callback) {
    XMLHttpRequest.prototype.open = function() {
        // console.log(arguments);
        (/\/mmwebwx-bin\/webwxsync/.test(arguments['1'])) && this.addEventListener('readystatechange', function(event) {
            // console.log('readystate: ' + this.readyState);
            // console.log(this);
            if (this.responseText !== '' && this.readyState === 4) {
                // console.log(this.responseText);
                let original_response = this.responseText;
                let modified_response = JSON.parse(original_response);
                // 每次轮询可能收到多条消息
                for (let msg of modified_response.AddMsgList) {
                    log(msg);
                    if (msg.MsgType == 1)
                        msg = callback(msg);
                }
                // modify the response
                Object.defineProperty(this, 'response', { writable: true });
                Object.defineProperty(this, 'responseText', { writable: true });
                this.response = this.responseText = JSON.stringify(modified_response);
                // console.log(this.responseText);
            }
        });
        return open_prototype.apply(this, arguments);
    };
}



//保存所有的e2e会话
let e2e_list = [];

class WX_E2E {
    constructor(username, key_size = 1024) {
        this.getThis = () => this;
        this.username = username;
        this.state = 1;
        this.key_size = key_size;
        this.crypt = new JSEncrypt({ default_key_size: key_size });
        this.pri_key = this.crypt.getPrivateKey();
        this.pub_key = this.crypt.getPublicKey();
        this.other_key = undefined;
    }

    sendTextMessage() {
        let msg = angular.element('#editArea').scope().editAreaCtn;
        log(msg);
        //发送加密消息
        if (this.state === 3) {
            this.crypt.setPublicKey(this.other_key);
            let msg_l = [...msg];
            let e_msg_l = [];
            while (true) {
                let group = msg_l.splice(0, 117).join('');
                if (group.length == 0)
                    break;
                e_msg_l.push(this.crypt.encrypt(group));
            }
            let e_msg = e_msg_l.flat().join('');
            log(e_msg);
            angular.element('#editArea').scope().editAreaCtn = 'wx_e2e://' + e_msg;
            let orig_ret = origsendTextMessage();
            angular.element('#editArea').scope().editAreaCtn = '';
            this.modifyLastTextMessage(msg);
            return orig_ret;

        }
        //未连接，提示明文发送
        else {
            let ret = confirm(
                '对方尚未连接，此消息未加密，将明文发送！\r\n' +
                '对方尚未连接，此消息未加密，将明文发送！\r\n' +
                '点击确认，承担风险。\r\n' +
                '点击取消，返回编辑。');
            if (ret) {
                if (msg.search(`\r\n我正在使用wx_e2e发送消息。\r\n github.com/ygcaicn/wx_e2e`) < 0)
                    msg = msg + `\r\n我正在使用wx_e2e发送消息。\r\n github.com/ygcaicn/wx_e2e`;
                angular.element('#editArea').scope().editAreaCtn = msg;
                let orig_ret = origsendTextMessage();
                angular.element('#editArea').scope().editAreaCtn = '';
                this.modifyLastTextMessage("尚未连接，此消息未加密，为明文发送！");
                return orig_ret;
            } else return;

        }
    }

    // 参数为发送的明文消息
    modifyLastTextMessage(msg) {
        let username = this.username;
        let ret = angular.element("#chatArea").scope().chatContent.filter(function(item) {
            if (item.MsgType == 1 && item.MMIsSend && item.ToUserName === username) {
                return true;
            }
        })
        let last = ret.pop()
        last.MMActualContent = `<span class=\"emoji emoji1f510\"></span>: ${last.MMActualContent} 
        <br><hr><span class="e_msg">${msg}</span>`;
        $('body').click();
    }

    sendRequest() {
        let content = `wx_e2e://hi/${this.pub_key}`;
        angular.element('#editArea').scope().editAreaCtn = content;
        return origsendTextMessage();
        this.state = 4;
    }
    sendClose() {
        let content = `wx_e2e://close`;
        angular.element('#editArea').scope().editAreaCtn = content;
        return origsendTextMessage();
        this.state = 0;
    }

    
    decrypt(e_message) {
        this.crypt.setPrivateKey(this.pri_key);
        let e_message_l = [...e_message];
        let message_l = [];
        while (true) {
            let group = e_message_l.splice(0, 172).join('');
            if (group.length == 0)
                break;
            message_l.push(this.crypt.decrypt(group));
        }

        let message = message_l.flat().join('');
        return message || "密钥出错，请重新连接！";
    }

    enter_state_2(other_key) {
        log(this.username + ": enter_state_2");
        // log(other_key);
        this.state = 2;
        this.other_key = other_key;
        log(this.other_key)
        log(this)

        // this.enter_state_3();
        // ui_setState(3);

        //弹框提示确认
        //弹框
        //TODO
        log('弹框确认')
        let con = confirm(`收到请求连接，对方的Key为：\r\n${this.other_key}`);
        if (con) {
            this.enter_state_3();
            ui_setState(3);


            // 调整消息顺序
            // TODO 放在当前位置无效
            let username = this.username;
            //得到我方发送的消息列表
            let ret = angular.element("#chatArea").scope().chatContent.filter(function(item) {
                if (item.MsgType == 1 && item.MMIsSend && item.ToUserName === username) {
                    return true;
                }
            });
            // 找到最后一个
            let last = ret.pop();
            angular.element("#chatArea").scope().chatContent.splice(
                angular.element("#chatArea").scope().chatContent.findIndex(item => item.MsgId === last.MsgId),
                1);
            angular.element("#chatArea").scope().chatContent.push(last);
            $("body").click();


        }


    }


    // 我方发出的请求被对方确认（对方回复key）
    // 对方发出的请求连接
    enter_state_3(other_key) {
        log(this.username + ": enter_state_3");
        this.state = 3;
        // 我方发出的请求被对方确认（对方回复key）
        if (other_key) {
            this.other_key = other_key;

            log('我方发出的请求被对方确认');
        }
        // 对方发出的请求连接,弹窗确认后
        else {

            let content = `wx_e2e://ok/${this.pub_key}`;
            angular.element('#editArea').scope().editAreaCtn = content;
            let o_ret = origsendTextMessage();
            return o_ret;
        }

    }

    enter_state_4() {
        log(this.username + ": enter_state_4");
        this.sendRequest();
        this.state = 4;

    }




}


//消息处理函数，msg的格式为chatContent.json的第二个消息格式
let messageHandler = (msg) => {
    log('------------------------');
    log(msg);
    //只处理文本消息
    if (msg.MsgType != 1)
        return msg;

    let username = msg.FromUserName;
    // 判断是否需要处理
    let ret = e2e_list.filter(function(item) {
            return item.username === username;
        })
        // 不需要处理
    if (ret.length == 0)
        return msg;
    if (ret.length > 1) {
        log("e2e_list 出现重复用户。");
        return;
    }


    let e2e = ret[0];
    let content = msg.Content;
    // 请求连接
    // wx_e2e://hi/
    // -----BEGIN PUBLIC KEY-----
    // MIGeMA0GCSqGSIb3DQEBAQUAA4GMADCBiAKBgHMiD3c1O+ZvC1HKwc1H+RC9B9wL
    // /en0EMTtKw4PcGPXRV0MNBHYuOXYiF/34iTLnHa2JMDiTbeAazvUdq9tbE1hqU81
    // Mu53dp8uC5s66x9d5VmAxFztoSYUXFLY1/tY8lpnnMYQbyP3bSM0BlIOxZZDRMHE
    // k+qUpBL7tCcQU+WjAgMBAAE=
    // -----END PUBLIC KEY-----

    ret = /wx_e2e:\/\/hi\/(-----BEGIN PUBLIC KEY-----[\S\s]+)/m.exec(content);
    if (ret && ret.length == 2) {
        let other_key = ret[1];
        other_key = other_key.replace(/<br\/>/gm, "\n");
        log("收到请求连接，对方的Key为：\r\n" + other_key);
        if (e2e.state == 1 || e2e.state == 4) {
            //调整当前聊天
            // angular.element('.chat_item').scope().itemClick(username);
            $(`div[data-username="${username}"]`).click();

            e2e.enter_state_2(other_key);
            ui_setState(2);
            msg.Content = `<span class=\"emoji emoji1f510\"></span>: ${content} 
            <br><hr><span class="e_msg">对方请求e2e连接。</span>`;
            return msg;
        }
        msg.Content = `<span class=\"emoji emoji1f510\"></span>: ${content} 
        <br><hr><span class="e_msg">错误消息-状态不匹配</span>`;
        return msg;
    }

    // 对方退出(请求终止)
    // wx_e2e://close
    if (/wx_e2e:\/\/close/.test(content)) {
        log("对方退出！");
        if (e2e.state == 3) {
            e2e_list.splice(e2e_list.findIndex(item => item.username === e2e.username), 1);
            ui_setState(0);
            msg.Content = `<span class=\"emoji emoji1f510\"></span>: ${content} 
            <br><hr><span class="e_msg">对方断开e2e连接。</span>`;
            e2e_exit();
            return msg
        }
        msg.Content = `<span class=\"emoji emoji1f510\"></span>: ${content} 
        <br><hr><span class="e_msg">错误消息-状态不匹配</span>`;
        return msg
    }


    //对方确认（收到的消息为公钥，当前状态为4）
    // wx_e2e://ok/
    // -----BEGIN PUBLIC KEY-----
    // MIGeMA0GCSqGSIb3DQEBAQUAA4GMADCBiAKBgHMiD3c1O+ZvC1HKwc1H+RC9B9wL
    // /en0EMTtKw4PcGPXRV0MNBHYuOXYiF/34iTLnHa2JMDiTbeAazvUdq9tbE1hqU81
    // Mu53dp8uC5s66x9d5VmAxFztoSYUXFLY1/tY8lpnnMYQbyP3bSM0BlIOxZZDRMHE
    // k+qUpBL7tCcQU+WjAgMBAAE=
    // -----END PUBLIC KEY-----
    ret = /wx_e2e:\/\/ok\/(-----BEGIN PUBLIC KEY-----[\S\s]+)/m.exec(content);
    if (ret && ret.length == 2) {
        let other_key = ret[1];
        other_key = other_key.replace(/<br\/>/gm, "\n");
        log("收到对方确认，对方的Key为：\r\n" + other_key);
        if (e2e.state == 4) {
            e2e.enter_state_3(other_key);
            ui_setState(3);
            msg.Content = `<span class=\"emoji emoji1f510\"></span>: ${content} 
            <br><hr><span class="e_msg">对方已确认，连接成功！</span>`;
            return msg
        }
        msg.Content = `<span class=\"emoji emoji1f510\"></span>: ${content} 
        <br><hr><span class="e_msg">错误消息-状态不匹配</span>`;
        return msg
    }

    //加密消息，当前状态为3
    // wx_e2e://xxxxx
    ret = /wx_e2e:\/\/([\S\s]+)/m.exec(content);
    if (ret && e2e.state == 3) {
        let s = e2e.decrypt(ret[1])
        msg.Content = `<span class=\"emoji emoji1f510\"></span>: ${s} 
                        <br><hr><span class="e_msg">${content}</span>`;
        return msg;
    }

    //非加密消息
    msg.Content = `<span class=\"emoji emoji1f510\"></span>: ${content} 
    <br><hr><span class="e_msg">非加密消息。</span>`;

    // 必须要返回msg
    return msg;
}





// 进入e2e会话状态
// state 0->1
// username  联系人的username  angular.element("#chatArea").scope().currentContact.UserName
let e2e_enter = (username) => {
    let e2e = new WX_E2E(username);
    e2e_list.push(e2e);
    ui_setState(1);
    log(username + ": enter_state_1");

    // 正在等待对方的邀请，
    // confirm(`进入等待邀请状态\r\n点击确认`)
    // $("#e2e_state").click
}

// 退出会话状态
// username 联系人的username  angular.element("#chatArea").scope().currentContact.UserName
let e2e_exit = (username) => {
    let e2e = undefined;
    // 告诉对方退出
    // 判断是否需要处理
    let ret = e2e_list.filter(function(item) {
            return item.username === username;
        })
        // 不需要处理
    if (ret.length == 1) {
        e2e = ret[0];
        if (e2e.state > 1)
            e2e.sendClose();
    }
    if (ret.length > 1) {
        log("e2e_list 出现重复用户。请检查");
        return;
    }



    // 将会话从e2e_list删除
    e2e_list.splice(e2e_list.findIndex(item => item.username === e2e.username), 1);
    // TODO
    // 提示保存rsa公钥与密钥，以及e2e会话聊天记录

    // 恢复原始聊天功能
    ui_setState(0);

}




// 11 收到对方e2e请求
// 


let ui_init = () => {
    log('ui_init.')
    let css = `<style type="text/css">
    .e2e_toolbar{
        width: 30px;
        height: 30px;
        text-decoration: none;
        font-size: 30px;
        line-height: 30px;
        margin-left: 5px;
        color: #4d4d4d9e;
        // background: gold;
        //background: url(//res.wx.qq.com/a/wx_fed/webwx/res/static/css/5af37c4…@1x.png) no-repeat;
        background-position: -404px -398px;
        -webkit-background-size: 487px 462px;
        background-size: 487px 462px;
        vertical-align: middle;
        display: none;
    }
    .e2e_display{
        display: inline-block;
    }
    .e2e_hide{
        display: none;
    }
    .e2e_disable{
        color: #4d4d4d9e;
    }
    .e2e_enable{
        color: #7fac4d;
    }
    .e_msg{
        display: inline;
    }
    .e2e_box:before{/*使用伪类元素,after 和before都行*/
        content:"";
        height:100%;
        display:inline-block;
        vertical-align:middle;
      }
      .e2e_box{
        position: fixed;
        left: 0px;
        right: 0px;
        top:0px;
        bottom:0px;
        background-color: rgba(0,0,0,0.4);z-index:9999;
        opacity: 1;
        text-align: center;/**使内联元素居中**/
      }
      .e2e_donate_box{
        background: #fff;
        display:inline-block;/*设置为内联元素*/
      }
      .e2e_donate_box img{
          display: block;
          width: 400px;
          height: 622px;
      }
    .
    </style>
    `;
    $("body").append(css);
    let tools = `
    <a class="e2e_toolbar e2e_display e2e_enable" id="e2e_enter" href="javascript:;" title="WX_E2E">🔐</a>
    <a class="e2e_toolbar" id="e2e_state" href="javascript:;" title="">🔐</a>
    <a class="e2e_toolbar" id="e2e_update_key" href="javascript:;" title="WX_E2E update key">⚙</a>
    <a class="e2e_toolbar" id="e2e_donate" href="javascript:;" title="WX_E2E给作者买一杯咖啡!">💰</a>
    <a class="e2e_toolbar" id="e2e_exit" href="javascript:;" title="WX_E2E Exit">❌</a>
    `;
    $("#tool_bar").append(tools);

    let e2e_box = `
    <div id="e2e_box" class="e2e_box e2e_hide">
        <div class="e2e_donate_box"><img src="https://github.com/ygcaicn/wx_e2e/raw/master/alipay.jpg"/></div>
    <p>万分感谢</p>
    </div>
    `;
    $("body").append(e2e_box);

    $("#J_NavChatScrollBody").click(function() {
        log('click left');
        let username = angular.element("#chatArea").scope().currentContact.UserName;

        if (angular.element("#chatArea").scope().currentContact.MMInChatroom) {
            ui_setState(0);
            $("#e2e_enter").attr("class", "e2e_toolbar e2e_hide e2e_disable");
            return;
        }

        let ret = e2e_list.filter(function(item) {
            return item.username === username;
        })
        if (ret.length == 1) {
            let e2e = ret[0];
            ui_setState(e2e.state);
        } else {
            ui_setState(0);
        }
    });



    $(".e2e_donate_box").css('margin-top', ((window.innerHeight - 630) / 2).toString() + 'px');

    $("#e2e_donate").click(function() {
        $("#e2e_box").show();

    });
    $("#e2e_box").click(function(e) {
        e.preventDefault();
        $("#e2e_box").hide();
    });

    $("#e2e_enter").click(function() {
        log('click e2e_enter');
        if ($("#e2e_enter").attr("class").search('e2e_enable') >= 0) {
            let username = angular.element("#chatArea").scope().currentContact.UserName;
            e2e_enter(username);
        }
    });

    $("#e2e_state").click(function() {
        log('click e2e_state');
        if ($("#e2e_state").attr("class").search('e2e_enable') >= 0) {
            let username = angular.element("#chatArea").scope().currentContact.UserName;

            // 判断是否需要处理
            let ret = e2e_list.filter(function(item) {
                return item.username === username;
            })
            if (ret.length == 1) {
                let e2e = ret[0];
                log('e2e state:' + e2e.state);
                if (e2e.state == 1 || e2e.state == 4) {
                    e2e.enter_state_4();
                    ui_setState(4);
                    return;
                }
                if (e2e.state == 2) {
                    return;
                }
                if (e2e.state == 3) {
                    alert("wx_e2e 已连接！");
                    return;
                }

            }

        }
    });
    $("#e2e_update_key").click(function() {
        log('click e2e_update_key');
        if ($("#e2e_update_key").attr("class").search('e2e_enable') >= 0) {
            alert("设置功能正在开发中！...");
        }
    });

    $("#e2e_exit").click(function() {
        if ($("#e2e_exit").attr("class").search('e2e_enable') >= 0) {
            let username = angular.element("#chatArea").scope().currentContact.UserName;
            e2e_exit(username);
        }
    });

    ui_setState(0);
}


// 设置ui状态
// state 状态号         e2e_enter           e2e_state       e2e_update_key          e2e_exit
// 0 原生状态           display,enable      hide            hide                    hide
// 1 e2e未连接状态      diaplay,disable      ❓  ⛔            display,enable 🔑        display,enable ❌
// 2 收到请求，待确认    display,disable      ❇️              display,enable 🔑        display,enable ❌
// 3 连接成功           display,disable     🍻 ✅ 🔗            display,enable 🔑        display,enable ❌
// 4 发出请求，待对方确认 display,disable      ⁉️              display,disable 🔑⚙       display,enable ❌   
let ui_setState = (state) => {
    let e2e = undefined;

    //判断是否已经进行初始化
    if ($('#e2e_box').length === 0) {
        ui_init();
    }


    if (state != 0) {
        let username = angular.element("#chatArea").scope().currentContact.UserName;
        let ret = e2e_list.filter(function(item) {
            return item.username === username;
        })
        if (ret.length < 1) {
            log("严重错误，找不到e2e");
            return;
        }
        e2e = ret[0];

    }

    if (state == 0) {
        $("#e2e_enter").attr("class", "e2e_toolbar e2e_display e2e_enable");
        $("#e2e_state").attr("class", "e2e_toolbar e2e_hide");
        $("#e2e_update_key").attr("class", "e2e_toolbar e2e_hide");
        $("#e2e_donate").attr("class", "e2e_toolbar e2e_hide");
        $("#e2e_exit").attr("class", "e2e_toolbar e2e_hide");

        angular.element('#editArea').scope().sendTextMessage = origsendTextMessage;
        return;

    }
    if (state == 1) {
        $("#e2e_enter").attr("class", "e2e_toolbar e2e_display e2e_disable");
        $("#e2e_state").attr("class", "e2e_toolbar e2e_display e2e_enable");
        $("#e2e_state").attr("title", "WX_E2E未连接，点击发送请求！");
        $("#e2e_state").text('⛔');


        $("#e2e_update_key").attr("class", "e2e_toolbar e2e_display e2e_enable");
        $("#e2e_donate").attr("class", "e2e_toolbar e2e_display e2e_enable");
        $("#e2e_exit").attr("class", "e2e_toolbar e2e_display e2e_enable");


        angular.element('#editArea').scope().sendTextMessage = function() { return e2e.sendTextMessage(); };
        return;
    }
    if (state == 2) {
        $("#e2e_enter").attr("class", "e2e_toolbar e2e_display e2e_disable");
        $("#e2e_state").attr("class", "e2e_toolbar e2e_display e2e_enable");
        $("#e2e_state").attr("title", "WX_E2E收到请求，点击查看！");
        $("#e2e_state").text('❇️');

        $("#e2e_update_key").attr("class", "e2e_toolbar e2e_display e2e_enable");
        $("#e2e_donate").attr("class", "e2e_toolbar e2e_display e2e_enable");
        $("#e2e_exit").attr("class", "e2e_toolbar e2e_display e2e_enable");

        angular.element('#editArea').scope().sendTextMessage = function() { return e2e.sendTextMessage(); };


        return;
    }
    if (state == 3) {
        $("#e2e_enter").attr("class", "e2e_toolbar e2e_display e2e_disable");
        $("#e2e_state").attr("class", "e2e_toolbar e2e_display e2e_enable");
        $("#e2e_state").attr("title", "WX_E2E连接成功！");
        $("#e2e_state").text('🔗')

        $("#e2e_donate").attr("class", "e2e_toolbar e2e_display e2e_enable");
        $("#e2e_exit").attr("class", "e2e_toolbar e2e_display e2e_enable");

        angular.element('#editArea').scope().sendTextMessage = function() { return e2e.sendTextMessage(); };
        return;
    }
    if (state == 4) {
        $("#e2e_enter").attr("class", "e2e_toolbar e2e_display e2e_disable");
        $("#e2e_state").attr("class", "e2e_toolbar e2e_display e2e_enable");
        $("#e2e_state").attr("title", "WX_E2E已发出请求，待对方确认，点击再次发送请求！");
        $("#e2e_state").text('⁉️ ')
        $("#e2e_donate").attr("class", "e2e_toolbar e2e_display e2e_enable");
        $("#e2e_exit").attr("class", "e2e_toolbar e2e_display e2e_enable");

        angular.element('#editArea').scope().sendTextMessage = function() { return e2e.sendTextMessage(); };
        return;
    }
}




(() => {
    log("wechat end to end encrypt by rsa.");

    // 拦截消息
    intercept_response(function(msg) {
        return messageHandler(msg) || msg;
    });
    // ui初始化
    ui_init();

})();
