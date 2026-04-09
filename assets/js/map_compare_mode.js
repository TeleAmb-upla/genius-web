export async function applyTemporalCompareDefaults({
    mode,
    beforeYearSelector,
    afterYearSelector,
    beforeMonthSelector,
    afterMonthSelector,
    defaultBeforeYear,
    defaultAfterYear,
    defaultBeforeMonth = '01',
    defaultAfterMonth = '12',
    updateYear,
    updateMonth,
}) {
    if (mode === 'yearly' && typeof updateYear === 'function') {
        beforeYearSelector.value = defaultBeforeYear;
        afterYearSelector.value = defaultAfterYear;
        await updateYear('before', defaultBeforeYear);
        await updateYear('after', defaultAfterYear);
        return;
    }

    if (mode === 'monthly' && typeof updateMonth === 'function') {
        beforeMonthSelector.value = defaultBeforeMonth;
        afterMonthSelector.value = defaultAfterMonth;
        await updateMonth('before', defaultBeforeMonth);
        await updateMonth('after', defaultAfterMonth);
    }
}

export function setCompareSingleMapMode({
    container,
    beforeSelector,
    afterSelector,
    beforeMap,
    afterMap,
    enabled,
}) {
    if (!container) return;
    container.classList.toggle('map-compare-single', enabled);

    const beforePane = container.querySelector(beforeSelector);
    const afterPane = container.querySelector(afterSelector);
    if (beforePane) beforePane.classList.toggle('map-compare-single__pane', enabled);
    if (afterPane) afterPane.classList.toggle('map-compare-hidden', enabled);

    if (beforeMap && typeof beforeMap.resize === 'function') {
        requestAnimationFrame(() => beforeMap.resize());
    }
    if (afterMap && typeof afterMap.resize === 'function') {
        requestAnimationFrame(() => afterMap.resize());
    }
}
