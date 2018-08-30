
var onMessageTask = null;

var actSocket = new Rete.Socket("Action");
var strSocket = new Rete.Socket("String");

const JsRenderPlugin = {
    install(editor, params = {}){
        editor.on('rendercontrol', ({el, control}) => {
            if (control.render && control.render !== 'js')
                return;

            control.handler(el, editor);
        });
    }
}

class InputControl extends Rete.Control {

    constructor(key) {
        super();
        this.render = 'js';
        this.key = key;
    }

    handler(el, editor) {
        var input = document.createElement('input');
        el.appendChild(input);

        var text = this.getData(this.key) || "Ваше сообщение...";

        input.value = text;
        this.putData(this.key, text);
        input.addEventListener("change", () => {
            this.putData(this.key, input.value);
        });
    }
}

class MessageEventComponent extends Rete.Component {

    constructor() {
        super("Message event");
        this.task = {
            outputs: ['option', 'output'],
            init(task) {
                onMessageTask = task;
            }
        }
    }

    builder(node) {
        var out1 = new Rete.Output("Действие", actSocket);
        var out2 = new Rete.Output("Текст", strSocket);
        return node.addOutput(out1).addOutput(out2);
    }

    worker(node, inputs, msg) {

        return [msg];
    }
}

class MessageSendComponent extends Rete.Component {

    constructor() {
        super("Message send");
        this.task = {
            outputs: []
        }
    }

    builder(node) {
        var inp1 = new Rete.Input("Действие", actSocket);
        var inp2 = new Rete.Input("Текст", strSocket);


        var ctrl = new InputControl('text');
        inp2.addControl(ctrl);

        return node.addInput(inp1).addInput(inp2);
    }

    worker(node, inputs) {
        var text = inputs[0] ? inputs[0][0] : node.data.text; //default text
        console.log("msg send");
        receiveUser(text);
    }
}

class MessageMatchComponent extends Rete.Component {

    constructor() {
        super("Message match");
        this.task = {
            outputs: ['option', 'option']
        }
    }

    builder(node) {
        var inp1 = new Rete.Input("Действие", actSocket);
        var inp2 = new Rete.Input("Текст", strSocket);
        var out1 = new Rete.Output("Да", actSocket);
        var out2 = new Rete.Output("Нет", actSocket);
        var ctrl = new InputControl('regexp');

        return node
                .addControl(ctrl)
                .addInput(inp1)
                .addInput(inp2)
                .addOutput(out1)
                .addOutput(out2);
    }
    worker(node, inputs) {
        var text = inputs[0] ? inputs[0][0] : "";

        if (!text.match(new RegExp(node.data.regexp, "gi")))
            this.closed = [0];
        else
            this.closed = [1];
    }
}

class MessageComponent extends Rete.Component {

    constructor() {
        super("Message");
        this.task = {
            outputs: ['output']
        }
    }

    builder(node) {
        var out = new Rete.Output("Текст", strSocket);
        var ctrl = new InputControl("text");

        return node.addControl(ctrl).addOutput(out);
    }

    worker(node, inputs) {
        return [node.data.text];
    }
}

var components = [
    new MessageEventComponent,
    new MessageSendComponent,
    new MessageMatchComponent,
    new MessageComponent
];

var container = document.getElementById("editor");
var editor = new Rete.NodeEditor("demo@0.1.0", container);
editor.use(AlightRenderPlugin);
editor.use(ConnectionPlugin);
editor.use(ContextMenuPlugin);
editor.use(JsRenderPlugin);
editor.use(TaskPlugin);

var engine = new Rete.Engine("demo@0.1.0");

components.map(c => {
    editor.register(c)
    engine.register(c)
})

editor
        .fromJSON({
            id: "demo@0.1.0",
            nodes: {
                "1": {
                    id: 1,
                    data: {},
                    group: null,
                    inputs: [],
                    outputs: [
                        {connections: [{node: 4, input: 0}]},
                        {connections: [{node: 4, input: 1}]}
                    ],
                    position: [44, 138],
                    name: "Message event"
                }
//                "2": {
//                    id: 2,
//                    data: {},
//                    group: null,
//                    inputs: [
//                        {connections: [{node: 4, output: 1}]},
//                        {connections: [{node: 3, output: 0}]}
//                    ],
//                    outputs: [],
//                    position: [673.2072854903905, 194.82554933538893],
//                    name: "Message send"
//                },
//                "3": {
//                    id: 3,
//                    data: {text: "Не понял"},
//                    group: null,
//                    inputs: [],
//                    outputs: [{connections: [{node: 2, input: 1}]}],
//                    position: [334.3043696236001, 298.2715347978209],
//                    name: "Message"
//                },
//                "4": {
//                    id: 4,
//                    data: {regexp: ".*Привет.*"},
//                    group: null,
//                    inputs: [
//                        {connections: [{node: 1, output: 0}]},
//                        {connections: [{node: 1, output: 1}]}
//                    ],
//                    outputs: [
//                        {connections: [{node: 5, input: 0}]},
//                        {connections: [{node: 2, input: 0}]}
//                    ],
//                    position: [333.40730287320383, 22.1000138522662],
//                    name: "Message match"
//                },
//                "5": {
//                    id: 5,
//                    data: {},
//                    group: null,
//                    inputs: [
//                        {connections: [{node: 4, output: 0}]},
//                        {connections: [{node: 6, output: 0}]}
//                    ],
//                    outputs: [],
//                    position: [670.6284575254812, -103.66713461561366],
//                    name: "Message send"
//                },
//                "6": {
//                    id: 6,
//                    data: {text: "Приветствую!!"},
//                    group: null,
//                    inputs: [],
//                    outputs: [{connections: [{node: 5, input: 1}]}],
//                    position: [317.85328833563574, -143.3955998177927],
//                    name: "Message"
//                }
            },
            groups: {}
        })
        .then(() => {
            editor.on("error", err => {
                alertify.error(err.message);
            });

            editor.on("process connectioncreated connectionremoved nodecreated", async function () {
                if (engine.silent)
                    return;
                console.log('process')
                await engine.abort();
                await engine.process(editor.toJSON());
                console.log(editor.toJSON());
            });

            editor.trigger("process");
            editor.view.resize();
        });
