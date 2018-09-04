var numSocket = new Rete.Socket("Number");
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
        this.scope.value = this.getData(this.key) || (this.type === 'number' ? 0 : '...');
        this.update();
    }

    setValue(val) {
        this.scope.value = val;
        this._alight.scan()
    }
}

class AddComponent extends Rete.Component {
    constructor() {
        super("Add");
    }

    builder(node) {
        var inp1 = new Rete.Input('num1', "Number", numSocket);
        var inp2 = new Rete.Input('num2', "Number", numSocket);
        var out = new Rete.Output('num', "Number", numSocket);

        inp1.addControl(new TextControl(this.editor, 'num1', false, 'number'));
        inp2.addControl(new TextControl(this.editor, 'num2', false, 'number'));

        return node
                .addInput(inp1)
                .addInput(inp2)
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
        console.log('created', node)
    }

    destroyed(node) {
        console.log('destroyed', node)
    }
}

class OutputComponent extends Rete.Component {

    constructor() {
        super("Output");
    }

    builder(node) {
        var inp = new Rete.Input('input', "Number", numSocket);
        var ctrl = new TextControl(this.editor, 'name');

        return node.addControl(ctrl).addInput(inp);
    }
}

class NumComponent extends Rete.Component {

    constructor() {
        super("Number");
    }

    builder(node) {
        var out1 = new Rete.Output('num', "Number", numSocket);
        var ctrl = new TextControl(this.editor, 'num', false, 'number');

        return node.addControl(ctrl).addOutput(out1);
    }

    worker(node, inputs, outputs) {
        outputs['num'] = node.data.num;
    }
}


var container = document.querySelector('#rete');
var editor = null;

var editor = new Rete.NodeEditor("demo@0.1.0", container);
editor.use(ConnectionPlugin, {curvature: 0.4});
editor.use(AlightRenderPlugin);
editor.use(ContextMenuPlugin);

var engine = new Rete.Engine("demo@0.1.0");

[new AddComponent, new OutputComponent, new NumComponent].map(c => {
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