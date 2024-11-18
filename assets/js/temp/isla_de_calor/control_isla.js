export class LayersControl {
    constructor(onModeChange) {
        this._container = document.createElement("div");
        this._container.classList.add(
            "maplibregl-ctrl",
            "maplibregl-ctrl-group",
            "layers-control"
        );
        this._onModeChange = onModeChange;
        this._createYearButton();
    }

    _createYearButton() {
        // Estilo para alinear el botón a la izquierda
        const alignLeftStyle = "text-align: left;";

        // Botón de Años
        const yearDiv = document.createElement("div");
        yearDiv.style = alignLeftStyle;
        const yearButton = document.createElement("input");
        yearButton.type = "radio";
        yearButton.name = "mode";
        yearButton.id = "yearly";
        yearButton.checked = true; // Seleccionado por defecto
        yearButton.addEventListener("change", () => {
            if (yearButton.checked) this._onModeChange('yearly');
        });

        const yearLabel = document.createElement("label");
        yearLabel.htmlFor = "yearly";
        yearLabel.textContent = "Años";
        yearDiv.appendChild(yearButton);
        yearDiv.appendChild(yearLabel);

        // Añadir el botón al contenedor principal
        this._container.appendChild(yearDiv);
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
