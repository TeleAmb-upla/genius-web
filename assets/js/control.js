export class LayersControl {
    constructor(onModeChange) {
        this._container = document.createElement("div");
        this._container.classList.add(
            "maplibregl-ctrl",
            "maplibregl-ctrl-group",
            "layers-control"
        );
        this._onModeChange = onModeChange;
        this._createModeSwitchButtons();
    }

    _createModeSwitchButtons() {
        const yearDiv = document.createElement("div");
        const yearButton = document.createElement("input");
        yearButton.type = "radio";
        yearButton.name = "mode";
        yearButton.id = "yearly";
        yearButton.addEventListener("change", () => {
            if (yearButton.checked) this._onModeChange('yearly');
        });

        const yearLabel = document.createElement("label");
        yearLabel.htmlFor = "yearly";
        yearLabel.textContent = "Años";
        yearDiv.appendChild(yearButton);
        yearDiv.appendChild(yearLabel);

        const monthDiv = document.createElement("div");
        const monthButton = document.createElement("input");
        monthButton.type = "radio";
        monthButton.name = "mode";
        monthButton.id = "monthly";
        monthButton.addEventListener("change", () => {
            if (monthButton.checked) this._onModeChange('monthly');
        });

        const monthLabel = document.createElement("label");
        monthLabel.htmlFor = "monthly";
        monthLabel.textContent = "Meses";
        monthDiv.appendChild(monthButton);
        monthDiv.appendChild(monthLabel);

        this._container.appendChild(yearDiv);
        this._container.appendChild(monthDiv);
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
