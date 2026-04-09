const range = (start, end) =>
    Array.from({ length: end - start + 1 }, (_, index) => start + index);

export const PRODUCT_YEARS = {
    ndvi: range(2017, 2025),
    lst: range(1997, 2025),
    aod: range(2001, 2025),
    no2: range(2019, 2025),
    so2: range(2019, 2025),
    hu: range(2018, 2026),
};

export const MONTH_CODES = Array.from({ length: 12 }, (_, index) =>
    String(index + 1).padStart(2, "0")
);

export function getProductYears(productKey) {
    return [...(PRODUCT_YEARS[productKey] || [])];
}

export function getDefaultYearPair(productKey) {
    const years = getProductYears(productKey);
    if (!years.length) return [null, null];
    const last = years[years.length - 1];
    const secondToLast = years.length > 1 ? years[years.length - 2] : last;
    return [String(secondToLast), String(last)];
}

export function getDefaultMonthPair() {
    return [MONTH_CODES[0], MONTH_CODES[MONTH_CODES.length - 1]];
}

export function populateYearSelector(selectElement, productKey) {
    selectElement.innerHTML = "";
    getProductYears(productKey).forEach((year) => {
        const option = document.createElement("option");
        option.value = String(year);
        option.textContent = String(year);
        selectElement.appendChild(option);
    });
}

export function populateMonthSelector(selectElement) {
    selectElement.innerHTML = "";
    MONTH_CODES.forEach((month) => {
        const option = document.createElement("option");
        option.value = month;
        option.textContent = month;
        selectElement.appendChild(option);
    });
}
