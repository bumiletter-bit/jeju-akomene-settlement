// ===== 데이터 관리 =====
const STORAGE_KEYS = {
    SETTLEMENTS: 'fcc_settlements',
    INVENTORY: 'fcc_inventory',
    INVENTORY_LOG: 'fcc_inventory_log',
    ITEM_PRICES: 'fcc_item_prices'
};

function loadData(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || null;
    } catch {
        return null;
    }
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function getSettlements() {
    return loadData(STORAGE_KEYS.SETTLEMENTS) || {};
}

function saveSettlements(data) {
    saveData(STORAGE_KEYS.SETTLEMENTS, data);
}

function getInventory() {
    return loadData(STORAGE_KEYS.INVENTORY) || { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
}

function saveInventory(data) {
    saveData(STORAGE_KEYS.INVENTORY, data);
}

function getInventoryLog() {
    return loadData(STORAGE_KEYS.INVENTORY_LOG) || [];
}

function saveInventoryLog(data) {
    saveData(STORAGE_KEYS.INVENTORY_LOG, data);
}

// ===== 유틸리티 =====
function formatNumber(num) {
    if (num === 0 || num === undefined || num === null) return '0';
    return Number(num).toLocaleString('ko-KR');
}

function formatDateStr(dateStr) {
    return dateStr.replace(/-/g, '.');
}

function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===== 상태 =====
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
let editingKey = null; // 수정 모드에서 사용하는 키 ("date__vendor")
let uploadedImageData = null; // base64 이미지 데이터

// ===== DOM 준비 =====
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initDashboard();
    initSettlement();
    initInventory();
    initItemPrice();
    initDataManagement();
});

// ===== 1. 네비게이션 =====
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;

            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-' + page).classList.add('active');

            if (page === 'dashboard') renderDashboard();
            if (page === 'settlement') renderSettlementTable();
            if (page === 'inventory') { renderInventoryCards(); renderInventoryLog(); }
            if (page === 'item-price') renderPriceList();
        });
    });
}

// ===== 2. 대시보드 =====
function initDashboard() {
    document.getElementById('prev-month').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderDashboard();
    });
    document.getElementById('next-month').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderDashboard();
    });
    renderDashboard();
}

function renderDashboard() {
    const monthNames = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    const m = monthNames[currentMonth];

    document.getElementById('dashboard-title').textContent = `${currentYear}년 ${m}월`;
    document.getElementById('summary-month-count-label').textContent = `${m}월 총 거래건수`;
    document.getElementById('summary-month-qty-label').textContent = `${m}월 총 수량`;

    const settlements = getSettlements();
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const today = todayStr();

    let monthCount = 0, monthQty = 0;
    let todayCount = 0, todayQty = 0;
    const dailyQty = {};

    Object.keys(settlements).forEach(key => {
        const entry = settlements[key];
        if (!entry || !entry.date) return;

        const entryQty = (entry.items || []).reduce((sum, item) => sum + (item.qty || 0), 0);

        if (entry.date.startsWith(prefix)) {
            monthCount++;
            monthQty += entryQty;
            dailyQty[entry.date] = (dailyQty[entry.date] || 0) + entryQty;
        }

        if (entry.date === today) {
            todayCount++;
            todayQty += entryQty;
        }
    });

    document.getElementById('summary-month-count').textContent = `${formatNumber(monthCount)} 건`;
    document.getElementById('summary-month-qty').textContent = `${formatNumber(monthQty)} 개`;
    document.getElementById('summary-today-count').textContent = `${formatNumber(todayCount)} 건`;
    document.getElementById('summary-today-qty').textContent = `${formatNumber(todayQty)} 개`;

    renderCalendar(dailyQty);
}

