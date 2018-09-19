var numSocket = new Rete.Socket("Number");
var stringSocket = new Rete.Socket("String");

class TextControl extends Rete.Control {

    constructor(emitter, key, readonly, type = 'text') {
        super();
        this.emitter = emitter;
        this.key = key;
        this.type = type;
        this.template = `<input type="${type}" :readonly="readonly" :value="value" @input="change($event)"/>`;

        this.scope = {
            value: null,
            readonly,
            change: this.change.bind(this)
        };
    }

    onChange() {}

    change(e) {
        this.scope.value = this.type === 'number' ? +e.target.value : e.target.value;
        this.update();
        this.onChange();
    }

    update() {
        if (this.key) {
            this.putData(this.key, this.scope.value);
        }

        this.emitter.trigger('process');
        this._alight.scan();
    }

    mounted() {
        this.scope.value = this.getData(this.key);
        this.update();
    }

    setValue(val) {
        this.scope.value = val;
        this._alight.scan();
    }
}

class MultiplicityControl extends Rete.Control {

    constructor(emitter, key, readonly, type = 'text') {
        super();
        this.emitter = emitter;
        this.key = key;
        this.keyz = Math.random().toString(36).substr(2, 9);
        this.type = type;
        this.template = `<input type="${type}" :readonly="readonly" :value="value" @input="change($event)"/><button :id="id" class="node_submit" type="button" @click="del_btn($event)" />-`;

        this.scope = {
            value: null,
            id: this.keyz,
            readonly,
            change: this.change.bind(this),
            del_btn: this.del_btn.bind(this)
        };
    }

    onChange() {}

    del_btn(e) {
        var node = this.getNode();
        node.controls.delete(this.scope.value);
        this.emitter.trigger('process');
        this.getNode()._alight.scan();
    }

    change(e) {
        this.scope.value = this.type === 'number' ? +e.target.value : e.target.value;
        this.update();
        this.onChange();
    }

    update() {
        if (this.key) {
            this.putData(this.key, this.scope.value);
        }

        this.emitter.trigger('process');
        this._alight.scan();
    }

    mounted() {
        this.scope.value = this.getData(this.key);
        this.update();
    }

    setValue(val) {
        this.scope.value = val;
        this._alight.scan();
    }

}

class TextAreaControl extends Rete.Control {

    constructor(emitter, key, readonly, type = 'text') {
        super();
        this.emitter = emitter;
        this.key = key;
        this.type = type;
        this.template = `<textarea :readonly="readonly" :value="value" @input="change($event)"> </textarea>`;

        this.scope = {
            value: null,
            readonly,
            change: this.change.bind(this)
        };
    }

    onChange() {}

    change(e) {
        this.scope.value = this.type === 'number' ? +e.target.value : e.target.value;
        this.update();
        this.onChange();
    }

    update() {
        if (this.key) {
            this.putData(this.key, this.scope.value);
        }

        this.emitter.trigger('process');
        this._alight.scan();
    }

    mounted() {
        this.scope.value = this.getData(this.key);
        this.update();
    }

    setValue(val) {
        this.scope.value = val;
        this._alight.scan();
    }
}

class ButtonControl extends Rete.Control {

    constructor(emitter, key, text) {
        super();
        this.emitter = emitter;
        this.key = key;
        this.keyz = Math.random().toString(36).substr(2, 9);
        this.type = "Button";
        this.template = '<input id="node_short_txt" placeholder="Ответ" type="text" :value="value_txt" @input="change_txt($event)"/> <button class="node_submit" type="button" @click="change_btn($event)" />{{text}}';

        this.scope = {
            value_text: '',
            text: text,
            change_txt: this.change_txt.bind(this),
            change_btn: this.change_btn.bind(this)
        };
    }

    change_btn(e) {

        let controls = this.getNode().controls;
        let outputs = this.getNode().outputs;
        let input = this.getNode().input;

        if (this.scope.value_txt !== '') {
            this.putData(this.scope.value_txt, this.scope.value_txt);
            this.getNode().addControl(new MultiplicityControl(this.emitter, this.scope.value_txt));
            outputs.set(this.scope.value_txt, new Rete.Output(this.keyz, this.scope.value_txt, stringSocket, true));
            console.log(outputs);
            this.scope.value_txt = '';
            this.emitter.trigger('process');
            this.getNode()._alight.scan();
        }
    }

    change_txt(e) {
        this.scope.value_txt = e.target.value;
        this.update();
    }

    update() {
        if (this.key) {
            this.putData(this.key, this.scope.value);
        }
        this.emitter.trigger('process');
        this._alight.scan();
    }

    mounted() {
    }

    setValue(val) {
        this.scope.value = val;
        this._alight.scan();
    }
}

class RadioComponent extends Rete.Component {

    constructor() {
        super("Динамичный ответ");
        this.nd = {};
    }

    builder(node) {
//        var out1 = new Rete.Output('radiooutput', "Вариант ответа", stringSocket);
        var inp1 = new Rete.Input('radioinput', "Запрос", stringSocket);

        this.nd = node
                .addControl(new ButtonControl(this.editor, 'btn', "+"))
                .addInput(inp1);
        return this.nd;
    }

