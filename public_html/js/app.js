var numSocket = new Rete.Socket("Number");
var stringSocket = new Rete.Socket("String");
var floatSocket = new Rete.Socket("Float");

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
        if (this.key)
            this.putData(this.key, this.scope.value)
        this.emitter.trigger('process');
        this._alight.scan();
    }

    mounted() {
        this.scope.value = this.getData(this.key) || (this.type === 'number' ? 0 : 'Фраза');
        this.update();
    }

    setValue(val) {
        this.scope.value = val;
        this._alight.scan()
    }
}

class RadioControl extends Rete.Control {

    constructor(emitter, key, value, name, text) {
        super();
        this.emitter = emitter;
        this.key = key;
        this.keyz = Math.random().toString(36).substr(2, 9);
        this.type = "Radio";
        this.template = '<input id="node_radio" name={{name}} type="radio" :value="value" @click.noprevent.stop="change($event)" /><span style="display: inline-block; min-width: 160px;">{{text}}</span><button :id="id" class="node_submit" type="button" @click="del_btn($event)" />-';

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
        this.emitter.trigger('process');
        this.getNode()._alight.scan();
    }

    update() {
        if (this.key)
            this.putData(this.key, this.scope.value)
        this.emitter.trigger('process');
        this._alight.scan();
    }

    mounted() {
    }

    setValue(val) {
        this.scope.value = val;
        this._alight.scan()
    }
}

class AddComponent extends Rete.Component {
    constructor() {
        super("Варианты");
    }

    builder(node) {
        var inp1 = new Rete.Input('addinput', "Вариант ответа", stringSocket);
        var out = new Rete.Output('addoutput', "Ваш ответ", stringSocket);

        return node
                .addInput(inp1)
                .addControl(new TextControl(this.editor, 'preview', true))
                .addOutput(out);
    }

    worker(node, inputs, outputs, {
    silent
    } = {}) {
        var n1 = inputs['num1'].length ? inputs['num1'][0] : node.data.num1;
        var n2 = inputs['num2'].length ? inputs['num2'][0] : node.data.num2;
        var sum = n1 + n2;

        if (!silent)
            this.editor.nodes.find(n => n.id == node.id).controls.get('preview').setValue(sum);

        outputs['num'] = sum;
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
        var inp = new Rete.Input('endphrase', "Конечная фраза", stringSocket);
        var ctrl = new TextControl(this.editor, 'initphrase', false);

        return node.addControl(ctrl).addInput(inp);
    }
}

class NumComponent extends Rete.Component {

    constructor() {
        super("Начальная реплика");
    }

    builder(node) {
        var out1 = new Rete.Output('initphrase', "Ожидаемые фразы", stringSocket);
        var ctrl = new TextControl(this.editor, 'initphrase', false);

        return node.addControl(ctrl).addOutput(out1);
    }

    worker(node, inputs, outputs) {
        outputs['initphrase'] = node.data.initphrase;
    }
}

class ContinueComponent extends Rete.Component {

    constructor() {
        super("Ваш ответ");
    }

    builder(node) {
        var inp = new Rete.Input('inputphrasephrase', "Входная фраза", stringSocket);
        var out1 = new Rete.Output('continuephrase', "Ваш ответ", stringSocket);
        var ctrl = new TextControl(this.editor, 'initphrase', false);

        return node.addControl(ctrl).addOutput(out1).addInput(inp);
    }

    worker(node, inputs, outputs) {
        outputs['initphrase'] = node.data.initphrase;
    }
}

var container = document.querySelector('#rete');
var editor = null;

var editor = new Rete.NodeEditor("demo@0.1.0", container);
editor.use(ConnectionPlugin, {curvature: 0.4});
editor.use(AlightRenderPlugin);
editor.use(ContextMenuPlugin);

var engine = new Rete.Engine("demo@0.1.0");

[new NumComponent, new AddComponent, new ContinueComponent, new OutputComponent ].map(c => {
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