function renderCalendar(dailyQty) {
    const body = document.getElementById('calendar-body');
    body.innerHTML = '';

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = todayStr();

    // 빈 칸
    for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-cell empty';
        body.appendChild(cell);
    }

    // 날짜 셀
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const cell = document.createElement('div');
        cell.className = 'cal-cell';

        const qty = dailyQty[dateStr] || 0;
        const isToday = dateStr === today;

        let dayNumHTML = `<div class="day-num">${day}`;
        if (isToday) dayNumHTML += `<span class="today-badge">오늘</span>`;
        dayNumHTML += `</div>`;

        let contentHTML = '';
        if (qty > 0) {
            contentHTML = `<div class="day-sales">${formatNumber(qty)}개</div>`;
        }

        cell.innerHTML = dayNumHTML + contentHTML;
        body.appendChild(cell);
    }
}

// ===== 3. 정산관리 =====
function initSettlement() {
    const form = document.getElementById('settlement-form');
    const dateInput = document.getElementById('s-date');
    const filterMonth = document.getElementById('s-filter-month');
    const cancelBtn = document.getElementById('settlement-cancel-btn');
    const addItemBtn = document.getElementById('add-item-btn');

    // 기본값
    dateInput.value = todayStr();
    filterMonth.value = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    // 파일 드롭존 설정
    initFileDropZone();

    // 행 추가 버튼
    addItemBtn.addEventListener('click', () => {
        addItemRow();
    });

    // 폼 제출
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettlementData();
    });

    // 취소 버튼
    cancelBtn.addEventListener('click', () => {
        resetSettlementForm();
    });

    filterMonth.addEventListener('change', renderSettlementTable);
    renderSettlementTable();
}

function initFileDropZone() {
    const dropZone = document.getElementById('file-drop-zone');
    const fileInput = document.getElementById('ocr-file-input');
    const removeBtn = document.getElementById('remove-file-btn');

    // 클릭으로 파일 선택
    dropZone.addEventListener('click', (e) => {
        if (e.target === removeBtn || e.target.closest('#remove-file-btn')) return;
        fileInput.click();
    });

    // 드래그 앤 드롭
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleFileUpload(file);
        }
    });

    // 파일 선택
    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) {
            handleFileUpload(fileInput.files[0]);
        }
    });

    // 파일 제거
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearFileUpload();
    });
}

function clearFileUpload() {
    uploadedImageData = null;
    document.getElementById('ocr-file-input').value = '';
    document.getElementById('drop-placeholder').style.display = '';
    document.getElementById('drop-preview').style.display = 'none';
    document.getElementById('preview-img').src = '';
    document.getElementById('ocr-result-section').style.display = 'none';
    document.getElementById('items-edit-body').innerHTML = '';
    document.getElementById('ocr-loading').style.display = 'none';
}

function handleFileUpload(file) {
    const placeholder = document.getElementById('drop-placeholder');
    const preview = document.getElementById('drop-preview');
    const previewImg = document.getElementById('preview-img');

    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedImageData = e.target.result;
        previewImg.src = uploadedImageData;
        placeholder.style.display = 'none';
        preview.style.display = '';

        // OCR 실행
        runOCR(uploadedImageData);
    };
    reader.readAsDataURL(file);
}

async function runOCR(imageData) {
    const loading = document.getElementById('ocr-loading');
    const progressText = document.getElementById('ocr-progress-text');
    const resultSection = document.getElementById('ocr-result-section');

    loading.style.display = '';
    resultSection.style.display = 'none';

    try {
        // Tesseract.js가 로드되었는지 확인
        if (typeof Tesseract === 'undefined') {
            throw new Error('Tesseract.js가 로드되지 않았습니다.');
        }

        const result = await Tesseract.recognize(imageData, 'kor', {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const pct = Math.round((m.progress || 0) * 100);
                    progressText.textContent = `OCR 인식 중... ${pct}%`;
                }
            }
        });

        loading.style.display = 'none';

        const items = parseOCRText(result.data.text);
        renderOCRResult(items);
    } catch (err) {
        loading.style.display = 'none';
        console.error('OCR error:', err);
        // OCR 실패 시 빈 테이블 표시
        renderOCRResult([]);
        alert('OCR 인식에 실패했습니다. 수동으로 입력해주세요.');
    }
}

