import { setGeniusExplorerTemporalMode } from "../map_data_catalog.js";

export class LayersControl {
    constructor(onModeChange) {
        LayersControl._nextId = (LayersControl._nextId || 0) + 1;
        this._controlId = `atm-layers-control-${LayersControl._nextId}`;
        this._container = document.createElement("div");
        this._container.classList.add(
            "maplibregl-ctrl",
            "maplibregl-ctrl-group",
            "layers-control"
        );
        this._onModeChange = onModeChange;
        this._activeMode = null;
        this._createModeSwitchButtons();
    }

    _createModeSwitchButtons() {
        const pillRow = document.createElement("div");
        pillRow.className =
            "layers-control__pills layers-control__pills--explorer-grid";

        const modes = [
            { key: "yearly", label: "Anual" },
            { key: "monthly", label: "Mensual" },
            { key: "trend", label: "Tendencia" },
        ];

        this._pillButtons = {};
        modes.forEach(({ key, label }) => {
            const col = document.createElement("div");
            col.className = "button-col layers-control__mode-col";
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "layers-control__pill";
            btn.dataset.mode = key;
            btn.textContent = label;
            btn.addEventListener("click", () => this._selectMode(key));
            col.appendChild(btn);
            pillRow.appendChild(col);
            this._pillButtons[key] = btn;
        });

        this._container.appendChild(pillRow);
    }

    _selectMode(key) {
        if (this._activeMode === key) return;
        this._activeMode = key;
        Object.entries(this._pillButtons).forEach(([k, btn]) => {
            const on = k === key;
            btn.classList.toggle("layers-control__pill--active", on);
            btn.classList.toggle("selected", on);
        });
        setGeniusExplorerTemporalMode(key);
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
