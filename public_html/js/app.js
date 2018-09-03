var onMessageTask = null;

var actSocket = new Rete.Socket("Action");
var strSocket = new Rete.Socket("String");
const numSocket = new Rete.Socket('Number value');

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

class InitialControl extends Rete.Control {
    
    constructor(emitter, key, value, name, text) {
        super();
        this.emitter = emitter;
        this.key = key;
        this.keyz = Math.random()
                .toString(36)
                .substr(2, 9);
        this.type = "Radio";
        this.template =
                '<input id="node_initial" name={{name}} type="radio" :value="value" @click.noprevent.stop="change($event)" /><span style="display: inline-block; min-width: 160px;">{{text}}</span><button :id="id" class="node_submit" type="button" @click="del_btn($event)" />-';

        this.scope = {
            id: this.keyz,
            value: value,
            text: text,
            name: name,
            change: this.change.bind(this),
            del_btn: this.del_btn.bind(this)
        };
    }
    change(e) {
        this.scope.value = +e.target.value;
        this.update();
    }

    del_btn(e) {
        var node = this.getNode();
        var id = e.target.id;
        removeItem(node.controls, "keyz", id);
        this.emitter.trigger("process");
        this.getNode()._alight.scan();
    }

    update() {
        if (this.key)
            this.putData(this.key, this.scope.value);
        this.emitter.trigger("process");
        this._alight.scan();
    }

    mounted() {}

    setValue(val) {
        this.scope.value = val;
        this._alight.scan();
    }
}

class InitialComponent extends Rete.Component {

    constructor() {
        super("Стартовое сообщение");
        this.task = {
            outputs: ['output']
        };
    }

    builder(node) {
        var out = new Rete.Output("Вариант 1", strSocket);
        var ctrl = new InputControl("text");
        return node.addControl(ctrl).addOutput(out);
    }

    worker(node, inputs) {

        return [node.data.text];
    }
}

var components = [
    new InitialComponent
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
    editor.register(c);
    engine.register(c);
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
                if (engine.silent) {
                    return;

                }
                await engine.abort();
                await engine.process(editor.toJSON());
                getConsoleData(editor.toJSON());
            });

            editor.trigger("process");
            editor.view.resize();
        });

function getConsoleData(data) {
    const target = document.getElementById('save');
    const console = document.getElementById('console');

    target.addEventListener("click", e => {
        e.preventDefault();

        console.innerHTML = JSON.stringify(data);
    }, false);
}