function parseOCRText(text) {
    const items = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (const line of lines) {
        // 패턴 1: 한글/영문 품목명 뒤에 숫자 (예: "감귤 100", "한라봉 50")
        const match = line.match(/([가-힣a-zA-Z][\s가-힣a-zA-Z()]*?)\s+(\d+)/);
        if (match) {
            const name = match[1].trim();
            const qty = parseInt(match[2], 10);
            if (name.length > 0 && qty > 0) {
                items.push({ name, qty });
            }
        }
    }

    return items;
}

function renderOCRResult(items) {
    const resultSection = document.getElementById('ocr-result-section');
    const tbody = document.getElementById('items-edit-body');

    resultSection.style.display = '';
    tbody.innerHTML = '';

    if (items.length === 0) {
        addItemRow();
    } else {
        items.forEach(item => {
            addItemRow(item.name, item.qty);
        });
    }
}

function addItemRow(name, qty) {
    const tbody = document.getElementById('items-edit-body');
    const tr = document.createElement('tr');

    const nameVal = name !== undefined ? escapeHTML(String(name)) : '';
    const qtyVal = qty !== undefined ? qty : '';

    tr.innerHTML = `
        <td><input type="text" class="item-name-input" value="${nameVal}" placeholder="품목명"></td>
        <td><input type="number" class="item-qty-input" value="${qtyVal}" placeholder="0" min="0"></td>
        <td style="text-align:center;">
            <button type="button" class="btn-icon delete remove-row-btn" title="삭제">&times;</button>
        </td>
    `;

    // 행 삭제 이벤트
    tr.querySelector('.remove-row-btn').addEventListener('click', () => {
        tr.remove();
    });

    tbody.appendChild(tr);
}

function collectItemsFromTable() {
    const rows = document.querySelectorAll('#items-edit-body tr');
    const items = [];
    rows.forEach(row => {
        const name = row.querySelector('.item-name-input').value.trim();
        const qty = parseInt(row.querySelector('.item-qty-input').value, 10) || 0;
        if (name || qty > 0) {
            items.push({ name, qty });
        }
    });
    return items;
}

function saveSettlementData() {
    const date = document.getElementById('s-date').value;
    const vendorRadio = document.querySelector('input[name="vendor"]:checked');

    if (!date) {
        alert('날짜를 선택해주세요.');
        return;
    }
    if (!vendorRadio) {
        alert('거래처를 선택해주세요.');
        return;
    }

    const vendor = vendorRadio.value;
    const items = collectItemsFromTable();

    if (items.length === 0) {
        alert('품목을 최소 1개 이상 입력해주세요.');
        return;
    }

    const newKey = `${date}__${vendor}`;
    const settlements = getSettlements();

    // 수정 모드에서 키가 변경된 경우 이전 항목 삭제
    if (editingKey && editingKey !== newKey) {
        delete settlements[editingKey];
    }

    settlements[newKey] = {
        date,
        vendor,
        items,
        imageData: uploadedImageData || null,
        createdAt: settlements[newKey]?.createdAt || new Date().toISOString()
    };

    try {
        saveSettlements(settlements);
    } catch (e) {
        // localStorage 용량 초과 시 이미지 제거 후 재시도
        settlements[newKey].imageData = null;
        try {
            saveSettlements(settlements);
            alert('이미지 용량이 커서 이미지 데이터 없이 저장되었습니다.');
        } catch (e2) {
            alert('저장에 실패했습니다. 저장 공간이 부족합니다.');
            return;
        }
    }

    resetSettlementForm();
    renderSettlementTable();
}

function resetSettlementForm() {
    const form = document.getElementById('settlement-form');
    form.reset();
    document.getElementById('s-date').value = todayStr();
    editingKey = null;
    uploadedImageData = null;
    document.getElementById('settlement-submit-btn').textContent = '저장';
    document.getElementById('settlement-cancel-btn').style.display = 'none';
    document.getElementById('drop-placeholder').style.display = '';
    document.getElementById('drop-preview').style.display = 'none';
    document.getElementById('preview-img').src = '';
    document.getElementById('ocr-result-section').style.display = 'none';
    document.getElementById('items-edit-body').innerHTML = '';
    document.getElementById('ocr-loading').style.display = 'none';
    document.getElementById('ocr-file-input').value = '';
}