    worker(node, inputs, outputs, sourceCode) {

        const key = 'radio_' + node.id + '_' + Math.random().toString(36).substr(2, 6);
        var value = 0;

        for (var i in node.data) {
            if (node.data.i) {
                value = node.data[i];
            }
        }

        outputs[0] = {
            key,
            value: value
        };
    }
}

class AddComponent extends Rete.Component {
    constructor() {
        super("Вариант ответа");
    }

    builder(node) {
        var inp1 = new Rete.Input('addinput', "Вариант ответа", stringSocket, true);
        var out = new Rete.Output('addoutput', "Ваш ответ", stringSocket, true);
        let ctrl = new TextControl(this.editor, 'preview');
        node.data.preview = "Ответ";

        return node
                .addInput(inp1)
                .addControl(ctrl)
                .addOutput(out);
    }

    worker(node, inputs, outputs) {
        outputs['preview'] = node.data.preview;
        //silent передается вот так: {    silent    } = {}
        //пример получения данных с ноды
//        if (!silent) {
//            this.editor.nodes.find(n => n.id == node.id).controls.get('preview').setValue(sum);
//        }
    }

    created(node) {
        console.log('created', node);
    }

    destroyed(node) {
        console.log('destroyed', node);
    }

}

class OutputComponent extends Rete.Component {

    constructor() {
        super("Конечная фраза");
    }

    builder(node) {
        var inp = new Rete.Input('endphrase', "Конечная фраза", stringSocket, true);
        var ctrl = new TextControl(this.editor, 'outputphrase', false);
        node.data.outputphrase = "Конечный ответ";

        return node.addControl(ctrl).addInput(inp);
    }

    worker(node, inputs, outputs) {
        outputs['outputphrase'] = node.data.outputphrase;
    }

    destroyed(node) {
        console.log('destroyed', node);
    }
}

class NumComponent extends Rete.Component {

    constructor() {
        super("Начальная реплика");
    }

    builder(node) {
        var out1 = new Rete.Output('initphrase', "Ожидаемые фразы", stringSocket);
        var ctrl = new TextControl(this.editor, 'initphrase', false);
        node.data.initphrase = "Ваша фраза";

        return node.addControl(ctrl).addOutput(out1);
    }

    worker(node, inputs, outputs) {
        outputs['initphrase'] = node.data.initphrase;
    }

    destroyed(node) {
        console.log('destroyed', node);
    }

}

class ContinueComponent extends Rete.Component {

    constructor() {
        super("Ваш ответ");
    }

    builder(node) {
        var inp = new Rete.Input('inputphrasephrase', "Входная фраза", stringSocket);
        var out1 = new Rete.Output('continuephrase', "Ваш ответ", stringSocket);
        var ctrl = new TextControl(this.editor, 'continuephrase', false);
        node.data.continuephrase = "Продолжение";

        return node.addControl(ctrl).addOutput(out1).addInput(inp);
    }

    worker(node, inputs, outputs) {
        outputs['continuephrase'] = node.data.continuephrase;
    }
}

var container = document.querySelector('#rete');
var editor = null;

var editor = new Rete.NodeEditor("demo@0.1.0", container);
editor.use(ConnectionPlugin, {curvature: 0.4});
editor.use(AlightRenderPlugin);
editor.use(ContextMenuPlugin);

var engine = new Rete.Engine("demo@0.1.0");

const NumClientClientComponent = new NumComponent();
const AddClientComponent = new AddComponent();
const RadioClientComponent = new RadioComponent();
const ContinueClientComponent = new ContinueComponent();
const OutputClientComponent = new OutputComponent();

const addVariableNodeButton = document.querySelector('#addVariableNode');
const addEndNodeButton = document.querySelector('#addEndNode');

[NumClientClientComponent, AddClientComponent, ContinueClientComponent, OutputClientComponent, RadioClientComponent].map(c => {
    editor.register(c);
    engine.register(c);
});

editor
        .fromJSON({
            id: "demo@0.1.0",
            nodes: {},
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
                let sourceCode = {
                    _s: '',
                    append(s) {
                        this._s += s;
                    }
                };
                await engine.abort();
                await engine.process(editor.toJSON(), null, sourceCode);

                getConsoleData(editor, editor.toJSON());
                await initClickNode();
            });

            editor.trigger("process");
            editor.view.resize();
        });

async function initClickNode() {

    const addInitNodeButton = document.querySelector('#addInitNode');

    addInitNodeButton.addEventListener("click", await function (e) {
        const node = NumClientClientComponent.createNode();

        node.position[0] = '100px';
        node.position[1] = '100px';

        this.editor.addNode(node);

        e.preventDefault();
        console.log(e);
    }, false);

}

function getConsoleData(editor, data) {
    const target = document.getElementById('save');
    const htmlConsole = document.getElementById('console');

    target.addEventListener("click", e => {
        e.preventDefault();

        htmlConsole.innerHTML = (editor.nodes.length !== 0) ? JSON.stringify(data) : '';
    }, false);
}
