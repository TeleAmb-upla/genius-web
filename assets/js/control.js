export class LayersControl {
    constructor(onModeChange, onInfraToggle, options = {}) {
        LayersControl._nextId = (LayersControl._nextId || 0) + 1;
        this._controlId = `layers-control-${LayersControl._nextId}`;
        this._container = document.createElement("div");
        this._container.classList.add(
            "maplibregl-ctrl",
            "maplibregl-ctrl-group",
            "layers-control"
        );
        this._onModeChange = onModeChange;
        this._onInfraToggle = onInfraToggle || null;
        this._activeMode = null;
        this._infraEnabled = false;
        this._modes = options.modes || [
            { key: "yearly", label: "Anual" },
            { key: "monthly", label: "Mensual" },
            { key: "trend", label: "Tendencia" },
        ];
        this._hideModePills = Boolean(options.hideModePills);
        this._createModeSwitchButtons();
    }

    _createModeSwitchButtons() {
        this._pillButtons = {};
        if (!this._hideModePills && this._modes.length) {
            const pillRow = document.createElement("div");
            pillRow.className = "layers-control__pills";
            this._modes.forEach(({ key, label }) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "layers-control__pill";
                btn.textContent = label;
                btn.dataset.mode = key;
                btn.addEventListener("click", () => this._selectMode(key));
                pillRow.appendChild(btn);
                this._pillButtons[key] = btn;
            });
            this._container.appendChild(pillRow);
        }

        const infraRow = document.createElement("label");
        infraRow.className = "layers-control__toggle";
        const infraCb = document.createElement("input");
        infraCb.type = "checkbox";
        infraCb.id = `${this._controlId}-infra`;
        infraCb.addEventListener("change", () => {
            this._infraEnabled = infraCb.checked;
            if (this._onInfraToggle) {
                this._onInfraToggle(this._infraEnabled);
            }
        });
        this._infraCheckbox = infraCb;
        const infraLabel = document.createElement("span");
        infraLabel.textContent = "Infraestructura";
        infraRow.appendChild(infraCb);
        infraRow.appendChild(infraLabel);

        if (!this._hideModePills && this._modes.length) {
            const divider = document.createElement("hr");
            divider.className = "layers-control__divider";
            this._container.appendChild(divider);
        }
        this._container.appendChild(infraRow);
    }

    _selectMode(key) {
        if (this._activeMode === key) return;
        this._activeMode = key;
        Object.entries(this._pillButtons).forEach(([k, btn]) => {
            btn.classList.toggle("layers-control__pill--active", k === key);
        });
        this._onModeChange(key);
    }

    setMode(key) {
        this._selectMode(key);
    }

    onAdd(map) {
        this._map = map;
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}