function renderSettlementTable() {
    const tbody = document.getElementById('settlement-table-body');
    const filterMonth = document.getElementById('s-filter-month').value;
    const settlements = getSettlements();

    // 필터링 + 정렬
    const entries = Object.keys(settlements)
        .filter(key => {
            const entry = settlements[key];
            return entry && entry.date && entry.date.startsWith(filterMonth);
        })
        .sort((a, b) => {
            const da = settlements[a].date;
            const db = settlements[b].date;
            return da.localeCompare(db) || a.localeCompare(b);
        });

    let totalItemCount = 0, totalQty = 0;

    tbody.innerHTML = '';
    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray-500);padding:24px;">데이터가 없습니다.</td></tr>';
    } else {
        entries.forEach(key => {
            const entry = settlements[key];
            const itemCount = (entry.items || []).length;
            const qty = (entry.items || []).reduce((sum, item) => sum + (item.qty || 0), 0);
            totalItemCount += itemCount;
            totalQty += qty;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDateStr(entry.date)}</td>
                <td>${escapeHTML(entry.vendor || '')}</td>
                <td class="text-right">${itemCount}</td>
                <td class="text-right">${formatNumber(qty)} 개</td>
                <td class="text-center">
                    <div class="action-btns">
                        <button class="btn-icon btn-edit" data-key="${escapeHTML(key)}" title="수정">&#9998;</button>
                        <button class="btn-icon delete btn-delete" data-key="${escapeHTML(key)}" title="삭제">&times;</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // 이벤트 위임
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => editSettlement(btn.dataset.key));
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => deleteSettlement(btn.dataset.key));
        });
    }

    document.getElementById('total-item-count').innerHTML = `<strong>${totalItemCount}</strong>`;
    document.getElementById('total-qty').innerHTML = `<strong>${formatNumber(totalQty)} 개</strong>`;
}

function editSettlement(key) {
    const settlements = getSettlements();
    const entry = settlements[key];
    if (!entry) return;

    editingKey = key;
    document.getElementById('s-date').value = entry.date;

    // 거래처 라디오 선택
    const vendorRadios = document.querySelectorAll('input[name="vendor"]');
    vendorRadios.forEach(r => {
        r.checked = r.value === entry.vendor;
    });

    // 이미지 미리보기 복원
    if (entry.imageData) {
        uploadedImageData = entry.imageData;
        document.getElementById('drop-placeholder').style.display = 'none';
        document.getElementById('drop-preview').style.display = '';
        document.getElementById('preview-img').src = entry.imageData;
    }

    // 품목 테이블 복원
    renderOCRResult(entry.items || []);

    document.getElementById('settlement-submit-btn').textContent = '수정';
    document.getElementById('settlement-cancel-btn').style.display = '';
    document.getElementById('settlement-form').scrollIntoView({ behavior: 'smooth' });
}

function deleteSettlement(key) {
    const settlements = getSettlements();
    const entry = settlements[key];
    if (!entry) return;

    if (!confirm(`${formatDateStr(entry.date)} ${entry.vendor} 데이터를 삭제하시겠습니까?`)) return;

    delete settlements[key];
    saveSettlements(settlements);
    renderSettlementTable();
}

// ===== 4. 박스 재고 =====
function initInventory() {
    const form = document.getElementById('inventory-form');
    document.getElementById('inv-date').value = todayStr();

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const date = document.getElementById('inv-date').value;
        const size = document.getElementById('inv-size').value;
        const qty = parseInt(document.getElementById('inv-qty').value, 10);
        const type = document.getElementById('inv-type').value;

        if (!date || !qty || qty <= 0) return;

        const inventory = getInventory();
        const log = getInventoryLog();

        if (type === 'in') {
            inventory[size] = (inventory[size] || 0) + qty;
        } else {
            if ((inventory[size] || 0) < qty) {
                alert(`재고가 부족합니다. 현재 ${size}호 재고: ${inventory[size] || 0}개`);
                return;
            }
            inventory[size] = (inventory[size] || 0) - qty;
        }

        log.unshift({
            id: Date.now(),
            date,
            size,
            qty,
            type
        });

        saveInventory(inventory);
        saveInventoryLog(log);

        form.reset();
        document.getElementById('inv-date').value = todayStr();

        renderInventoryCards();
        renderInventoryLog();
    });

    renderInventoryCards();
    renderInventoryLog();
}

