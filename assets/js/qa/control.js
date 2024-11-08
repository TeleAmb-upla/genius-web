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
        // Estilo para alinear los botones a la izquierda
        const alignLeftStyle = "text-align: left;";

        // Botón de Años
        const yearDiv = document.createElement("div");
        yearDiv.style = alignLeftStyle;
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

        // Botón de Meses
        const monthDiv = document.createElement("div");
        monthDiv.style = alignLeftStyle;
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

        // Botón de Tendencia
        const trendDiv = document.createElement("div");
        trendDiv.style = alignLeftStyle;
        const trendButton = document.createElement("input");
        trendButton.type = "radio";
        trendButton.name = "mode";
        trendButton.id = "trend";
        trendButton.addEventListener("change", () => {
            if (trendButton.checked) this._onModeChange('trend');
        });

        const trendLabel = document.createElement("label");
        trendLabel.htmlFor = "trend";
        trendLabel.textContent = "Tendencia";
        trendDiv.appendChild(trendButton);
        trendDiv.appendChild(trendLabel);

        // Botón de Infraestructura Urbana
        const infraDiv = document.createElement("div");
        infraDiv.style = alignLeftStyle;
        const infraButton = document.createElement("input");
        infraButton.type = "radio";
        infraButton.name = "mode";
        infraButton.id = "infraestructura";
        infraButton.addEventListener("change", () => {
            if (infraButton.checked) this._onModeChange('infraestructura');
        });

        const infraLabel = document.createElement("label");
        infraLabel.htmlFor = "infraestructura";
        infraLabel.textContent = "Infraestructura Urbana";
        infraDiv.appendChild(infraButton);
        infraDiv.appendChild(infraLabel);

        // Añadir todos los botones al contenedor principal
        this._container.appendChild(yearDiv);
        this._container.appendChild(monthDiv);
        this._container.appendChild(trendDiv);
        this._container.appendChild(infraDiv);
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