function renderInventoryCards() {
    const container = document.getElementById('inventory-cards');
    const inventory = getInventory();

    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const card = document.createElement('div');
        card.className = 'inv-card';
        card.innerHTML = `
            <div class="inv-size">${i}호</div>
            <div class="inv-qty">${formatNumber(inventory[String(i)] || 0)}<span class="inv-unit">개</span></div>
        `;
        container.appendChild(card);
    }
}

function renderInventoryLog() {
    const tbody = document.getElementById('inventory-table-body');
    const log = getInventoryLog();

    tbody.innerHTML = '';
    if (log.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray-500);padding:24px;">이력이 없습니다.</td></tr>';
        return;
    }

    log.forEach(item => {
        const tr = document.createElement('tr');
        const badge = item.type === 'in' ? '<span class="badge-in">입고</span>' : '<span class="badge-out">출고</span>';
        tr.innerHTML = `
            <td>${formatDateStr(item.date)}</td>
            <td class="text-center">${item.size}호</td>
            <td class="text-center">${badge}</td>
            <td class="text-right">${formatNumber(item.qty)}개</td>
            <td class="text-center">
                <button class="btn-icon delete btn-del-inv" data-id="${item.id}" title="삭제">&times;</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // 이벤트 위임
    tbody.querySelectorAll('.btn-del-inv').forEach(btn => {
        btn.addEventListener('click', () => deleteInventoryLog(Number(btn.dataset.id)));
    });
}

function deleteInventoryLog(id) {
    if (!confirm('이 이력을 삭제하시겠습니까? 재고 수량이 되돌아갑니다.')) return;

    const log = getInventoryLog();
    const idx = log.findIndex(item => item.id === id);
    if (idx === -1) return;

    const item = log[idx];
    const inventory = getInventory();

    // 되돌리기
    if (item.type === 'in') {
        inventory[item.size] = Math.max(0, (inventory[item.size] || 0) - item.qty);
    } else {
        inventory[item.size] = (inventory[item.size] || 0) + item.qty;
    }

    log.splice(idx, 1);

    saveInventory(inventory);
    saveInventoryLog(log);
    renderInventoryCards();
    renderInventoryLog();
}

// ===== 5. 품목별 금액 =====
// 데이터 구조: 키 "시작일__종료일__거래처명"
// 값: { startDate, endDate, vendor, prices: [number, ...] }
function getItemPrices() {
    return loadData(STORAGE_KEYS.ITEM_PRICES) || {};
}

function saveItemPrices(data) {
    saveData(STORAGE_KEYS.ITEM_PRICES, data);
}

let editingPriceKey = null;
let priceUploadedImageData = null;

function initItemPrice() {
    const form = document.getElementById('item-price-form');
    const addBtn = document.getElementById('add-price-item-btn');
    const cancelBtn = document.getElementById('price-cancel-btn');

    setDefaultWeekDates();
    initPriceFileDropZone();

    // 거래처 선택 시 테이블 헤더 업데이트
    document.querySelectorAll('input[name="price-vendor"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const vendor = radio.value;
            document.getElementById('price-table-header').textContent = `${vendor} 단가`;
        });
    });

    addBtn.addEventListener('click', () => {
        addPriceItemRow();
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        savePriceData();
    });

    cancelBtn.addEventListener('click', () => {
        resetPriceForm();
    });

    renderPriceList();
}

function setDefaultWeekDates() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    };

    document.getElementById('ip-start-date').value = fmt(monday);
    document.getElementById('ip-end-date').value = fmt(sunday);
}

// --- 파일 업로드 & OCR (품목별 금액) ---
function initPriceFileDropZone() {
    const dropZone = document.getElementById('price-file-drop-zone');
    const fileInput = document.getElementById('price-ocr-file-input');
    const removeBtn = document.getElementById('price-remove-file-btn');

    dropZone.addEventListener('click', (e) => {
        if (e.target === removeBtn || e.target.closest('#price-remove-file-btn')) return;
        fileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handlePriceFileUpload(file);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) {
            handlePriceFileUpload(fileInput.files[0]);
        }
    });

    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearPriceFileUpload();
    });
}

function clearPriceFileUpload() {
    priceUploadedImageData = null;
    document.getElementById('price-ocr-file-input').value = '';
    document.getElementById('price-drop-placeholder').style.display = '';
    document.getElementById('price-drop-preview').style.display = 'none';
    document.getElementById('price-preview-img').src = '';
    document.getElementById('price-ocr-loading').style.display = 'none';
}

function handlePriceFileUpload(file) {
    const placeholder = document.getElementById('price-drop-placeholder');
    const preview = document.getElementById('price-drop-preview');
    const previewImg = document.getElementById('price-preview-img');

    const reader = new FileReader();
    reader.onload = (e) => {
        priceUploadedImageData = e.target.result;
        previewImg.src = priceUploadedImageData;
        placeholder.style.display = 'none';
        preview.style.display = '';
        runPriceOCR(priceUploadedImageData);
    };
    reader.readAsDataURL(file);
}

async function runPriceOCR(imageData) {
    const loading = document.getElementById('price-ocr-loading');
    const progressText = document.getElementById('price-ocr-progress-text');

    loading.style.display = '';

    try {
        if (typeof Tesseract === 'undefined') {
            throw new Error('Tesseract.js가 로드되지 않았습니다.');
        }

        const result = await Tesseract.recognize(imageData, 'kor', {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const pct = Math.round((m.progress || 0) * 100);
                    progressText.textContent = `OCR 인식 중... ${pct}%`;
                }
            }
        });

        loading.style.display = 'none';
        const prices = parsePriceOCRText(result.data.text);
        renderPriceOCRResult(prices);
    } catch (err) {
        loading.style.display = 'none';
        console.error('Price OCR error:', err);
        renderPriceOCRResult([]);
        alert('OCR 인식에 실패했습니다. 수동으로 입력해주세요.');
    }
}

function parsePriceOCRText(text) {
    const prices = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (const line of lines) {
        const numRegex = /[\d,]+/g;
        let m;
        while ((m = numRegex.exec(line)) !== null) {
            const num = parseInt(m[0].replace(/,/g, ''), 10);
            if (num > 0) prices.push(num);
        }
    }

    return prices;
}

function renderPriceOCRResult(prices) {
    const tbody = document.getElementById('price-items-body');
    tbody.innerHTML = '';

    if (prices.length === 0) {
        addPriceItemRow();
    } else {
        prices.forEach(price => {
            addPriceItemRow(price);
        });
    }
}

// --- 테이블 행 추가/저장 ---
function addPriceItemRow(price) {
    const tbody = document.getElementById('price-items-body');
    const tr = document.createElement('tr');

    const val = price !== undefined ? price : '';

    tr.innerHTML = `
        <td><input type="text" class="price-val-input" value="${val ? formatNumber(val) : ''}" placeholder="0" inputmode="numeric"></td>
        <td style="text-align:center;">
            <button type="button" class="btn-icon delete remove-price-row-btn" title="삭제">&times;</button>
        </td>
    `;

    // 금액 자동 포맷팅
    const input = tr.querySelector('.price-val-input');
    input.addEventListener('input', () => {
        const raw = input.value.replace(/[^0-9]/g, '');
        if (raw) {
            input.value = Number(raw).toLocaleString('ko-KR');
        }
    });

    tr.querySelector('.remove-price-row-btn').addEventListener('click', () => {
        tr.remove();
    });

    tbody.appendChild(tr);
}

function parsePrice(value) {
    if (!value) return 0;
    return parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
}

function savePriceData() {
    const startDate = document.getElementById('ip-start-date').value;
    const endDate = document.getElementById('ip-end-date').value;
    const vendorRadio = document.querySelector('input[name="price-vendor"]:checked');

    if (!startDate || !endDate) {
        alert('시작일과 종료일을 입력해주세요.');
        return;
    }
    if (startDate > endDate) {
        alert('종료일이 시작일보다 앞설 수 없습니다.');
        return;
    }
    if (!vendorRadio) {
        alert('거래처를 선택해주세요.');
        return;
    }

    const vendor = vendorRadio.value;

    const rows = document.querySelectorAll('#price-items-body tr');
    const prices = [];
    rows.forEach(row => {
        const price = parsePrice(row.querySelector('.price-val-input').value);
        if (price > 0) {
            prices.push(price);
        }
    });

    if (prices.length === 0) {
        alert('금액을 최소 1개 이상 입력해주세요.');
        return;
    }

    const newKey = `${startDate}__${endDate}__${vendor}`;
    const allPrices = getItemPrices();

    if (editingPriceKey && editingPriceKey !== newKey) {
        delete allPrices[editingPriceKey];
    }

    allPrices[newKey] = {
        startDate,
        endDate,
        vendor,
        prices
    };

    saveItemPrices(allPrices);
    resetPriceForm();
    renderPriceList();
}

function resetPriceForm() {
    document.getElementById('item-price-form').reset();
    setDefaultWeekDates();
    document.getElementById('price-items-body').innerHTML = '';
    document.getElementById('price-table-header').textContent = '단가';
    editingPriceKey = null;
    priceUploadedImageData = null;
    document.getElementById('price-submit-btn').textContent = '저장';
    document.getElementById('price-cancel-btn').style.display = 'none';
    document.getElementById('price-detail-card').style.display = 'none';
    document.getElementById('price-drop-placeholder').style.display = '';
    document.getElementById('price-drop-preview').style.display = 'none';
    document.getElementById('price-preview-img').src = '';
    document.getElementById('price-ocr-loading').style.display = 'none';
    document.getElementById('price-ocr-file-input').value = '';
}

function renderPriceList() {
    const tbody = document.getElementById('price-list-body');
    const allPrices = getItemPrices();

    const keys = Object.keys(allPrices).sort((a, b) => b.localeCompare(a));

    tbody.innerHTML = '';
    if (keys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--gray-500);padding:24px;">설정된 금액이 없습니다.</td></tr>';
    } else {
        keys.forEach(key => {
            const entry = allPrices[key];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDateStr(entry.startDate)} ~ ${formatDateStr(entry.endDate)}</td>
                <td>${escapeHTML(entry.vendor || '')}</td>
                <td class="text-right">${(entry.prices || []).length}개</td>
                <td class="text-center">
                    <div class="action-btns">
                        <button class="btn-icon btn-price-view" data-key="${escapeHTML(key)}" title="상세">&#128269;</button>
                        <button class="btn-icon btn-price-edit" data-key="${escapeHTML(key)}" title="수정">&#9998;</button>
                        <button class="btn-icon delete btn-price-del" data-key="${escapeHTML(key)}" title="삭제">&times;</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.btn-price-view').forEach(btn => {
            btn.addEventListener('click', () => viewPriceDetail(btn.dataset.key));
        });
        tbody.querySelectorAll('.btn-price-edit').forEach(btn => {
            btn.addEventListener('click', () => editPriceEntry(btn.dataset.key));
        });
        tbody.querySelectorAll('.btn-price-del').forEach(btn => {
            btn.addEventListener('click', () => deletePriceEntry(btn.dataset.key));
        });
    }
}

function viewPriceDetail(key) {
    const allPrices = getItemPrices();
    const entry = allPrices[key];
    if (!entry) return;

    const card = document.getElementById('price-detail-card');
    const title = document.getElementById('price-detail-title');
    const tbody = document.getElementById('price-detail-body');
    const colHeader = document.getElementById('price-detail-col-header');

    title.textContent = `${formatDateStr(entry.startDate)} ~ ${formatDateStr(entry.endDate)} ${entry.vendor} 상세`;
    colHeader.textContent = `${entry.vendor} 단가`;
    card.style.display = '';

    tbody.innerHTML = '';
    (entry.prices || []).forEach(price => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="text-right">${formatNumber(price)} 원</td>`;
        tbody.appendChild(tr);
    });

    card.scrollIntoView({ behavior: 'smooth' });
}

function editPriceEntry(key) {
    const allPrices = getItemPrices();
    const entry = allPrices[key];
    if (!entry) return;

    editingPriceKey = key;
    document.getElementById('ip-start-date').value = entry.startDate;
    document.getElementById('ip-end-date').value = entry.endDate;

    // 거래처 라디오 선택
    document.querySelectorAll('input[name="price-vendor"]').forEach(r => {
        r.checked = r.value === entry.vendor;
    });
    document.getElementById('price-table-header').textContent = `${entry.vendor} 단가`;

    // 단가 행 복원
    const tbody = document.getElementById('price-items-body');
    tbody.innerHTML = '';
    (entry.prices || []).forEach(price => {
        addPriceItemRow(price);
    });

    document.getElementById('price-submit-btn').textContent = '수정';
    document.getElementById('price-cancel-btn').style.display = '';
    document.getElementById('price-detail-card').style.display = 'none';
    document.getElementById('item-price-form').scrollIntoView({ behavior: 'smooth' });
}

function deletePriceEntry(key) {
    const allPrices = getItemPrices();
    const entry = allPrices[key];
    if (!entry) return;

    if (!confirm(`${formatDateStr(entry.startDate)} ~ ${formatDateStr(entry.endDate)} ${entry.vendor} 금액 데이터를 삭제하시겠습니까?`)) return;

    delete allPrices[key];
    saveItemPrices(allPrices);
    renderPriceList();
    document.getElementById('price-detail-card').style.display = 'none';
}

// ===== 6. 데이터 관리 =====
function initDataManagement() {
    // 내보내기
    document.getElementById('export-btn').addEventListener('click', () => {
        const data = {
            settlements: getSettlements(),
            inventory: getInventory(),
            inventoryLog: getInventoryLog(),
            itemPrices: getItemPrices(),
            exportedAt: new Date().toISOString()
        };

        // 내보내기 시 이미지 데이터 제외 (파일 크기 절약)
        const exportData = JSON.parse(JSON.stringify(data));
        if (exportData.settlements) {
            Object.keys(exportData.settlements).forEach(key => {
                if (exportData.settlements[key].imageData) {
                    exportData.settlements[key].imageData = null;
                }
            });
        }

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `제주아꼼이네_백업_${todayStr()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // 가져오기 - 파일 선택
    const fileInput = document.getElementById('import-file');
    const importBtn = document.getElementById('import-btn');
    const filenameSpan = document.getElementById('import-filename');

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            filenameSpan.textContent = fileInput.files[0].name;
            importBtn.disabled = false;
        } else {
            filenameSpan.textContent = '';
            importBtn.disabled = true;
        }
    });

    importBtn.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.settlements && !data.inventory) {
                    alert('올바른 백업 파일이 아닙니다.');
                    return;
                }
                if (!confirm('기존 데이터를 덮어쓰겠습니까?')) return;

                if (data.settlements) saveSettlements(data.settlements);
                if (data.inventory) saveInventory(data.inventory);
                if (data.inventoryLog) saveInventoryLog(data.inventoryLog);
                if (data.itemPrices) saveItemPrices(data.itemPrices);

                alert('데이터를 성공적으로 가져왔습니다.');
                fileInput.value = '';
                filenameSpan.textContent = '';
                importBtn.disabled = true;

                renderDashboard();
            } catch {
                alert('파일을 읽는 중 오류가 발생했습니다. JSON 형식을 확인해주세요.');
            }
        };
        reader.readAsText(file);
    });

    // 전체 초기화
    document.getElementById('reset-btn').addEventListener('click', () => {
        if (!confirm('정말 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
        if (!confirm('한번 더 확인합니다. 정말 삭제하시겠습니까?')) return;

        localStorage.removeItem(STORAGE_KEYS.SETTLEMENTS);
        localStorage.removeItem(STORAGE_KEYS.INVENTORY);
        localStorage.removeItem(STORAGE_KEYS.INVENTORY_LOG);
        localStorage.removeItem(STORAGE_KEYS.ITEM_PRICES);

        alert('모든 데이터가 초기화되었습니다.');
        renderDashboard();
    });
}
